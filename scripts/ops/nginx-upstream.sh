#!/usr/bin/env bash
#
# The nginx half of the zero-gap deploy (CLAUDE.md §13.2).
#
# deploy-production.sh builds the new version next to the live one and runs it on a spare port (the
# "bridge"). While the live process is swapped, nginx has to send customers to the bridge. nginx does
# that by reading one small file this script owns, and a reload is graceful: a request that is already
# in flight finishes on the process that took it, and no connection is dropped.
#
# What this installs, once:
#   /etc/nginx/conf.d/maky-storefront-upstream.conf   the upstream group, and a loopback-only listener
#                                                     that goes through the same group (so the deploy
#                                                     can see WHICH process answers, and measure)
#   /etc/nginx/conf.d/storefront.conf                 one line: proxy_pass http://maky_storefront;
#
#   scripts/ops/nginx-upstream.sh status
#   scripts/ops/nginx-upstream.sh probe              one request through the loopback listener: CODE ADDRESS
#   scripts/ops/nginx-upstream.sh setup              show what would change, change nothing
#   scripts/ops/nginx-upstream.sh setup --apply      install it (needs sudo; backs the site file up first)
#   scripts/ops/nginx-upstream.sh set canonical-only | bridge-primary
#   scripts/ops/nginx-upstream.sh revert --apply     put the original storefront.conf back
#
# Every change is `nginx -t`, reload, then a request through the loopback listener that must be
# answered 200 by the process the new state names. If any of it fails, the previous file is put back.
#
# Exit codes
#   0   done (or already so)
#   1   refused or failed; the previous state is back
#   2   failed AND the previous state could not be put back: nginx may be in an unknown state
#   3   status only: partly installed
#
set -euo pipefail

SITE_FILE="${SITE_FILE:-/etc/nginx/conf.d/storefront.conf}"
UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/conf.d/maky-storefront-upstream.conf}"
UPSTREAM_NAME="${UPSTREAM_NAME:-maky_storefront}"
CANONICAL_ADDR="${CANONICAL_ADDR:-127.0.0.1:3000}"
BRIDGE_ADDR="${BRIDGE_ADDR:-127.0.0.1:3100}"
PROBE_ADDR="${PROBE_ADDR:-127.0.0.1:3199}"
PUBLIC_HOST="${PUBLIC_HOST:-maky.store}"
PUBLIC_URL="${PUBLIC_URL:-https://${PUBLIC_HOST}}"
NGINX_LOCAL_IP="${NGINX_LOCAL_IP:-127.0.0.1}"
SMOKE_PATH="${SMOKE_PATH:-/sk}"
SUDO="${SUDO-sudo -n}"
NGINX_BIN="${NGINX_BIN:-nginx}"
RELOAD_CMD="${RELOAD_CMD:-systemctl reload nginx}"
VERIFY_TIMEOUT_S="${VERIFY_TIMEOUT_S:-20}"

info() { printf '==> %s\n' "$*"; }
warn() { printf 'warn: %s\n' "$*" >&2; }
err()  { printf 'error: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

TMP_FILES=()
cleanup() {
	local f
	for f in ${TMP_FILES+"${TMP_FILES[@]}"}; do rm -f "$f"; done
}
trap cleanup EXIT
new_tmp() {
	local f
	f=$(mktemp)
	TMP_FILES+=("$f")
	printf '%s' "$f"
}

usage() {
	sed -n '3,/^set -euo pipefail$/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

# --- what the managed file says ---------------------------------------------------------
# The two states are the only two this tool writes. canonical-only is the resting state and is
# what nginx did before this existed; bridge-primary is the window while the live process is swapped.
render_upstream() {
	local state="$1"
	printf '# Managed by scripts/ops/nginx-upstream.sh (CLAUDE.md §13.2). Do not edit by hand.\n'
	printf '# state: %s\n' "$state"
	printf 'upstream %s {\n' "$UPSTREAM_NAME"
	case "$state" in
		canonical-only) printf '    server %s;\n' "$CANONICAL_ADDR" ;;
		bridge-primary) printf '    server %s;\n    server %s backup;\n' "$BRIDGE_ADDR" "$CANONICAL_ADDR" ;;
		*) die "no such state: $state" ;;
	esac
	printf '}\n\n'
	cat <<EOF
# Loopback only. It goes through the same upstream group as the public server block, so a request
# here is answered by the process customers are being sent to, and X-Maky-Upstream names it.
server {
    listen ${PROBE_ADDR};
    server_name _;
    access_log off;

    location / {
        proxy_pass http://${UPSTREAM_NAME};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        add_header X-Maky-Upstream \$upstream_addr always;
    }
}
EOF
}

current_state() {
	[[ -f "$UPSTREAM_FILE" ]] || { echo absent; return 0; }
	local s
	s=$(sed -n 's/^# state: *//p' "$UPSTREAM_FILE" | head -1)
	case "$s" in
		canonical-only|bridge-primary) echo "$s" ;;
		*) echo unknown ;;
	esac
}

