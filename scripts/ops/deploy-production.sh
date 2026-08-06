#!/usr/bin/env bash
#
# Production deploy for the MAKY.STORE storefront.
#
# Canonical procedure: CLAUDE.md §13. This script IS that procedure — the order of the
# steps is what makes them safe, so run the script rather than the steps.
#
# Run on the production box, in /opt/storefront, as `ubuntu`. Never as root: a root build
# leaves .next root-owned and PM2 (running as ubuntu) can no longer write its ISR cache.
#
#   ./scripts/ops/deploy-production.sh --dry-run
#   ./scripts/ops/deploy-production.sh -m "M.2 CMS block renderers"
#
# Exit codes
#   0   deployed and verified
#   1   failed before the commit point — the previous build was restored
#   70  internal state error — restored, and the script is at fault
#   71  CRITICAL: the deploy failed AND the restore failed; the site may be down
#   75  deployed and verified, but a post-deploy step (external check, log, prune) failed
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/storefront}"
ROLLBACK_DIR="${ROLLBACK_DIR:-/opt/storefront-rollbacks}"
PM2_APP="${PM2_APP:-maky-storefront}"          # never maky-smtp-app: separate service, transactional mail
LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3000}"
PUBLIC_HOST="${PUBLIC_HOST:-maky.store}"
PUBLIC_URL="${PUBLIC_URL:-https://${PUBLIC_HOST}}"
NGINX_LOCAL_IP="${NGINX_LOCAL_IP:-127.0.0.1}"
SMOKE_PATH="${SMOKE_PATH:-/sk}"
DEPLOY_LOG="${DEPLOY_LOG:-/opt/DEPLOYMENTS.log}"
LOCK_FILE="${LOCK_FILE:-/run/lock/maky-storefront-deploy.lock}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-2}"
MIN_FREE_MEM_MB="${MIN_FREE_MEM_MB:-10240}"
MIN_FREE_DISK_MB="${MIN_FREE_DISK_MB:-10240}"
READY_TIMEOUT_S="${READY_TIMEOUT_S:-120}"
RESTORE_TIMEOUT_S="${RESTORE_TIMEOUT_S:-60}"
MIN_ASSET_BYTES="${MIN_ASSET_BYTES:-1000}"
EXTERNAL_RETRIES="${EXTERNAL_RETRIES:-3}"
EXTERNAL_RETRY_SLEEP_S="${EXTERNAL_RETRY_SLEEP_S:-5}"

DRY_RUN=0
NOTE=""

# --- state the failure handler needs -----------------------------------------------
SNAPSHOT=""            # absolute path of the moved-out .next; empty until it is moved
COMMITTED=0            # 1 once the local gate has passed — after this, never roll back
POST_DEPLOY_FAILED=0   # a post-commit step failed; the new build stays live
SUDO_KEEPALIVE_PID=""
TMP_FILES=()
DOWN_FROM=0
DOWNTIME=0
AVAIL_MEM_MB="?"
PREV_BUILD_ID="none"
PREV_SHA="unknown"
BUILD_LOG="/tmp/maky-deploy-$(date -u +%Y%m%d-%H%M%S).log"

c_red=$'\033[31m'; c_yel=$'\033[33m'; c_grn=$'\033[32m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
info() { printf '%s==>%s %s\n' "$c_grn" "$c_off" "$*"; }
step() { printf '\n%s=== %s ===%s\n' "$c_dim" "$*" "$c_off"; }
warn() { printf '%swarn:%s %s\n' "$c_yel" "$c_off" "$*" >&2; }
err()  { printf '%serror:%s %s\n' "$c_red" "$c_off" "$*" >&2; }
die()  { err "$*"; exit 1; }

usage() {
	sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
	cat <<-EOF

	Options:
	  -m, --note TEXT   what is going out and why (recorded in $DEPLOY_LOG)
	      --dry-run     run preflight, print the plan, change nothing
	  -h, --help        this text

	There is deliberately no --allow-dirty: a deploy from an uncommitted tree would
	record a git_sha in MAKY_DEPLOY_META that does not describe what was built.
	EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-m|--note) NOTE="${2:-}"; shift 2 ;;
		--dry-run) DRY_RUN=1; shift ;;
		-h|--help) usage; exit 0 ;;
		*)         die "unknown argument: $1 (try --help)" ;;
	esac
done