site_wired() {
	grep -qF "proxy_pass http://${UPSTREAM_NAME};" "$SITE_FILE" 2>/dev/null
}

# --- nginx, and a look at what it is doing -----------------------------------------------
nginx_test() {
	local out
	# A warning (the box has one about http2) still exits 0; only the exit status counts.
	if out=$($SUDO "$NGINX_BIN" -t 2>&1); then
		return 0
	fi
	err "nginx -t refused the configuration:"
	printf '%s\n' "$out" >&2
	return 1
}

nginx_reload() {
	# shellcheck disable=SC2086  # RELOAD_CMD is a command line on purpose
	$SUDO $RELOAD_CMD
}

install_file() {
	# Rename, never an in-place write: nginx must never read half a file. The temporary name does
	# not end in .conf, so the include glob cannot pick it up.
	$SUDO install -m 0644 "$1" "$2.new" && $SUDO mv -f "$2.new" "$2"
}

# One request through the loopback listener: "CODE ADDRESS". The address is what nginx put in
# X-Maky-Upstream; more than one means nginx tried a second server.
probe_once() {
	local hdr code addr
	hdr=$(new_tmp)
	code=$(curl -sS -o /dev/null -D "$hdr" -w '%{http_code}' --max-time 5 "http://${PROBE_ADDR}${SMOKE_PATH}" 2>/dev/null) || code=000
	addr=$(awk 'tolower($1) == "x-maky-upstream:" { gsub(/\r/, ""); $1 = ""; sub(/^ /, ""); print; exit }' "$hdr" 2>/dev/null || true)
	printf '%s %s' "$code" "${addr:-none}"
}

LAST_PROBE=""
wait_for_upstream() {
	local want="$1" i out code addr
	for ((i = 0; i < VERIFY_TIMEOUT_S * 2; i++)); do
		out=$(probe_once)
		code="${out%% *}"
		addr="${out#* }"
		if [[ "$code" == "200" && "$addr" == "$want" ]]; then
			return 0
		fi
		LAST_PROBE="HTTP $code via $addr, wanted 200 via $want"
		sleep 0.5
	done
	return 1
}

# The same page through the real server block (TLS, Host, security headers), pinned to this machine.
check_public() {
	local code
	code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
		--resolve "${PUBLIC_HOST}:443:${NGINX_LOCAL_IP}" "${PUBLIC_URL}${SMOKE_PATH}" 2>/dev/null) || code=000
	if [[ "$code" == "200" ]]; then
		info "ok  ${PUBLIC_URL}${SMOKE_PATH} through nginx: 200"
		return 0
	fi
	err "${PUBLIC_URL}${SMOKE_PATH} through nginx answered $code"
	return 1
}

port_busy() {
	(exec 3<>"/dev/tcp/${1%:*}/${1##*:}") 2>/dev/null
}

# --- commands -----------------------------------------------------------------------------
cmd_status() {
	local state wired=no
	state=$(current_state)
	site_wired && wired=yes
	printf 'state=%s\nsite-wired=%s\n' "$state" "$wired"
	if [[ "$state" == absent && "$wired" == no ]]; then
		return 2
	fi
	if [[ "$state" == absent || "$state" == unknown || "$wired" == no ]]; then
		return 3
	fi
	return 0
}

cmd_set() {
	local target="${1:-}" expect old new previous previous_expect
	case "$target" in
		canonical-only) expect="$CANONICAL_ADDR" ;;
		bridge-primary) expect="$BRIDGE_ADDR" ;;
		*) die "usage: $0 set canonical-only | bridge-primary" ;;
	esac
	cmd_status >/dev/null || die "the managed upstream is not installed and wired here — run: $0 setup --apply"
	# Where customers are now, so a failed switch can be shown to have put them back there.
	previous=$(current_state)
	case "$previous" in
		canonical-only) previous_expect="$CANONICAL_ADDR" ;;
		*) previous_expect="$BRIDGE_ADDR" ;;
	esac

	old=$(new_tmp)
	new=$(new_tmp)
	cp -p -- "$UPSTREAM_FILE" "$old"
	render_upstream "$target" >"$new"
	if ! cmp -s "$old" "$new"; then
		install_file "$new" "$UPSTREAM_FILE" || { err "could not write $UPSTREAM_FILE"; return 1; }
	fi

	# Always test and reload, even when the file already says so: that is what makes this the repair
	# for a run that died between writing the file and reloading nginx.
	if nginx_test && nginx_reload && wait_for_upstream "$expect"; then
		info "nginx sends customers to $expect ($target)"
		return 0
	fi

	err "switching to $target failed (${LAST_PROBE:-nginx did not take the file}) — putting the previous file back"
	install_file "$old" "$UPSTREAM_FILE" || { err "COULD NOT PUT $UPSTREAM_FILE BACK — nginx may be in an unknown state"; return 2; }
	# The reload is only half of it: wait until nginx is answering from where it answered before.
	if nginx_test && nginx_reload && wait_for_upstream "$previous_expect"; then
		info "previous file is back and loaded: customers are served by $previous_expect ($previous)"
		return 1
	fi
	err "the previous file is back on disk but nginx is not confirmed to serve it (${LAST_PROBE:-it did not reload}) — nginx may be in an unknown state"
	return 2
}

cmd_setup() {
	local apply=0 state count new_site new_up backup
	[[ "${1:-}" == "--apply" ]] && apply=1
	[[ -f "$SITE_FILE" ]] || die "$SITE_FILE not found"

	state=$(current_state)
	if site_wired && [[ "$state" != absent ]]; then
		info "already installed (state: $state) — nothing to do"
		return 0
	fi
	[[ "$state" == absent ]] || die "$UPSTREAM_FILE exists ($state) but $SITE_FILE does not use it — repair by hand, or: $0 revert --apply"
	! site_wired || die "$SITE_FILE already names ${UPSTREAM_NAME} but $UPSTREAM_FILE is missing — repair by hand, or: $0 revert --apply"

	count=$(grep -cF "proxy_pass http://${CANONICAL_ADDR};" "$SITE_FILE" || true)
	[[ "$count" == "1" ]] || die "expected exactly one 'proxy_pass http://${CANONICAL_ADDR};' in $SITE_FILE, found $count — edit it by hand"
	if port_busy "$PROBE_ADDR"; then
		die "$PROBE_ADDR is already in use — the loopback listener needs it (PROBE_ADDR=host:port picks another)"
	fi

	new_site=$(new_tmp)
	new_up=$(new_tmp)
	sed "s|proxy_pass http://${CANONICAL_ADDR//./\\.};|proxy_pass http://${UPSTREAM_NAME};|" "$SITE_FILE" >"$new_site"
	render_upstream canonical-only >"$new_up"

	info "$SITE_FILE would change like this:"
	diff -u "$SITE_FILE" "$new_site" || true
	info "$UPSTREAM_FILE would be created:"
	sed 's/^/    /' "$new_up"
	if (( apply == 0 )); then
		info "dry run — nothing was changed. Run with --apply to install."
		return 0
	fi

	backup="${SITE_FILE}.pre-upstream-$(date -u +%Y%m%dT%H%M%SZ)"
	$SUDO cp -p -- "$SITE_FILE" "$backup" || die "could not back $SITE_FILE up"
	info "backup: $backup"
	install_file "$new_up" "$UPSTREAM_FILE"
	install_file "$new_site" "$SITE_FILE"

	if nginx_test && nginx_reload && wait_for_upstream "$CANONICAL_ADDR" && check_public; then
		info "installed. The resting state is canonical-only, which sends customers exactly where they went before."
		return 0
	fi

	err "install failed (${LAST_PROBE:-see above}) — putting the original back"
	install_file "$backup" "$SITE_FILE" || { err "COULD NOT RESTORE $SITE_FILE (backup: $backup)"; return 2; }
	$SUDO rm -f -- "$UPSTREAM_FILE"
	if nginx_test && nginx_reload; then
		info "original configuration is back and loaded"
		return 1
	fi
	err "the original is back on disk but nginx did not reload it — nginx may be in an unknown state"
	return 2
}

cmd_revert() {
	local apply=0 backup
	[[ "${1:-}" == "--apply" ]] && apply=1
	backup=$(ls -1 "${SITE_FILE}".pre-upstream-* 2>/dev/null | sort | tail -1 || true)
	[[ -n "$backup" ]] || die "no ${SITE_FILE}.pre-upstream-* backup to go back to"
	info "would restore $backup over $SITE_FILE and remove $UPSTREAM_FILE:"
	diff -u "$SITE_FILE" "$backup" || true
	if (( apply == 0 )); then
		info "dry run — nothing was changed. Run with --apply."
		return 0
	fi
	install_file "$backup" "$SITE_FILE"
	$SUDO rm -f -- "$UPSTREAM_FILE"
	if nginx_test && nginx_reload && check_public; then
		info "reverted: nginx proxies straight to $CANONICAL_ADDR again"
		return 0
	fi
	err "revert did not verify — check nginx by hand (backup: $backup)"
	return 2
}

cmd_probe() {
	probe_once
	printf '\n'
}

case "${1:-}" in
	status)  cmd_status ;;
	probe)   cmd_probe ;;
	set)     shift; cmd_set "$@" ;;
	setup)   shift; cmd_setup "$@" ;;
	revert)  shift; cmd_revert "$@" ;;
	-h|--help|"") usage ;;
	*) die "unknown command: $1 (try --help)" ;;
esac