# --- sudo ----------------------------------------------------------------------------
# The restore path needs sudo. If a password were required and the timestamp expired
# during a long build, the recovery would stop to ask for one with the site already down.
#
# Probe with `sudo -n true`, never with `sudo -v`. `-v` *validates credentials*, and that
# asks for a password even under NOPASSWD — the rule exempts running commands, not
# authenticating. On this box (`ubuntu`, NOPASSWD from cloud-init) `sudo -n true` succeeds
# while `sudo -n -v` answers "a password is required", so probing with `-v` killed
# preflight on a box where sudo was never actually a problem.
ensure_sudo() {
	if sudo -n true 2>/dev/null; then
		info "sudo is passwordless — no keepalive needed"
		return 0
	fi
	sudo -v || die "sudo is required (snapshot moves into $ROLLBACK_DIR, and $DEPLOY_LOG)"
	# A password is required here, so the ticket can expire mid-build. Each successful
	# `sudo -n true` extends it; `-v` would prompt again and is unusable non-interactively.
	local parent=$$
	(
		while kill -0 "$parent" 2>/dev/null; do
			sudo -n true 2>/dev/null || exit 1
			sleep 50
		done
	) &
	SUDO_KEEPALIVE_PID=$!
	info "sudo needs a password — keeping the ticket warm (pid $SUDO_KEEPALIVE_PID)"
}

stop_sudo_keepalive() {
	if [[ -n "$SUDO_KEEPALIVE_PID" ]]; then
		# Children first: killing the loop alone would orphan its `sleep`, which then
		# lingers for up to a minute after the deploy has finished.
		pkill -P "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
		kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
		SUDO_KEEPALIVE_PID=""
	fi
}

# --- failure handling ---------------------------------------------------------------
cleanup_tmp() {
	local f
	for f in ${TMP_FILES+"${TMP_FILES[@]}"}; do
		rm -f "$f"
	done
	TMP_FILES=()
}

# Restore the build that was moved out. Used only before the commit point.
# `mv` (not `cp -a`): this snapshot is the artifact we just displaced, nothing else
# refers to it, and mv is instant and preserves ownership. Historical snapshots are
# restored with `cp -a` so they survive — see CLAUDE.md §13.3.
restore() {
	if [[ -z "$SNAPSHOT" ]]; then
		info "nothing was moved out — the live build is untouched"
		return 0
	fi
	if [[ ! -d "$SNAPSHOT" ]]; then
		err "snapshot $SNAPSHOT is gone — MANUAL RECOVERY REQUIRED"
		err "  ls $ROLLBACK_DIR   then follow CLAUDE.md §13.3"
		return 1
	fi

	if [[ -e "$APP_DIR/.next" ]]; then
		info "discarding the partial build (its log is at $BUILD_LOG)"
		rm -rf "${APP_DIR:?}/.next"
	fi

	info "restoring $(basename "$SNAPSHOT")"
	sudo mv -T -- "$SNAPSHOT" "$APP_DIR/.next" || { err "could not move the snapshot back"; return 1; }
	SNAPSHOT=""
	# A pin marker must never ride back into the live tree and pin the next snapshot.
	rm -f "$APP_DIR/.next/.keep"

	pm2 start "$PM2_APP" >/dev/null 2>&1 || pm2 restart "$PM2_APP" >/dev/null 2>&1 || true
	if wait_ready "$RESTORE_TIMEOUT_S"; then
		info "previous build is back up"
		return 0
	fi
	err "RESTORE DID NOT COME UP — the site is down, intervene now"
	err "  pm2 logs $PM2_APP --nostream --lines 50"
	return 1
}

on_exit() {
	local code=$?
	trap - EXIT
	stop_sudo_keepalive
	cleanup_tmp

	# Past the commit point the new build is live and verified. A failure in logging,
	# pruning or an external check is a post-deploy problem — never a reason to throw
	# away a good deploy.
	if (( COMMITTED == 1 )); then
		if (( code != 0 )); then
			err "the new build is deployed and verified, but a post-deploy step failed (exit $code)"
			err "NOT rolling back."
		fi
		exit "$code"
	fi

	if (( code == 0 )); then
		err "INTERNAL STATE ERROR: the script ended before the commit point without an error code"
		code=70
	fi

	err "deploy failed before the commit point (exit $code) — restoring the previous build"
	if ! restore; then
		err "CRITICAL: the deploy failed AND the restore failed"
		err "build log: $BUILD_LOG"
		exit 71
	fi
	err "build log: $BUILD_LOG"
	exit "$code"
}
trap 'exit 130' INT TERM
trap on_exit EXIT

# --- helpers -------------------------------------------------------------------------
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$@" 2>/dev/null || echo 000; }

new_tmp() {
	local f
	f=$(mktemp)
	TMP_FILES+=("$f")
	printf '%s' "$f"
}

# 200 with a body worth having. A 200 serving an empty file is still a broken site.
# Extra curl arguments (e.g. --resolve) may be appended.
fetch_ok() {
	local url="$1"; shift
	local out code size
	out=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 25 "$@" "$url" 2>/dev/null) || out="000 0"
	code="${out%% *}"; size="${out##* }"
	if [[ "$code" == "200" ]] && (( size >= MIN_ASSET_BYTES )); then
		info "ok  $url  (${size} B)"
		return 0
	fi
	LAST_FETCH_DETAIL="HTTP $code, ${size} B"
	return 1
}

require_local() {
	local url="$1"; shift
	fetch_ok "$url" "$@" || die "$url → ${LAST_FETCH_DETAIL:-unreachable}"
}

# Post-commit checks retry: one network blip must not be reported as a broken deploy.
check_external() {
	local label="$1" url="$2"; shift 2
	local attempt
	for ((attempt = 1; attempt <= EXTERNAL_RETRIES; attempt++)); do
		if fetch_ok "$url" "$@"; then
			return 0
		fi
		if (( attempt < EXTERNAL_RETRIES )); then
			warn "$label: ${LAST_FETCH_DETAIL:-unreachable} (attempt ${attempt}/${EXTERNAL_RETRIES})"
			sleep "$EXTERNAL_RETRY_SLEEP_S"
		fi
	done
	warn "$label FAILED after ${EXTERNAL_RETRIES} attempts: $url → ${LAST_FETCH_DETAIL:-unreachable}"
	return 1
}

wait_ready() {
	local budget="${1:-$READY_TIMEOUT_S}" i
	for ((i = 0; i < budget; i++)); do
		if [[ "$(http_code "$LOCAL_URL$SMOKE_PATH")" == "200" ]]; then
			return 0
		fi
		sleep 1
	done
	return 1
}

soft() {
	local label="$1"; shift
	if "$@"; then
		return 0
	fi
	POST_DEPLOY_FAILED=1
	warn "post-deploy step failed: ${label} — the new build stays live"
	return 0
}

# --- steps ---------------------------------------------------------------------------
take_lock() {
	# Claude, Codex and a human all work on this box. Two concurrent deploys would stop
	# PM2 twice, displace each other's .next and roll each other back.
	local dir
	dir=$(dirname "$LOCK_FILE")
	[[ -d "$dir" ]] || LOCK_FILE="${TMPDIR:-/tmp}/$(basename "$LOCK_FILE")"
	exec 9>"$LOCK_FILE" || die "cannot open lock file $LOCK_FILE"
	flock -n 9 || die "another storefront deploy is already running (lock: $LOCK_FILE)"
}

preflight() {
	step "preflight"

	[[ "${EUID:-$(id -u)}" -ne 0 ]] || die "run as ubuntu, not root — a root build makes .next unwritable for PM2"
	[[ "$APP_DIR" == /* ]] || die "APP_DIR must be an absolute path, got '$APP_DIR'"
	[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR is not a git checkout"
	cd "$APP_DIR"

	[[ -z "${NEXT_OUTPUT:-}" ]] || die "NEXT_OUTPUT='$NEXT_OUTPUT' is set — production runs in normal mode (CLAUDE.md §13.6); unset it"

	local cmd
	for cmd in pnpm pm2 curl git flock awk; do
		command -v "$cmd" >/dev/null || die "$cmd not found in PATH"
	done
	pm2 describe "$PM2_APP" >/dev/null 2>&1 || die "PM2 knows no app called '$PM2_APP'"

	ensure_sudo
	[[ -d "$ROLLBACK_DIR" ]] || { info "creating $ROLLBACK_DIR"; sudo mkdir -p "$ROLLBACK_DIR"; }

	local avail_disk
	AVAIL_MEM_MB=$(free -m | awk '/^Mem:/ {print $7}')
	avail_disk=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
	info "memory available: ${AVAIL_MEM_MB} MB   disk free: ${avail_disk} MB"
	(( AVAIL_MEM_MB >= MIN_FREE_MEM_MB )) || die "only ${AVAIL_MEM_MB} MB of memory available, need ${MIN_FREE_MEM_MB} (stop the agents, or override MIN_FREE_MEM_MB for this run)"
	(( avail_disk >= MIN_FREE_DISK_MB )) || die "only ${avail_disk} MB of disk free, need ${MIN_FREE_DISK_MB}"

	if [[ -n "$(git status --porcelain)" ]]; then
		git status --short | head -20 >&2
		die "working tree is dirty — commit first; a deploy from an uncommitted tree records a git_sha that does not describe what was built"
	fi

	# What is deployed right now, read from the artifact rather than from git HEAD:
	# HEAD is the commit about to be built, the live .next came from an earlier one.
	if [[ -f "$APP_DIR/.next/BUILD_ID" ]]; then
		PREV_BUILD_ID=$(cat "$APP_DIR/.next/BUILD_ID")
	elif [[ "${ALLOW_NO_BASELINE:-0}" == "1" ]]; then
		warn "no current .next/BUILD_ID — deploying without a rollback point (ALLOW_NO_BASELINE=1)"
	else
		die "no .next/BUILD_ID in $APP_DIR — there is nothing to snapshot, so this deploy would have no rollback.
Restore a snapshot first (CLAUDE.md §13.3), or set ALLOW_NO_BASELINE=1 for a one-off bootstrap."
	fi
	if [[ -f "$APP_DIR/.next/MAKY_DEPLOY_META" ]]; then
		PREV_SHA=$(awk -F= '/^git_sha=/ {print substr($2, 1, 7)}' "$APP_DIR/.next/MAKY_DEPLOY_META")
		[[ -n "$PREV_SHA" ]] || PREV_SHA="unknown"
	else
		warn "the live build has no MAKY_DEPLOY_META — its commit is unknown, the snapshot will say so"
	fi

	info "deploying $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD)) — $(git log -1 --format=%s)"
	info "currently serving BUILD_ID $PREV_BUILD_ID from $PREV_SHA"
	# Printed here so a --dry-run shows it too. Confirmed against the running
	# process after the gate, by check_market_state.
	info "indexable markets requested by .env: $(market_state_from_env)"
	ps -eo pid,comm,rss --sort=-rss | head -5
}

snapshot_name() {
	printf '%s/.next.rollback-%s-%s-%s' "$ROLLBACK_DIR" "$PREV_SHA" "$PREV_BUILD_ID" "$(date -u +%Y%m%dT%H%M%SZ)"
}

snapshot() {
	step "stop + snapshot"
	DOWN_FROM=$(date +%s)
	pm2 stop "$PM2_APP" >/dev/null
	info "$PM2_APP stopped — downtime starts now"

	[[ -e "$APP_DIR/.next" ]] || { warn "no .next to snapshot"; return 0; }

	local name
	name=$(snapshot_name)
	[[ ! -e "$name" ]] || die "snapshot already exists: $name"
	# -T so an existing target is never treated as a directory to nest .next inside.
	sudo mv -T -- "$APP_DIR/.next" "$name"
	SNAPSHOT="$name"
	info "snapshot: $(basename "$SNAPSHOT")"
}

build() {
	step "build"
	info "log: $BUILD_LOG"
	# Snapshotting by mv left no .next, so the build starts with a cold fetch cache —
	# deliberate, see CLAUDE.md §13.2.
	if ! pnpm build 2>&1 | tee "$BUILD_LOG"; then
		die "pnpm build failed — see $BUILD_LOG"
	fi
	[[ -f "$APP_DIR/.next/BUILD_ID" ]] || die "build finished but there is no .next/BUILD_ID"
	info "new BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID")"
}

write_meta() {
	step "metadata"
	# BUILD_ID alone does not say which commit produced it, and git HEAD may have moved
	# on since. This travels with the artifact into the rollback directory, so the next
	# deploy can name its snapshot correctly and a rollback knows which sha to check out.
	{
		echo "git_sha=$(git rev-parse HEAD)"
		echo "git_ref=$(git rev-parse --abbrev-ref HEAD)"
		echo "git_subject=$(git log -1 --format=%s)"
		echo "build_id=$(cat "$APP_DIR/.next/BUILD_ID")"
		echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
		echo "built_by=$(id -un)@$(hostname)"
		echo "node=$(node -v 2>/dev/null || echo unknown)"
	} > "$APP_DIR/.next/MAKY_DEPLOY_META"
	cat "$APP_DIR/.next/MAKY_DEPLOY_META"
}

start() {
	step "start"
	pm2 start "$PM2_APP" >/dev/null
	wait_ready || die "$PM2_APP did not answer on $LOCAL_URL$SMOKE_PATH within ${READY_TIMEOUT_S}s"
	info "responding on $LOCAL_URL$SMOKE_PATH"
}

# The rollback gate. Only things the artifact itself controls belong here: if nginx or
# the public network is broken, swapping the build back does not fix it and would throw
# away a verified artifact for nothing.
gate_local() {
	step "gate — local artifact"
	local html css disk_css
	html=$(new_tmp)

	curl -fsS --max-time 25 "$LOCAL_URL$SMOKE_PATH" -o "$html" || die "local page did not respond"

	# Next 16 / Turbopack emits stylesheets under /_next/static/chunks/, NOT
	# /_next/static/css/. Anchoring on the latter matches nothing on a healthy page —
	# verified against live production, 2026-08-01.
	css=$(grep -oE '/_next/static/[^"]+\.css' "$html" | head -1 || true)
	[[ -n "$css" ]] || die "no CSS chunk referenced in the served HTML — the page would render unstyled"

	# The chunk the server advertises must exist in the build we just made. This is the
	# direct test for the stale-chunk failure in §13.1.
	disk_css="$APP_DIR/.next/${css#/_next/}"
	[[ -f "$disk_css" ]] || die "served CSS $css is not present in this build ($disk_css)"

	require_local "$LOCAL_URL$SMOKE_PATH"
	require_local "$LOCAL_URL$css"

	CSS_PATH="$css"
	DOWNTIME=$(( $(date +%s) - DOWN_FROM ))
	COMMITTED=1
	info "local gate passed — downtime ${DOWNTIME}s. From here the new build stays."
}

# Post-commit. Failures are reported, never rolled back.
verify_external() {
	step "verify — nginx and the public URL"
	local ok=0
	# nginx with the real Host/SNI, but pinned to the local address so the check does not
	# depend on public DNS or routing.
	check_external "nginx (local, Host: $PUBLIC_HOST)" "${PUBLIC_URL}${SMOKE_PATH}" \
		--resolve "${PUBLIC_HOST}:443:${NGINX_LOCAL_IP}" || ok=1
	check_external "public page" "${PUBLIC_URL}${SMOKE_PATH}" || ok=1
	check_external "public CSS" "${PUBLIC_URL}${CSS_PATH}" || ok=1
	if (( ok != 0 )); then
		warn "the artifact is verified locally — investigate nginx / DNS / network, not the build"
		return 1
	fi
	return 0
}

# Which markets came up indexable, read back from the process rather than assumed.
#
# MAKY_LIVE_MARKETS decides who Google may index. A misreading of it is invisible
# from the outside — the site is up either way — so the app prints its resolved
# split at boot (src/instrumentation.ts) and this compares that line with what
# .env asked for. A post-deploy check, not a rollback gate: the artifact is fine,
# the configuration is what is wrong, and exit 75 says exactly that.
market_state_from_env() {
	local envfile="$APP_DIR/.env"
	if [[ -f "$envfile" ]] && grep -q '^MAKY_LIVE_MARKETS=' "$envfile"; then
		grep '^MAKY_LIVE_MARKETS=' "$envfile" | tail -1 |
			sed -e 's/^MAKY_LIVE_MARKETS=//' -e 's/^["'\'']//' -e 's/["'\'']$//' |
			tr 'A-Z' 'a-z' | tr -d ' ' | tr ',' '\n' | grep -v '^$' | sort -u | paste -sd, -
	else
		printf 'sk'   # the built-in default in src/lib/market-state.ts
	fi
}

check_market_state() {
	local line got unknown want
	line=$(pm2 logs "$PM2_APP" --nostream --lines 400 2>/dev/null |
		grep -o '\[market-state\] live=[^ ]* preview=[^ ]* unknown=[^ ]*' | tail -1)

	if [[ -z "$line" ]]; then
		err "no [market-state] line in the PM2 log — cannot confirm which markets are indexable"
		return 1
	fi
	info "$line"

	unknown=$(sed -n 's/.*unknown=\([^ ]*\).*/\1/p' <<<"$line")
	if [[ -n "$unknown" ]]; then
		err "MAKY_LIVE_MARKETS names something that is not a market: ${unknown} — it was ignored, fix $APP_DIR/.env"
		return 1
	fi

	got=$(sed -n 's/.*live=\([^ ]*\).*/\1/p' <<<"$line" | tr ',' '\n' | grep -v '^$' | sort -u | paste -sd, -)
	want=$(market_state_from_env)
	if [[ "$got" != "$want" ]]; then
		err "indexable markets in use ($got) do not match $APP_DIR/.env ($want)"
		return 1
	fi

	info "indexable markets confirmed: ${got:-none}"
}

write_deploy_log() {
	step "record"
	local snap_name="none"
	if [[ -n "$SNAPSHOT" ]]; then
		snap_name=$(basename "$SNAPSHOT")
	fi
	{
		echo ""
		echo "=== $(date -Is) ==="
		echo "git:      $(git rev-parse --short HEAD)  $(git log -1 --format=%s)"
		echo "BUILD_ID: $(cat "$APP_DIR/.next/BUILD_ID")"
		echo "built:    $(stat -c %y "$APP_DIR/.next/BUILD_ID")"
		echo "previous: ${PREV_BUILD_ID} from ${PREV_SHA}"
		echo "snapshot: ${snap_name}"
		echo "downtime: ${DOWNTIME}s"
		echo "mem_free: ${AVAIL_MEM_MB} MB at preflight"
		echo "note:     ${NOTE:-<none>}"
	} | sudo tee -a "$DEPLOY_LOG" >/dev/null || return 1
	info "appended to $DEPLOY_LOG"
}

prune() {
	step "prune snapshots"
	local -a snaps=()
	mapfile -t snaps < <(find "$ROLLBACK_DIR" -maxdepth 1 -mindepth 1 -type d -name '.next.rollback-*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{print $2}')
	local kept=0 rc=0 s
	for s in ${snaps+"${snaps[@]}"}; do
		# The pin marker is a sidecar, never a file inside the snapshot: a marker inside
		# would ride back into the live tree on a restore and pin the wrong snapshot next
		# time round.
		if [[ -e "${s}.keep" ]]; then
			info "pinned, keeping: $(basename "$s")"
			continue
		fi
		kept=$(( kept + 1 ))
		if (( kept > KEEP_SNAPSHOTS )); then
			if [[ "$s" != "$ROLLBACK_DIR/.next.rollback-"* ]]; then
				warn "refusing to remove an unexpected path: $s"
				rc=1
				continue
			fi
			info "pruning: $(basename "$s")"
			sudo rm -rf -- "$s" || rc=1
		fi
	done
	return "$rc"
}

# --- main ----------------------------------------------------------------------------
take_lock
preflight

if (( DRY_RUN == 1 )); then
	step "dry run — nothing was changed"
	cat <<-EOF
	Would, in this order:
	  pm2 stop $PM2_APP
	  sudo mv -T $APP_DIR/.next $(snapshot_name)
	  pnpm build
	  write $APP_DIR/.next/MAKY_DEPLOY_META
	  pm2 start $PM2_APP
	  gate (rollback if it fails):  $LOCAL_URL$SMOKE_PATH + its CSS chunk, on disk and over HTTP
	  verify (warn only):           nginx via --resolve, then $PUBLIC_URL
	  append to $DEPLOY_LOG
	  keep the newest $KEEP_SNAPSHOTS snapshots (plus any with a <snapshot>.keep sidecar)
	Up to the gate, any failure restores the snapshot and restarts PM2.
	After the gate, nothing rolls back.
	EOF
	COMMITTED=1
	exit 0
fi

snapshot
build
write_meta
start
gate_local

soft "external verification" verify_external
soft "market state"         check_market_state
soft "deployment log"       write_deploy_log
soft "snapshot pruning"     prune

step "done"
info "deployed $(git rev-parse --short HEAD) as BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID") — downtime ${DOWNTIME}s"
warn "now look at $PUBLIC_URL$SMOKE_PATH in a browser: automated checks cannot see a colourless button (§4.2)"

if (( POST_DEPLOY_FAILED == 1 )); then
	err "the build is live and verified locally, but at least one post-deploy step failed (see above)"
	exit 75
fi
