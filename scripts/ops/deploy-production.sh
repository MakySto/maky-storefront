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
#   ./scripts/ops/deploy-production.sh --rehearse
#   ./scripts/ops/deploy-production.sh -m "M.2 CMS block renderers"
#
# Three ways to switch, picked by --mode (default auto: bridge if nginx has been prepared by
# scripts/ops/nginx-upstream.sh, otherwise restart). All three build the new version in a scratch
# tree next to the live one, never under the running server.
#
#   bridge    the new build runs on a spare port and is fully gated while nobody sees it; nginx is
#             pointed at it, the live process is swapped onto the same build, gated again, and nginx
#             goes back. Customers see no error. This is the default once nginx is prepared.
#   restart   stop the live process, install the finished build, start it: a gap of the few seconds
#             the server takes to boot. Needs nothing from nginx.
#   classic   the old flow: stop, build in place, start. 3 to 4 minutes of 502.
#
# --rehearse builds aside, runs the build on the spare port, gates it, and removes everything again.
# It switches nothing and touches neither the live process nor nginx.
#
# Exit codes
#   0   deployed and verified
#   1   failed before the commit point — the previous build was restored
#   70  internal state error — restored, and the script is at fault
#   71  CRITICAL: the deploy failed AND the restore failed; the site may be down (in bridge mode it
#       may instead be running on the bridge: the message says which)
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
ASSET_GATE_CATEGORY_PATH="${ASSET_GATE_CATEGORY_PATH:-${SMOKE_PATH%/}/stresne-nosice}"
ASSET_GATE_PDP_PATH="${ASSET_GATE_PDP_PATH:-}"
DEPLOY_LOG="${DEPLOY_LOG:-/opt/DEPLOYMENTS.log}"
LOCK_FILE="${LOCK_FILE:-/run/lock/maky-storefront-deploy.lock}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-2}"
MIN_FREE_MEM_MB="${MIN_FREE_MEM_MB:-10240}"
MIN_FREE_DISK_MB="${MIN_FREE_DISK_MB:-10240}"
READY_TIMEOUT_S="${READY_TIMEOUT_S:-120}"
RESTORE_TIMEOUT_S="${RESTORE_TIMEOUT_S:-60}"
MIN_ASSET_BYTES="${MIN_ASSET_BYTES:-1000}"
# A floor, not an assertion of the exact count: the catalogue grows. 481 URLs on
# 2026-08-06 with one live market. Raise it as markets go live.
MIN_SITEMAP_URLS="${MIN_SITEMAP_URLS:-400}"
EXTERNAL_RETRIES="${EXTERNAL_RETRIES:-3}"
EXTERNAL_RETRY_SLEEP_S="${EXTERNAL_RETRY_SLEEP_S:-5}"

# The build is made in a scratch tree beside $APP_DIR (same filesystem, so installing it is a rename).
BUILD_DIR="${BUILD_DIR:-/opt/storefront-build}"
BUILD_NICE="${BUILD_NICE:-10}"                  # the live process keeps the CPU while the build runs
BRIDGE_APP="${BRIDGE_APP:-maky-storefront-bridge}"
BRIDGE_PORT="${BRIDGE_PORT:-3100}"
BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:${BRIDGE_PORT}}"
CANONICAL_ADDR="${CANONICAL_ADDR:-${LOCAL_URL#*://}}"
BRIDGE_ADDR="${BRIDGE_ADDR:-${BRIDGE_URL#*://}}"
PROBE_ADDR="${PROBE_ADDR:-127.0.0.1:3199}"      # nginx's loopback listener, same upstream as the public one
NGINX_TOOL="${NGINX_TOOL:-$(dirname "${BASH_SOURCE[0]}")/nginx-upstream.sh}"
DRAIN_TIMEOUT_S="${DRAIN_TIMEOUT_S:-20}"
PROBE_INTERVAL_S="${PROBE_INTERVAL_S:-0.5}"
PROBE_MAX_ITERATIONS="${PROBE_MAX_ITERATIONS:-2400}"   # a probe nobody stopped ends by itself

DRY_RUN=0
REHEARSE=0
MODE="${DEPLOY_MODE:-auto}"
NOTE=""

# --- state the failure handler needs -----------------------------------------------
SNAPSHOT=""            # absolute path of the moved-out .next; empty until it is moved
COMMITTED=0            # 1 once the local gate has passed — after this, never roll back
POST_DEPLOY_FAILED=0   # a post-commit step failed; the new build stays live
POST_DEPLOY_FAILED_STEPS=()   # and their labels — exit 75 must name the step, not point at the log
SUDO_KEEPALIVE_PID=""
TMP_FILES=()
DOWN_FROM=0
DOWNTIME=0
AVAIL_MEM_MB="?"
PREV_BUILD_ID="none"
PREV_SHA="unknown"
DEPLOY_SHA=""           # the commit this run builds, read once: another checkout on this box must not change it midway
MARKET_LOG_FILE=""      # PM2 stdout log for $PM2_APP, resolved just before start
MARKET_LOG_OFFSET=0     # its size in bytes at that moment — this boot's log boundary
BUILD_LOG="${BUILD_LOG:-/tmp/maky-deploy-$(date -u +%Y%m%d-%H%M%S).log}"
CSS_PATH=""
declare -A CHECKED_BUILD_ASSETS=()

# What the gate looks at. The canonical process and the bridge run the same gate, so it takes its
# target from here: classic and restart gate $LOCAL_URL / $APP_DIR, the bridge gates $BRIDGE_URL / $BUILD_DIR.
GATE_URL="$LOCAL_URL"
GATE_DIR="$APP_DIR"

# --- state for the build-aside flows -----------------------------------------------------
FLOW=""                 # classic | restart | bridge | rehearse — resolved after preflight
FLOW_REASON=""          # why auto picked it, for the dry run and the log
CANONICAL_STOPPED=0     # 1 between stopping $PM2_APP and seeing it answer again
SCRATCH=0               # 1 while $BUILD_DIR holds a tree this run made
BRIDGE_UP=0             # 1 while the bridge app is registered with PM2
UPSTREAM_TOUCHED=0      # 1 once this run has asked nginx to switch, so it knows to look before it leaves
RELEASE_FAILED=0        # 1 once nginx would not take customers back: the exit handler does not ask a second time
NEW_NEXT=""             # the finished build waiting to be installed into $APP_DIR/.next
PROBE_PID=""
PROBE_FILE=""
PROBE_SUMMARY=""

c_red=$'\033[31m'; c_yel=$'\033[33m'; c_grn=$'\033[32m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
info() { printf '%s==>%s %s\n' "$c_grn" "$c_off" "$*"; }
step() { printf '\n%s=== %s ===%s\n' "$c_dim" "$*" "$c_off"; }
warn() { printf '%swarn:%s %s\n' "$c_yel" "$c_off" "$*" >&2; }
err()  { printf '%serror:%s %s\n' "$c_red" "$c_off" "$*" >&2; }
die()  { err "$*"; exit 1; }

usage() {
	sed -n '3,/^set -euo pipefail$/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'
	cat <<-EOF

	Options:
	  -m, --note TEXT   what is going out and why (recorded in $DEPLOY_LOG)
	      --mode MODE   auto (default), bridge, restart or classic
	      --classic     same as --mode classic
	      --rehearse    build aside and gate it on the spare port; switch nothing
	      --dry-run     run preflight, print the plan, change nothing
	  -h, --help        this text

	There is deliberately no --allow-dirty: a deploy from an uncommitted tree would
	record a git_sha in MAKY_DEPLOY_META that does not describe what was built.
	EOF
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
			-m|--note) NOTE="${2:-}"; shift 2 ;;
			--mode)    MODE="${2:-}"; shift 2 ;;
			--classic) MODE="classic"; shift ;;
			--rehearse) REHEARSE=1; shift ;;
			--dry-run) DRY_RUN=1; shift ;;
			-h|--help) usage; exit 0 ;;
			*)         die "unknown argument: $1 (try --help)" ;;
		esac
	done
	case "$MODE" in
		auto|bridge|restart|classic) ;;
		*) die "unknown mode '$MODE' (auto, bridge, restart or classic)" ;;
	esac
}

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

# Put the displaced build back. Used only before the commit point.
# `mv` (not `cp -a`): this snapshot is the artifact we just displaced, nothing else
# refers to it, and mv is instant and preserves ownership. Historical snapshots are
# restored with `cp -a` so they survive — see CLAUDE.md §13.3.
restore_canonical() {
	if [[ -z "$SNAPSHOT" ]]; then
		if (( CANONICAL_STOPPED == 1 )); then
			# Stopped, but nothing had been moved out yet: the old build is still in place.
			info "$PM2_APP was stopped before the snapshot — starting the untouched build again"
			pm2 start "$PM2_APP" >/dev/null 2>&1 || pm2 restart "$PM2_APP" >/dev/null 2>&1 || true
			if wait_ready "$RESTORE_TIMEOUT_S"; then
				CANONICAL_STOPPED=0
				info "previous build is back up"
				return 0
			fi
			err "$PM2_APP DID NOT COME UP — intervene now"
			err "  pm2 logs $PM2_APP --nostream --lines 50"
			return 1
		fi
		info "nothing was moved out — the live build is untouched"
		return 0
	fi
	if [[ ! -d "$SNAPSHOT" ]]; then
		err "snapshot $SNAPSHOT is gone — MANUAL RECOVERY REQUIRED"
		err "  ls $ROLLBACK_DIR   then follow CLAUDE.md §13.3"
		return 1
	fi

	# The start step may already have run. A live server keeps writing ISR shells into
	# .next/server/app, so `rm -rf` fails with "Directory not empty", the snapshot cannot
	# move back, and PM2 goes on serving a half-deleted build (exit 71, 2026-09-24).
	# Stop it first; stopping a stopped app is a no-op.
	pm2 stop "$PM2_APP" >/dev/null 2>&1 || true

	if [[ -e "$APP_DIR/.next" ]]; then
		info "discarding the partial build (its log is at $BUILD_LOG)"
		rm -rf "${APP_DIR:?}/.next" || { err "could not remove the partial build"; return 1; }
	fi

	info "restoring $(basename "$SNAPSHOT")"
	sudo mv -T -- "$SNAPSHOT" "$APP_DIR/.next" || { err "could not move the snapshot back"; return 1; }
	SNAPSHOT=""
	# A pin marker must never ride back into the live tree and pin the next snapshot.
	rm -f "$APP_DIR/.next/.keep"

	pm2 start "$PM2_APP" >/dev/null 2>&1 || pm2 restart "$PM2_APP" >/dev/null 2>&1 || true
	if wait_ready "$RESTORE_TIMEOUT_S"; then
		CANONICAL_STOPPED=0
		info "previous build is back up"
		return 0
	fi
	if (( BRIDGE_UP == 1 )); then
		err "$PM2_APP DID NOT COME UP — intervene now (customers are not affected while the bridge serves them)"
	else
		err "RESTORE DID NOT COME UP — the site is down, intervene now"
	fi
	err "  pm2 logs $PM2_APP --nostream --lines 50"
	return 1
}

# The failure handler: the live process back on its old build, then customers back on it, then the
# bridge and the scratch tree gone. In that order, so nothing is taken away from under a request.
restore() {
	local rc=0
	restore_canonical || rc=1
	if (( rc == 0 )); then
		release_bridge || rc=1
		return "$rc"
	fi

	# The live process could not be brought back. If a verified bridge is running, putting customers on
	# it is better than leaving them on a dead process — and its scratch tree must stay where it is.
	if [[ "$FLOW" == "bridge" ]] && (( BRIDGE_UP == 1 )); then
		if [[ "$(upstream_state)" == "bridge-primary" ]]; then
			err "customers are on the bridge ($BRIDGE_URL), which serves the new, verified build"
		elif set_upstream bridge-primary; then
			err "customers were sent to the bridge ($BRIDGE_URL), which serves the new, verified build"
		else
			err "the bridge could not be put in front either — the site may be down"
		fi
		err "$BUILD_DIR must stay until $PM2_APP is repaired: pm2 logs $PM2_APP, then $NGINX_TOOL set canonical-only"
	elif (( BRIDGE_UP == 0 )); then
		remove_scratch || true
	fi
	return "$rc"
}

on_exit() {
	local code=$?
	trap - EXIT
	stop_sudo_keepalive

	# Past the commit point the new build is live and verified. A failure in logging,
	# pruning or an external check is a post-deploy problem — never a reason to throw
	# away a good deploy.
	if (( COMMITTED == 1 )); then
		if (( code != 0 )); then
			err "the new build is deployed and verified, but a post-deploy step failed (exit $code)"
			err "NOT rolling back."
		fi
		# A run cut short between the commit and the hand-back leaves customers on the bridge.
		(( RELEASE_FAILED == 1 )) || release_bridge || true
		probe_report
		cleanup_tmp
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
		probe_report
		cleanup_tmp
		exit 71
	fi
	probe_report
	cleanup_tmp
	err "build log: $BUILD_LOG"
	exit "$code"
}

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
#
# WANT_BYTES, when set, is the exact size the body must have and replaces the MIN_ASSET_BYTES floor.
# For a build chunk the size is known from disk, and a chunk can legitimately be tiny: the one that
# holds only the @font-face rules is 478 B, and a floor judged a good deploy a failed one (exit 75,
# twice). An exact size still fails an empty body and the HTML a wrong URL would answer.
fetch_ok() {
	local url="$1"; shift
	local out code size
	out=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 25 "$@" "$url" 2>/dev/null) || out="000 0"
	code="${out%% *}"; size="${out##* }"
	if [[ "$code" == "200" ]] && [[ "$size" =~ ^[0-9]+$ ]]; then
		if [[ -n "${WANT_BYTES:-}" ]]; then
			if (( size == WANT_BYTES )); then
				info "ok  $url  (${size} B, matches build)"
				return 0
			fi
		elif (( size >= MIN_ASSET_BYTES )); then
			info "ok  $url  (${size} B)"
			return 0
		fi
	fi
	LAST_FETCH_DETAIL="HTTP $code, ${size} B${WANT_BYTES:+, build has ${WANT_BYTES} B}"
	return 1
}

require_local() {
	local url="$1"; shift
	fetch_ok "$url" "$@" || die "$url → ${LAST_FETCH_DETAIL:-unreachable}"
}
# Build chunks can legitimately be tiny. Require an exact nonzero byte match
# between this build's file and the body served by the new local process.
require_local_build_asset() {
	local asset="$1" disk_asset="$2"
	local out code served_size disk_size

	disk_size=$(stat -c '%s' -- "$disk_asset")
	(( disk_size > 0 )) || die "$asset is empty on disk ($disk_asset)"

	out=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 25 "$GATE_URL$asset" 2>/dev/null) \
		|| out="000 0"
	code="${out%% *}"
	served_size="${out##* }"
	[[ "$served_size" =~ ^[0-9]+$ ]] || die "$asset returned an invalid byte count: $served_size"
	[[ "$code" == "200" ]] || die "$GATE_URL$asset → HTTP $code, ${served_size} B"
	(( served_size == disk_size )) \
		|| die "$asset size mismatch: served ${served_size} B, build has ${disk_size} B"

	info "ok  $GATE_URL$asset  (${served_size} B, matches build)"
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

wait_ready_at() {
	local base="$1" budget="${2:-$READY_TIMEOUT_S}" i
	for ((i = 0; i < budget; i++)); do
		if [[ "$(http_code "$base$SMOKE_PATH")" == "200" ]]; then
			return 0
		fi
		sleep 1
	done
	return 1
}

wait_ready() { wait_ready_at "$LOCAL_URL" "${1:-$READY_TIMEOUT_S}"; }

soft() {
	local label="$1"; shift
	if "$@"; then
		return 0
	fi
	POST_DEPLOY_FAILED=1
	POST_DEPLOY_FAILED_STEPS+=("$label")
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

assert_not_root() {
	[[ "${EUID:-$(id -u)}" -ne 0 ]] || die "run as ubuntu, not root — a root build makes .next unwritable for PM2"
}

preflight() {
	step "preflight"

	assert_not_root
	[[ "$APP_DIR" == /* ]] || die "APP_DIR must be an absolute path, got '$APP_DIR'"
	[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR is not a git checkout"
	cd "$APP_DIR"

	[[ -z "${NEXT_OUTPUT:-}" ]] || die "NEXT_OUTPUT='$NEXT_OUTPUT' is set — production runs in normal mode (CLAUDE.md §13.6); unset it"

	# Every tool any check below depends on. A check whose tool is missing must
	# stop the deploy here, not evaporate silently later and let the summary line
	# claim it passed — which is exactly what `command -v xmllint && …` did to the
	# sitemap validity check for as long as it existed.
	local cmd
	for cmd in pnpm pm2 curl git flock awk find sed stat python3; do
		command -v "$cmd" >/dev/null || die "$cmd not found in PATH — a deploy check depends on it"
	done
	pm2 describe "$PM2_APP" >/dev/null 2>&1 || die "PM2 knows no app called '$PM2_APP'"

	# This script never installs dependencies. A tree whose pnpm-lock.yaml differs from
	# the lockfile node_modules was installed from builds on the old packages without a
	# word (Next 16.2.9 under a package.json that said 16.3.6, 2026-09-24), and installing
	# here would replace files the running server still loads. pnpm keeps a copy of the
	# lockfile it installed from in node_modules/.pnpm/lock.yaml.
	[[ -f node_modules/.pnpm/lock.yaml ]] \
		|| die "node_modules/.pnpm/lock.yaml is missing — cannot tell which dependencies are installed"
	cmp -s pnpm-lock.yaml node_modules/.pnpm/lock.yaml \
		|| die "pnpm-lock.yaml differs from what node_modules was installed from — a dependency change needs its own procedure (PM2 stopped, node_modules set aside, pnpm install --frozen-lockfile), not this script"

	# Cheap and worth it: about two seconds, and it is what catches a drift between
	# public/ and src/lib/routing.generated.ts. That list decides which paths
	# the proxy passes through, so a stale one 404s the logo sitewide.
	if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
		pnpm vitest run >"${BUILD_LOG}.tests" 2>&1 \
			|| die "the test suite fails — see ${BUILD_LOG}.tests (SKIP_TESTS=1 overrides, but not the routing tests)"
		info "test suite green"
	else
		# SKIP_TESTS does NOT cover these four. They are the only checks that decide
		# an HTTP status: routing-generated pins the asset list the proxy passes
		# through, route-policy pins that no market root segment can be swallowed by
		# the existence gate, and the two proxy suites pin the statuses themselves.
		# Skipping them to save two minutes is how a live legal page becomes a 404.
		warn "SKIP_TESTS=1 — only the routing tests will run"
		pnpm vitest run src/lib/routing-generated.test.ts src/lib/route-policy.test.ts \
			src/proxy.test.ts src/proxy.gate.test.ts src/lib/route-existence.test.ts \
			>"${BUILD_LOG}.tests" 2>&1 \
			|| die "the routing tests fail — SKIP_TESTS does not cover these; see ${BUILD_LOG}.tests"
		info "routing tests green"
	fi

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

	DEPLOY_SHA=$(git rev-parse HEAD)
	info "deploying ${DEPLOY_SHA:0:7} ($(git rev-parse --abbrev-ref HEAD)) — $(git log -1 --format=%s "$DEPLOY_SHA")"
	info "currently serving BUILD_ID $PREV_BUILD_ID from $PREV_SHA"
	# Printed here so a --dry-run shows it too. Confirmed against the running
	# process after the gate, by check_market_state.
	info "indexable markets requested by .env: $(market_state_from_env)"
	ps -eo pid,comm,rss --sort=-rss | head -5
}

# Copy the keys other systems issue for the storefront from AWS SSM into .env (CLAUDE.md
# §13.9) — before the stop, so it adds no downtime, and before the build, so a build-time
# variable would be current too. `pm2 start` below then reads the new .env.
#
# Warn-only, on purpose: an SSM or IAM hiccup leaves .env exactly as the last successful sync
# wrote it, which is the state the live site already runs on, so it is never a reason to hold
# a deploy back. A dry run only reports what would change.
sync_secrets() {
	step "secrets"
	local sync="$APP_DIR/scripts/ops/sync-secrets.sh" out rc=0
	if [[ ! -x "$sync" ]]; then
		warn "no $sync in this tree — .env left as it is"
		return 0
	fi
	if (( DRY_RUN == 1 || REHEARSE == 1 )); then
		out=$(ENV_FILE="$APP_DIR/.env" "$sync" --check 2>&1) || rc=$?
	else
		out=$(ENV_FILE="$APP_DIR/.env" "$sync" 2>&1) || rc=$?
	fi
	case "$rc" in
		0) info "$out" ;;
		10) info "$out (the start step below loads it)" ;;
		*) warn "could not sync secrets from SSM (exit $rc) — .env left as it was: $out" ;;
	esac
	return 0
}

snapshot_name() {
	printf '%s/.next.rollback-%s-%s-%s' "$ROLLBACK_DIR" "$PREV_SHA" "$PREV_BUILD_ID" "$(date -u +%Y%m%dT%H%M%SZ)"
}

snapshot() {
	step "stop + snapshot"
	DOWN_FROM=$(date +%s)
	# Set first: a stop that fails halfway still has to be followed by a start.
	CANONICAL_STOPPED=1
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

write_meta_in() {
	local dir="$1" sha="${2:-$DEPLOY_SHA}"
	step "metadata"
	# BUILD_ID alone does not say which commit produced it, and git HEAD may have moved
	# on since. This travels with the artifact into the rollback directory, so the next
	# deploy can name its snapshot correctly and a rollback knows which sha to check out.
	{
		echo "git_sha=$sha"
		echo "git_ref=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
		echo "git_subject=$(git -C "$APP_DIR" log -1 --format=%s "$sha")"
		echo "build_id=$(cat "$dir/.next/BUILD_ID")"
		echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
		echo "built_by=$(id -un)@$(hostname)"
		echo "node=$(node -v 2>/dev/null || echo unknown)"
	} > "$dir/.next/MAKY_DEPLOY_META"
	cat "$dir/.next/MAKY_DEPLOY_META"
}

# Classic builds the working tree itself, so what it records is the commit that tree is on now.
write_meta() { write_meta_in "$APP_DIR" "$(git -C "$APP_DIR" rev-parse HEAD)"; }

# Where PM2 sends this app's stdout. Asked of PM2 rather than guessed from
# ~/.pm2/logs, because a renamed or relocated log would silently turn the market
# read-back into a check of the wrong file.
pm2_out_log() {
	pm2 jlist 2>/dev/null | python3 -c '
import json, sys
try:
    apps = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for a in apps:
    if a.get("name") == sys.argv[1]:
        print(a.get("pm2_env", {}).get("pm_out_log_path", "") or "")
        break
' "$PM2_APP"
}

start() {
	step "start"
	# Boot boundary for check_market_state. PM2 never truncates this log, so the
	# read-back has to look at what THIS boot wrote and nothing else.
	#
	# Counting [market-state] lines in a sliding `pm2 logs --lines 1000` window
	# cannot do that. The window scrolls past the previous boot's line at about the
	# rate the asset gate fills it with [cms] lines, so the count comes out flat and
	# the check reports "no NEW line" on a perfectly healthy deploy. That is exactly
	# what exit 75 was on 2026-09-22 (fe04b47): the previous line sat 80 lines inside
	# a 1000-line window, and the gate wrote more than 80 lines before the check ran.
	# A byte offset has no such race.
	MARKET_LOG_FILE=$(pm2_out_log)
	if [[ -n "$MARKET_LOG_FILE" && -f "$MARKET_LOG_FILE" ]]; then
		MARKET_LOG_OFFSET=$(stat -c %s "$MARKET_LOG_FILE")
	else
		MARKET_LOG_FILE=""
		warn "cannot resolve the PM2 stdout log for $PM2_APP — the market read-back cannot run"
	fi
	pm2 start "$PM2_APP" >/dev/null
	wait_ready || die "$PM2_APP did not answer on $LOCAL_URL$SMOKE_PATH within ${READY_TIMEOUT_S}s"
	CANONICAL_STOPPED=0
	info "responding on $LOCAL_URL$SMOKE_PATH"
}

# Pick a real PDP from the just-built sitemap so the asset gate follows the
# catalogue instead of pinning a product slug that can later be unpublished.
discover_representative_pdp() {
	if [[ -n "$ASSET_GATE_PDP_PATH" ]]; then
		printf '%s' "$ASSET_GATE_PDP_PATH"
		return 0
	fi

	local market="${SMOKE_PATH#/}"
	market="${market%%/*}"
	if [[ -z "$market" ]]; then
		err "cannot derive a market from SMOKE_PATH='$SMOKE_PATH'"
		return 1
	fi

	python3 - "$GATE_URL" "$market" <<'PY'
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

base_url = sys.argv[1].rstrip("/")
market = sys.argv[2]
namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def fetch_xml(value):
    path = urllib.parse.urlsplit(value).path
    if not path.startswith("/"):
        raise SystemExit(f"unsafe sitemap path: {value}")
    with urllib.request.urlopen(base_url + path, timeout=60) as response:
        if response.status != 200:
            raise SystemExit(f"{path} answered {response.status}")
        return ET.fromstring(response.read())


index = fetch_xml("/sitemap.xml")
if index.tag != f"{namespace}sitemapindex":
    raise SystemExit("/sitemap.xml is not a sitemap index; cannot select a representative PDP")

product_shards = []
for location in index.findall(f"{namespace}sitemap/{namespace}loc"):
    if not location.text:
        continue
    value = location.text.strip()
    path = urllib.parse.urlsplit(value).path
    if f"/sitemaps/{market}-products-" in path:
        product_shards.append(value)

if not product_shards:
    raise SystemExit(f"no product sitemap shard found for market {market}")

for shard in product_shards:
    document = fetch_xml(shard)
    for location in document.findall(f"{namespace}url/{namespace}loc"):
        if not location.text:
            continue
        path = urllib.parse.urlsplit(location.text.strip()).path
        if path.startswith(f"/{market}/") and path != f"/{market}/products":
            print(path)
            raise SystemExit(0)

raise SystemExit(f"product sitemap shards contain no PDP for market {market}")
PY
}

# Fetch one representative HTML document, enumerate every CSS/JS chunk it
# advertises, and prove each chunk belongs to this build and is served locally.
gate_page_assets() {
	local path="$1" label="$2"
	local html html_size asset disk_asset
	local css_count=0
	local js_count=0
	local -a assets=()

	[[ "$path" == /* && "$path" != *".."* ]] || die "$label has an unsafe gate path: $path"

	html=$(new_tmp)
	curl -fsS --max-time 25 "$GATE_URL$path" -o "$html" || die "$label did not respond at $path"
	html_size=$(stat -c '%s' -- "$html")
	(( html_size >= MIN_ASSET_BYTES )) || die "$label at $path returned only ${html_size} B"
	# `$RX(...)` is React's streamed error marker. A document can still answer 200
	# while discarding server-rendered content and falling back to the client, so
	# status and asset checks alone do not make it a healthy deployment.
	if grep -qF '$RX(' "$html"; then
		die "$label at $path contains a React streamed error marker (\$RX)"
	fi

	# Next 16 / Turbopack emits both styles and scripts under
	# /_next/static/chunks/. Query strings and fragments are intentionally
	# excluded: the on-disk lookup must name the exact immutable chunk.
	mapfile -t assets < <(
		grep -oE "/_next/static/[^\"'?#[:space:]<>]+\\.(css|js)" "$html" | sort -u
	)
	(( ${#assets[@]} > 0 )) || die "$label at $path references no CSS/JS chunks"

	for asset in "${assets[@]}"; do
		case "$asset" in
			*.css)
				css_count=$(( css_count + 1 ))
				if [[ -z "$CSS_PATH" ]]; then
					CSS_PATH="$asset"
				fi
				;;
			*.js) js_count=$(( js_count + 1 )) ;;
		esac

		if [[ "$asset" != /_next/static/* || "$asset" == *"/../"* ]]; then
			die "$label references an unsafe asset path: $asset"
		fi
		disk_asset="$GATE_DIR/.next/${asset#/_next/}"
		if [[ ! -f "$disk_asset" ]]; then
			die "$label references $asset, but it is absent from this build ($disk_asset)"
		fi
		if [[ -z "${CHECKED_BUILD_ASSETS[$asset]+x}" ]]; then
			require_local_build_asset "$asset" "$disk_asset"
			CHECKED_BUILD_ASSETS["$asset"]=1
		fi
	done

	(( css_count > 0 )) || die "$label at $path references no CSS chunk"
	(( js_count > 0 )) || die "$label at $path references no JavaScript chunk"
	info "$label assets: ${css_count} CSS + ${js_count} JS references verified ($path)"
}

# The rollback gate. Only things the artifact itself controls belong here: if nginx or
# the public network is broken, swapping the build back does not fix it and would throw
# away a verified artifact for nothing.
gate_artifact() {
	step "gate — $1"
	local pdp_path i
	local -a page_paths page_labels

	if ! pdp_path=$(discover_representative_pdp); then
		die "could not select a representative PDP from the local sitemap"
	fi
	[[ -n "$pdp_path" ]] || die "the representative PDP path is empty"

	page_paths=(
		"$SMOKE_PATH"
		"${SMOKE_PATH%/}/products"
		"$ASSET_GATE_CATEGORY_PATH"
		"$pdp_path"
	)
	page_labels=("homepage" "product listing" "category" "product detail")

	CHECKED_BUILD_ASSETS=()
	CSS_PATH=""
	for i in "${!page_paths[@]}"; do
		gate_page_assets "${page_paths[$i]}" "${page_labels[$i]}"
	done
	if (( ${#CHECKED_BUILD_ASSETS[@]} == 0 )); then
		die "representative pages produced no unique build assets"
	fi
	info "build assets: ${#CHECKED_BUILD_ASSETS[@]} unique CSS/JS chunks verified on disk and over local HTTP"

	gate_routing
}

# The commit point: from here the new build stays, and nothing rolls back.
commit_point() {
	DOWNTIME=$(( $(date +%s) - DOWN_FROM ))
	COMMITTED=1
	if [[ "$FLOW" == "bridge" ]]; then
		info "local gate passed — $PM2_APP was swapped in ${DOWNTIME}s behind the bridge. From here the new build stays."
	else
		info "local gate passed — downtime ${DOWNTIME}s. From here the new build stays."
	fi
}

# Classic and restart: the live process is the thing being gated, and passing is the commit point.
gate_local() {
	GATE_URL="$LOCAL_URL"
	GATE_DIR="$APP_DIR"
	gate_artifact "local artifact"
	commit_point
}

# Routing behaviour the artifact is responsible for. Part of the rollback gate:
# a build that 404s its own logo, or stops 404ing junk, is a bad build.
#
# The dotted-path checks exist because the matcher used to exclude every path
# containing a dot, so /admin.php answered 200 with `index, follow` and a
# self-canonical. Re-introducing that exclusion is a one-character mistake and
# nothing else in this script would notice.
gate_routing() {
	local path code body count

	# Static assets and root metadata routes. Generated list, so this follows
	# public/ rather than a list somebody has to remember to update.
	local assets=()
	while IFS= read -r path; do assets+=("$path"); done < <(
		find "$GATE_DIR/public" -type f -printf '/%P\n' | sort
	)
	# An empty `find` would make the loop below iterate over nothing and still
	# print a reassuring count. Same defect shape as the sitemap check.
	(( ${#assets[@]} > 0 )) || die "no files found under $GATE_DIR/public — the static-asset check would pass vacuously"

	assets+=(/robots.txt /sitemap.xml /icon.png /apple-icon.png /opengraph-image.png /twitter-image.png /favicon.ico)

	for path in "${assets[@]}"; do
		code=$(http_code "$GATE_URL$path")
		[[ "$code" == "200" ]] || die "static asset $path answered $code — the matcher change has broken public/"
	done
	info "static assets and metadata routes: ${#assets[@]} × 200"

	# Junk must 404, including the dotted first segments that used to bypass the proxy.
	for path in /admin.php /wp-login.php /index.php /does.not.exist /does.not.exist/categories/x /wishlist; do
		code=$(http_code "$GATE_URL$path")
		[[ "$code" == "404" ]] || die "$path answered $code, expected 404 — the invalid-first-segment gate is open"
	done
	info "bogus paths (dotted and plain): 404"

	# Sitemap: reachable, parses, and not suspiciously short. A truncated sitemap
	# reads to Google as "the missing URLs are gone", and is indistinguishable
	# from a complete one without a floor to compare against.
	body=$(new_tmp)
	curl -fsS --max-time 25 "$GATE_URL/sitemap.xml" -o "$body" || die "/sitemap.xml did not respond"

	# This used to read:
	#     command -v xmllint >/dev/null && { xmllint --noout "$body" || die ... }
	# xmllint is not installed on this box, so the `&&` short-circuited and the
	# whole validity check evaporated — while the summary line below went on
	# printing "well-formed". A check that quietly passes when its tool is absent
	# is worse than no check: it manufactures confidence. python3 is stdlib here
	# and is asserted in preflight.
	#
	# Counting <loc> as ELEMENTS rather than grepping lines also stops the floor
	# depending on how the XML happens to be wrapped.
	#
	# Since COMMERCE-2 M5 /sitemap.xml is a <sitemapindex> over per-market shards
	# (/sitemaps/sk-products-1.xml, …). The floor applies to the URLs the shards list, not to
	# the handful of shard names in the index — counting those would fail every deploy — and
	# every shard must answer and parse, or the index advertises a broken file. Shards are
	# fetched from LOCAL_URL by path: the index names them absolutely, on the public host.
	count=$(python3 - "$body" "$GATE_URL" <<'PY' 2>&1
import sys, urllib.parse, urllib.request, xml.etree.ElementTree as ET
ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
root = ET.parse(sys.argv[1]).getroot()
if root.tag == f"{ns}sitemapindex":
    total = 0
    shards = [loc.text.strip() for loc in root.findall(f"{ns}sitemap/{ns}loc")]
    if not shards:
        raise SystemExit("the index names no shard")
    for shard in shards:
        url = sys.argv[2] + urllib.parse.urlsplit(shard).path
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.status != 200:
                raise SystemExit(f"{url} answered {response.status}")
            total += len(ET.fromstring(response.read()).findall(f".//{ns}loc"))
    print(total)
else:
    print(len(root.findall(f".//{ns}loc")))
PY
	) || die "/sitemap.xml or one of its shards is broken: $count"
	[[ "$count" =~ ^[0-9]+$ ]] || die "/sitemap.xml could not be counted: $count"
	(( count >= MIN_SITEMAP_URLS )) || die "/sitemap.xml lists $count URLs, expected at least $MIN_SITEMAP_URLS"
	info "sitemap: parsed as XML, $count <loc> elements"

	# Client-side navigation. The proxy matcher also fires for RSC and prefetch
	# requests, so a change there can break in-app navigation while every plain
	# page load still looks fine.
	#
	# Next 16.3 answers a request that carries `RSC: 1` but no `_rsc` with a 307 to
	# `?_rsc` (its cache-busting check); a browser sends `_rsc` itself. A probe that
	# took that 307 for a failure rolled back a healthy build on 2026-09-24. So follow
	# one redirect and require the RSC payload of the same path, not a status alone.
	local rsc final final_path ctype
	for path in "$SMOKE_PATH" "$SMOKE_PATH/products"; do
		rsc=$(curl -sS -o /dev/null -L --max-redirs 1 --max-time 25 -H 'RSC: 1' \
			-w '%{http_code}|%{content_type}|%{url_effective}' "$GATE_URL$path" 2>/dev/null || true)
		IFS='|' read -r code ctype final <<<"$rsc"
		code=${code:-000}
		final_path=${final#"$GATE_URL"}
		final_path=${final_path%%\?*}
		[[ "$code" == "200" && "$ctype" == text/x-component* && "$final_path" == "$path" ]] \
			|| die "RSC navigation to $path answered $code $ctype at $final — client-side routing is broken"
	done
	info "RSC navigation: 200 text/x-component"

	# The pages a customer actually needs.
	for path in "$SMOKE_PATH/products" /checkout; do
		code=$(http_code "$GATE_URL$path")
		[[ "$code" == "200" ]] || die "$path answered $code"
	done
	info "listing and checkout: 200"
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
	# The stylesheet as served publicly must be this build's own file, byte for byte (see fetch_ok).
	local css_bytes
	css_bytes=$(stat -c '%s' -- "$APP_DIR/.next/${CSS_PATH#/_next/}") || css_bytes=""
	if [[ -n "$css_bytes" && "$css_bytes" -gt 0 ]]; then
		WANT_BYTES="$css_bytes" check_external "public CSS" "${PUBLIC_URL}${CSS_PATH}" || ok=1
	else
		warn "public CSS: ${CSS_PATH:-no stylesheet recorded} is missing or empty on disk"
		ok=1
	fi
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

# Everything $PM2_APP has written since the offset start() recorded — this boot's
# log and nothing before it.
market_log_since_boot() {
	[[ -n "$MARKET_LOG_FILE" && -f "$MARKET_LOG_FILE" ]] || return 1
	tail -c "+$(( MARKET_LOG_OFFSET + 1 ))" "$MARKET_LOG_FILE" 2>/dev/null
}

check_market_state() {
	local line got unknown want since

	if ! since=$(market_log_since_boot); then
		err "no PM2 log baseline was taken at start — cannot tell this boot's market state from the last one"
		return 1
	fi

	line=$(grep -o '\[market-state\] live=[^ ]* preview=[^ ]* unknown=[^ ]*' <<<"$since" | tail -1)
	if [[ -z "$line" ]]; then
		err "this boot wrote no [market-state] line — cannot confirm which markets are indexable"
		return 1
	fi
	info "$line"

	# Same read-back for the existence gate. Whether it is armed, and for which
	# markets and families, is the single most consequential runtime setting on
	# this artifact — it must be visible in the deploy output, not inferred.
	local gate_line
	gate_line=$(grep -o '\[route-existence\] gate=[^ ]* markets=[^ ]* families=[^ ]*' <<<"$since" | tail -1)
	if [[ -z "$gate_line" ]]; then
		err "this boot wrote no [route-existence] line — cannot confirm whether the existence gate is armed"
		return 1
	fi
	info "$gate_line"

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

# Does any foreign market answer in Slovak?
#
# Four separate locale faults shipped to production and every one of them was found by the
# owner in his browser, not here — because the checks fetched pages the way a robot does. This
# one carries a cookie jar from /sk, `Accept-Language: sk-SK`, the RSC payload a click actually
# downloads, and a saved vehicle when `.env` supplies one. It reads the Slovak and the market's
# own value for each message key and only compares where the two differ, so it has no word list
# to rot.
#
# Post-deploy, not a rollback gate: a Slovak label is a real defect but swapping the artifact
# back does not fix it, and the build is otherwise serving correctly. Exit 75 says so.
check_market_language() {
	local script="$APP_DIR/scripts/checks/market-language.mjs" garage=""
	[[ -f "$script" ]] || { err "$script is missing"; return 1; }
	if [[ -f "$APP_DIR/.env" ]] && grep -q '^MAKY_SMOKE_GARAGE_COOKIE=' "$APP_DIR/.env"; then
		garage=$(grep '^MAKY_SMOKE_GARAGE_COOKIE=' "$APP_DIR/.env" | tail -1 | cut -d= -f2-)
	fi
	MAKY_SMOKE_GARAGE_COOKIE="$garage" node "$script" --base "$LOCAL_URL" | sed 's/^/    /'
	return "${PIPESTATUS[0]}"
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
		echo "git:      ${DEPLOY_SHA:0:7}  $(git log -1 --format=%s "$DEPLOY_SHA")"
		echo "BUILD_ID: $(cat "$APP_DIR/.next/BUILD_ID")"
		echo "built:    $(stat -c %y "$APP_DIR/.next/BUILD_ID")"
		echo "previous: ${PREV_BUILD_ID} from ${PREV_SHA}"
		echo "snapshot: ${snap_name}"
		echo "flow:     ${FLOW}"
		if [[ "$FLOW" == "bridge" ]]; then
			echo "downtime: 0s for customers ($PM2_APP itself was swapped in ${DOWNTIME}s, behind the bridge)"
		else
			echo "downtime: ${DOWNTIME}s"
		fi
		echo "probes:   ${PROBE_SUMMARY:-not measured}"
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

# --- build aside: the scratch tree, the bridge, nginx --------------------------------------
# The classic flow builds in $APP_DIR with the live process stopped, which is where the 3 to 4
# minutes of 502 come from. These build next to it instead, so the live process keeps serving for
# the whole build and the switch is the only moment that matters. Why this is safe to do, and how
# each failure is undone: CLAUDE.md §13.2 and §13.8.

nginx_tool() {
	CANONICAL_ADDR="$CANONICAL_ADDR" BRIDGE_ADDR="$BRIDGE_ADDR" PROBE_ADDR="$PROBE_ADDR" \
	PUBLIC_HOST="$PUBLIC_HOST" PUBLIC_URL="$PUBLIC_URL" NGINX_LOCAL_IP="$NGINX_LOCAL_IP" \
	SMOKE_PATH="$SMOKE_PATH" "$NGINX_TOOL" "$@"
}

# What nginx is told right now, read from the file the tool owns: canonical-only, bridge-primary,
# absent or unknown. Never from a variable — a run killed in the middle of a switch cannot have
# updated one.
upstream_state() {
	local out
	out=$(nginx_tool status 2>/dev/null) || true
	sed -n 's/^state=//p' <<<"$out" | head -1
}

# The tool tests the configuration, reloads nginx, and only reports success once a request through
# nginx has been answered by the process the new state names. On failure it puts the old file back.
set_upstream() {
	local state="$1" rc=0
	nginx_tool set "$state" || rc=$?
	if (( rc >= 2 )); then
		err "nginx may be in an unknown state — look at it: $NGINX_TOOL status"
	fi
	return "$rc"
}

# Wait for the requests a process already holds to finish. nginx keeps a request on the process that
# took it, so after a switch the old one empties on its own; stopping it first would cut those requests.
drain_port() {
	local port="$1" budget="${2:-$DRAIN_TIMEOUT_S}" i n=0
	for ((i = 0; i < budget * 2; i++)); do
		n=$(ss -Htn state established "( sport = :${port} )" 2>/dev/null | wc -l) || n=0
		if (( n == 0 )); then
			return 0
		fi
		sleep 0.5
	done
	warn "$n connection(s) still open on port $port after ${budget}s — going on"
	return 0
}

# $BUILD_DIR sits in /opt, which belongs to root: the tree is emptied by the user who made it, and the
# directory itself goes with one non-recursive sudo (it is also what `install -d` needed to create it).
rm_scratch_tree() {
	local dir="$1"
	find "$dir" -mindepth 1 -delete || return 1
	sudo rmdir -- "$dir"
}

remove_scratch() {
	(( SCRATCH == 1 )) || return 0
	# Only a tree this script made (it leaves a marker), and never under a process that still uses it.
	if (( BRIDGE_UP == 1 )); then
		return 0
	fi
	if [[ -f "$BUILD_DIR/.maky-scratch" && "$BUILD_DIR" != "$APP_DIR" && "$BUILD_DIR" == /*/* ]]; then
		rm_scratch_tree "$BUILD_DIR" || { warn "could not remove $BUILD_DIR"; return 1; }
		info "removed $BUILD_DIR"
	else
		warn "not removing $BUILD_DIR: it is not a scratch tree this script made"
	fi
	SCRATCH=0
	return 0
}

# Customers back on the live process, then the bridge and the scratch tree go. Safe at any point and
# more than once: it looks at what is actually there. If nginx will not go back, nothing is stopped —
# the bridge may be what customers are being served by.
release_bridge() {
	local st
	if [[ "$FLOW" == "bridge" ]] && (( UPSTREAM_TOUCHED == 1 )); then
		st=$(upstream_state)
		if [[ "$st" == "bridge-primary" || "$st" == "unknown" ]]; then
			if ! set_upstream canonical-only; then
				RELEASE_FAILED=1
				err "customers are still on the bridge ($BRIDGE_URL): it and $BUILD_DIR are left running"
				err "  after checking that $LOCAL_URL answers:  $NGINX_TOOL set canonical-only"
				err "  then:  pm2 delete $BRIDGE_APP   and   sudo rm -rf $BUILD_DIR"
				return 1
			fi
		fi
	fi
	if (( BRIDGE_UP == 1 )); then
		if [[ "$FLOW" == "bridge" ]]; then
			drain_port "$BRIDGE_PORT"
		fi
		if pm2 delete "$BRIDGE_APP" >/dev/null 2>&1; then
			BRIDGE_UP=0
			info "bridge stopped"
		else
			warn "could not delete the PM2 app $BRIDGE_APP — $BUILD_DIR stays until it is gone"
		fi
	fi
	remove_scratch
}

# Which way to switch. Decided before anything is changed, and shown by the dry run.
resolve_flow() {
	local rc=0 out state=""
	if (( REHEARSE == 1 )); then
		FLOW="rehearse"
		FLOW_REASON="--rehearse: build aside and gate it on the spare port, switch nothing"
		return 0
	fi
	case "$MODE" in
		classic) FLOW="classic"; FLOW_REASON="--classic: stop, build in place, start"; return 0 ;;
		restart) FLOW="restart"; FLOW_REASON="--mode restart"; return 0 ;;
	esac

	# bridge, or auto: look at what nginx has.
	if [[ -x "$NGINX_TOOL" ]]; then
		out=$(nginx_tool status 2>&1) || rc=$?
		state=$(sed -n 's/^state=//p' <<<"$out" | head -1)
	else
		rc=2
	fi
	case "$rc" in
		0)
			[[ "$state" == "canonical-only" ]] \
				|| die "nginx is set to '$state', not canonical-only: an earlier deploy did not finish. Check that $LOCAL_URL answers, then run: $NGINX_TOOL set canonical-only"
			out=$(nginx_tool probe 2>&1) || true
			[[ "$out" == "200 $CANONICAL_ADDR" ]] \
				|| die "nginx's loopback listener ($PROBE_ADDR) answered '$out', expected '200 $CANONICAL_ADDR' — nginx was not reloaded after setup? Run: $NGINX_TOOL set canonical-only"
			FLOW="bridge"
			FLOW_REASON="nginx is prepared for a bridge (state canonical-only)"
			;;
		2)
			[[ "$MODE" != "bridge" ]] || die "--mode bridge needs nginx prepared once: $NGINX_TOOL setup --apply"
			FLOW="restart"
			FLOW_REASON="nginx is not prepared for a bridge ($NGINX_TOOL setup): a gap of the few seconds the server takes to boot"
			;;
		*)
			die "nginx is only partly prepared for a bridge: $NGINX_TOOL status; finish with: $NGINX_TOOL setup --apply, or go back with: $NGINX_TOOL revert --apply"
			;;
	esac
}

# Relative paths in .env resolve against the working directory, and the bridge's is not $APP_DIR.
# Prints the NAMES of such variables, never a value.
relative_env_paths() {
	local line name value
	[[ -f "$APP_DIR/.env" ]] || return 0
	while IFS= read -r line; do
		line="${line#"${line%%[![:space:]]*}"}"
		line="${line#export }"
		[[ "$line" =~ ^([A-Z][A-Z0-9_]*(_PATH|_DIR))=(.*)$ ]] || continue
		name="${BASH_REMATCH[1]}"
		value=$(sed -e "s/^[\"']//" -e "s/[\"']\$//" <<<"${BASH_REMATCH[3]}")
		if [[ -n "$value" && "$value" != /* && "$value" != *://* ]]; then
			printf '%s\n' "$name"
		fi
	done <"$APP_DIR/.env"
}

# Whether PM2 has an app of that name: 0 yes, 1 no, 2 its list could not be read. Taken from the list,
# not from the exit status of `pm2 describe`, so a missing app can never be mistaken for a present one.
pm2_has_app() {
	pm2 jlist 2>/dev/null | python3 -c '
import json, sys
try:
    apps = json.load(sys.stdin)
except Exception:
    sys.exit(2)
sys.exit(0 if any(a.get("name") == sys.argv[1] for a in apps) else 1)
' "$1"
}

port_in_use() {
	(exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

preflight_aside() {
	step "preflight — build aside"
	local cmd name rc
	for cmd in tar nice cp install mv rm stat; do
		command -v "$cmd" >/dev/null || die "$cmd not found in PATH — the build-aside flow depends on it"
	done
	if [[ "$FLOW" == "bridge" || "$FLOW" == "rehearse" ]]; then
		for cmd in ss env pkill; do
			command -v "$cmd" >/dev/null || die "$cmd not found in PATH — the bridge depends on it"
		done
	fi

	[[ "$BUILD_DIR" == /*/* ]] || die "BUILD_DIR must be an absolute path with a parent directory, got '$BUILD_DIR'"
	case "$BUILD_DIR/" in
		"$APP_DIR"/*) die "BUILD_DIR ($BUILD_DIR) is inside APP_DIR — the build would sit under the live tree" ;;
	esac
	case "$APP_DIR/" in
		"$BUILD_DIR"/*) die "APP_DIR is inside BUILD_DIR ($BUILD_DIR)" ;;
	esac
	if [[ ! -f "$APP_DIR/.env" ]]; then
		warn "no $APP_DIR/.env — the build and the bridge would run without configuration"
	fi
	while IFS= read -r name; do
		warn ".env: $name holds a relative path; it resolves against the working directory, which is $BUILD_DIR for the bridge — make it absolute"
	done < <(relative_env_paths)

	if [[ "$FLOW" == "bridge" || "$FLOW" == "rehearse" ]]; then
		rc=0
		pm2_has_app "$BRIDGE_APP" || rc=$?
		case "$rc" in
			0)
				# Customers are never on it here: a bridge flow has just checked that nginx is on the live
				# process, and a rehearsal looks below.
				if [[ "$FLOW" == "rehearse" && "$(upstream_state)" == "bridge-primary" ]]; then
					die "nginx is pointed at $BRIDGE_APP: customers may be on it — see $NGINX_TOOL status"
				fi
				warn "$BRIDGE_APP is registered with PM2 (left by an earlier run) — deleting it"
				pm2 delete "$BRIDGE_APP" >/dev/null 2>&1 || die "could not delete the old $BRIDGE_APP"
				;;
			1) ;;
			*) die "cannot read PM2's process list (pm2 jlist) — not starting a bridge blind" ;;
		esac
		if port_in_use "$BRIDGE_PORT"; then
			die "port $BRIDGE_PORT is in use — the bridge needs it (BRIDGE_PORT picks another)"
		fi
		info "bridge port $BRIDGE_PORT is free"
	fi
}

prepare_scratch() {
	step "scratch tree"
	if [[ -e "$BUILD_DIR" ]]; then
		if [[ -f "$BUILD_DIR/.maky-scratch" ]]; then
			warn "removing a scratch tree left by an earlier run"
		elif [[ -d "$BUILD_DIR" && -z "$(find "$BUILD_DIR" -mindepth 1 -print -quit)" ]]; then
			# What a plain `rm -rf` by the deploy user leaves behind: /opt is root's, so the emptied directory stays.
			info "removing an empty $BUILD_DIR left by an earlier run"
		else
			die "$BUILD_DIR exists and is not a scratch tree of this script — move it away"
		fi
		rm_scratch_tree "$BUILD_DIR" || die "could not remove the old $BUILD_DIR"
	fi
	# The parent (/opt) belongs to root; the tree itself belongs to whoever builds in it.
	sudo install -d -o "$(id -u)" -g "$(id -g)" -m 0755 "$BUILD_DIR" || die "could not create $BUILD_DIR"
	: >"$BUILD_DIR/.maky-scratch"
	SCRATCH=1

	# One filesystem, or installing the finished build would be a slow copy instead of a rename.
	[[ "$(stat -c %d "$BUILD_DIR")" == "$(stat -c %d "$APP_DIR")" ]] \
		|| die "$BUILD_DIR and $APP_DIR are on different filesystems — installing the build would copy it"

	# The commit as git has it, not the working tree: that is what MAKY_DEPLOY_META will say was built.
	git -C "$APP_DIR" archive --format=tar "$DEPLOY_SHA" | tar -x -C "$BUILD_DIR" || die "could not export ${DEPLOY_SHA:0:7} into $BUILD_DIR"
	# Dependencies are copied, never installed: this script installs nothing (see preflight).
	cp -a --reflink=auto -- "$APP_DIR/node_modules" "$BUILD_DIR/node_modules" || die "could not copy node_modules"
	# Every file Next reads at build and at start, so the bridge is configured exactly as the live process is.
	local envfile
	for envfile in .env .env.local .env.production .env.production.local; do
		if [[ -f "$APP_DIR/$envfile" ]]; then
			cp -p -- "$APP_DIR/$envfile" "$BUILD_DIR/$envfile" || die "could not copy $envfile"
		fi
	done
	info "scratch tree ready: $BUILD_DIR"
}

# A finished build names its own location in exactly two files (required-server-files.json and .js).
# Anything else that carries it would still point at the scratch tree after the move.
audit_relocatable() {
	local stray
	stray=$(grep -rIlF -- "$BUILD_DIR" "$BUILD_DIR/.next" --exclude='*.map' --exclude-dir=cache 2>/dev/null \
		| grep -v -E '/required-server-files\.(json|js)$' || true)
	if [[ -n "$stray" ]]; then
		err "the build carries its own location ($BUILD_DIR) in files other than required-server-files:"
		printf '%s\n' "$stray" | head -10 >&2
		return 1
	fi
	info "relocatable: the build's own path is only in required-server-files"
}

build_aside() {
	step "build — in $BUILD_DIR, the live site keeps serving"
	info "log: $BUILD_LOG (nice $BUILD_NICE)"
	if ! (cd "$BUILD_DIR" && nice -n "$BUILD_NICE" pnpm build) 2>&1 | tee "$BUILD_LOG"; then
		die "pnpm build failed — see $BUILD_LOG"
	fi
	[[ -f "$BUILD_DIR/.next/BUILD_ID" ]] || die "build finished but there is no .next/BUILD_ID"
	info "new BUILD_ID $(cat "$BUILD_DIR/.next/BUILD_ID")"
	audit_relocatable || die "the build cannot be moved into $APP_DIR safely (CLAUDE.md §13.8)"
}

# The bridge writes into the .next it serves (ISR shells, the image cache). What goes into $APP_DIR is a
# copy taken before the bridge existed, so the live process starts from the build exactly as it was made.
make_pristine() {
	local pristine="$BUILD_DIR/.next.pristine"
	step "clean copy for $APP_DIR"
	cp -a -- "$BUILD_DIR/.next" "$pristine" || die "could not copy the finished build"
	NEW_NEXT="$pristine"
	info "kept a clean copy of the build"
}

# The only place a finished build names where it lives. Rewritten after the move so the files say
# what is true; the gate on the live process is what proves the moved build works.
rewrite_build_paths() {
	local dir="$1" from="$2" to="$3"
	python3 - "$dir" "$from" "$to" <<'PY'
import json, os, sys

directory, old, new = sys.argv[1:4]
for name in ("required-server-files.json", "required-server-files.js"):
    path = os.path.join(directory, name)
    if not os.path.isfile(path):
        continue
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if old not in text:
        continue
    text = text.replace(old, new)
    if name.endswith(".json"):
        json.loads(text)  # still valid JSON, or this raises and the deploy is refused
    scratch = path + ".tmp"
    with open(scratch, "w", encoding="utf-8") as handle:
        handle.write(text)
    os.replace(scratch, path)
    print(f"    {name}: {old} -> {new}")
PY
}

# The brief moment the live process is not serving. In bridge mode nobody is looking at it: customers
# are on the bridge. In restart mode this IS the gap.
swap_in_new_build() {
	step "put $PM2_APP on the new build"
	DOWN_FROM=$(date +%s)
	CANONICAL_STOPPED=1
	pm2 stop "$PM2_APP" >/dev/null
	info "$PM2_APP stopped"

	if [[ -e "$APP_DIR/.next" ]]; then
		local name
		name=$(snapshot_name)
		[[ ! -e "$name" ]] || die "snapshot already exists: $name"
		# -T so an existing target is never treated as a directory to nest .next inside.
		sudo mv -T -- "$APP_DIR/.next" "$name"
		SNAPSHOT="$name"
		info "snapshot: $(basename "$SNAPSHOT")"
	else
		warn "no .next to snapshot"
	fi

	mv -T -- "$NEW_NEXT" "$APP_DIR/.next"
	NEW_NEXT=""
	rewrite_build_paths "$APP_DIR/.next" "$BUILD_DIR" "$APP_DIR"
	start
}

start_bridge() {
	step "bridge on $BRIDGE_URL"
	# A clean environment. The live process carries the variables of whichever shell started it, tokens
	# of an agent session included; everything the app needs is in .env, which Next reads itself.
	env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 ${PM2_HOME:+PM2_HOME="$PM2_HOME"} \
		pm2 start npm --name "$BRIDGE_APP" --cwd "$BUILD_DIR" -- start -- -p "$BRIDGE_PORT" -H 127.0.0.1 >/dev/null \
		|| die "pm2 could not start the bridge"
	BRIDGE_UP=1
	wait_ready_at "$BRIDGE_URL" || die "the bridge did not answer on $BRIDGE_URL$SMOKE_PATH within ${READY_TIMEOUT_S}s (pm2 logs $BRIDGE_APP)"
	info "the bridge answers on $BRIDGE_URL$SMOKE_PATH"
}

gate_bridge() {
	GATE_URL="$BRIDGE_URL"
	GATE_DIR="$BUILD_DIR"
	gate_artifact "the bridge, before any customer is sent to it"
}

flip_to_bridge() {
	step "customers → bridge"
	UPSTREAM_TOUCHED=1
	set_upstream bridge-primary || die "nginx would not switch to the bridge — $PM2_APP was not touched"
	# The public path as well (TLS, Host, headers). The next step stops the live process, so this is a
	# hard check: customers must be on the bridge before anything is taken away from them.
	fetch_ok "${PUBLIC_URL}${SMOKE_PATH}" --resolve "${PUBLIC_HOST}:443:${NGINX_LOCAL_IP}" \
		|| die "${PUBLIC_URL}${SMOKE_PATH} through nginx → ${LAST_FETCH_DETAIL:-unreachable} — $PM2_APP was not touched"
}

# --- what customers experience while it happens --------------------------------------------
# One request every PROBE_INTERVAL_S to the address customers go through, from just before the first
# step that could affect them to just after the last one. The result is a count, not a claim.
probe_loop() {
	local url="$1" out="$2" i code
	for ((i = 0; i < PROBE_MAX_ITERATIONS; i++)); do
		code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null) || code=000
		printf '%s %s\n' "$(date +%s.%N)" "$code" >>"$out"
		sleep "$PROBE_INTERVAL_S"
	done
}

probe_start() {
	local url="$1"
	PROBE_FILE=$(new_tmp)
	# fd 9 is the deploy lock; a probe that outlived the script must not keep holding it. Its stderr goes
	# nowhere: stopping it kills the request it is in the middle of, and bash reports that as "Terminated".
	( exec 9>&- 2>/dev/null; probe_loop "$url" "$PROBE_FILE" ) &
	PROBE_PID=$!
	info "probing $url every ${PROBE_INTERVAL_S}s"
}

probe_report() {
	[[ -n "$PROBE_PID" ]] || return 0
	pkill -P "$PROBE_PID" 2>/dev/null || true
	kill "$PROBE_PID" 2>/dev/null || true
	wait "$PROBE_PID" 2>/dev/null || true
	PROBE_PID=""
	if [[ ! -s "$PROBE_FILE" ]]; then
		PROBE_SUMMARY="no probe request was recorded"
		return 0
	fi
	PROBE_SUMMARY=$(awk '
		{
			n++
			if ($2 != 200) {
				bad++
				if (!run) { first = $1; run = 1 }
				if ($1 - first > longest) longest = $1 - first
			} else {
				run = 0
			}
		}
		END {
			printf "%d of %d probe requests failed", bad + 0, n
			if (bad > 0) printf ", the longest failing stretch lasted about %.0f s", longest + 0.5
		}' "$PROBE_FILE")
	if [[ "$PROBE_SUMMARY" == "0 of "* ]]; then
		info "customers: $PROBE_SUMMARY"
	else
		warn "customers: $PROBE_SUMMARY"
	fi
}

# --- the flows -----------------------------------------------------------------------------
post_commit_steps() {
	soft "external verification" verify_external
	soft "market state"         check_market_state
	soft "market language"      check_market_language
	soft "deployment log"       write_deploy_log
	soft "snapshot pruning"     prune
}

run_classic() {
	probe_start "$LOCAL_URL$SMOKE_PATH"
	snapshot
	build
	write_meta
	start
	gate_local
	probe_report
	post_commit_steps
}

run_restart() {
	prepare_scratch
	build_aside
	write_meta_in "$BUILD_DIR"
	NEW_NEXT="$BUILD_DIR/.next"
	probe_start "$LOCAL_URL$SMOKE_PATH"
	swap_in_new_build
	gate_local
	probe_report
	soft "scratch tree removal" remove_scratch
	post_commit_steps
}

run_bridge() {
	prepare_scratch
	build_aside
	write_meta_in "$BUILD_DIR"
	make_pristine
	start_bridge
	gate_bridge
	probe_start "http://${PROBE_ADDR}${SMOKE_PATH}"
	flip_to_bridge
	drain_port "${CANONICAL_ADDR##*:}"
	swap_in_new_build
	GATE_URL="$LOCAL_URL"
	GATE_DIR="$APP_DIR"
	gate_artifact "the live process on the new build, customers still on the bridge"
	commit_point
	soft "customers back on $PM2_APP, bridge stopped" release_bridge
	probe_report
	post_commit_steps
}

run_rehearse() {
	prepare_scratch
	build_aside
	write_meta_in "$BUILD_DIR"
	start_bridge
	gate_bridge
	release_bridge
	COMMITTED=1
	step "rehearsal passed"
	info "this commit builds beside the live site, can be moved, and serves from $BRIDGE_URL with the whole gate green"
	info "nothing was switched: $PM2_APP and nginx were not touched"
	if (( BRIDGE_UP == 1 || SCRATCH == 1 )); then
		warn "the rehearsal left $BRIDGE_APP and/or $BUILD_DIR behind: pm2 delete $BRIDGE_APP; sudo rm -rf $BUILD_DIR"
		POST_DEPLOY_FAILED=1
		POST_DEPLOY_FAILED_STEPS+=("rehearsal clean-up")
	else
		info "the bridge and $BUILD_DIR are gone"
	fi
}

print_plan() {
	step "dry run — nothing was changed"
	printf 'Flow: %s — %s\n\n' "$FLOW" "$FLOW_REASON"
	case "$FLOW" in
		classic)
			cat <<-EOF
			Would, in this order:
			  copy secrets from AWS SSM into .env (see "secrets" above; warn-only)
			  pm2 stop $PM2_APP
			  sudo mv -T $APP_DIR/.next $(snapshot_name)
			  pnpm build
			  write $APP_DIR/.next/MAKY_DEPLOY_META
			  pm2 start $PM2_APP
			  gate (rollback if it fails):  homepage/PLP/category/PDP + every referenced CSS/JS, on disk and over local HTTP
			  verify (warn only):           nginx via --resolve, then $PUBLIC_URL
			  append to $DEPLOY_LOG
			  keep the newest $KEEP_SNAPSHOTS snapshots (plus any with a <snapshot>.keep sidecar)
			Customers get 502 from the stop until the start answers: 3 to 4 minutes.
			Up to the gate, any failure restores the snapshot and restarts PM2.
			After the gate, nothing rolls back.
			EOF
			;;
		restart)
			cat <<-EOF
			Would, in this order:
			  copy secrets from AWS SSM into .env (see "secrets" above; warn-only)
			  export HEAD and copy node_modules into $BUILD_DIR; build there (nice $BUILD_NICE) while $PM2_APP keeps serving
			  write $BUILD_DIR/.next/MAKY_DEPLOY_META
			  pm2 stop $PM2_APP                                  <- the gap starts
			  sudo mv -T $APP_DIR/.next $(snapshot_name)
			  mv the finished build into $APP_DIR/.next
			  pm2 start $PM2_APP                                 <- the gap ends when it answers
			  gate (rollback if it fails):  homepage/PLP/category/PDP + every referenced CSS/JS, on disk and over local HTTP
			  verify (warn only), append to $DEPLOY_LOG, prune snapshots
			A probe request every ${PROBE_INTERVAL_S}s from just before the stop counts what customers saw.
			Before the stop a failure changes nothing; after it, the snapshot goes back and PM2 restarts.
			EOF
			;;
		bridge)
			cat <<-EOF
			Would, in this order:
			  copy secrets from AWS SSM into .env (see "secrets" above; warn-only)
			  export HEAD and copy node_modules into $BUILD_DIR; build there (nice $BUILD_NICE) while $PM2_APP keeps serving
			  write $BUILD_DIR/.next/MAKY_DEPLOY_META, keep a clean copy of the build
			  start the bridge ($BRIDGE_APP, port $BRIDGE_PORT, clean environment) and run the whole gate on it
			  $NGINX_TOOL set bridge-primary                     <- customers move to the bridge
			  wait for the requests $PM2_APP holds to finish, then pm2 stop $PM2_APP
			  sudo mv -T $APP_DIR/.next $(snapshot_name)
			  mv the clean copy into $APP_DIR/.next, pm2 start $PM2_APP, run the whole gate on it   <- the commit point
			  $NGINX_TOOL set canonical-only                     <- customers move back
			  stop the bridge, remove $BUILD_DIR
			  verify (warn only), append to $DEPLOY_LOG, prune snapshots
			A probe request every ${PROBE_INTERVAL_S}s through nginx counts what customers saw.
			Until nginx points at the bridge a failure changes nothing. After it, a failure restores the snapshot, starts
			$PM2_APP on its old build, and only then moves customers back. After the commit point nothing rolls back.
			EOF
			;;
		rehearse)
			cat <<-EOF
			Would, in this order:
			  export HEAD and copy node_modules into $BUILD_DIR; build there (nice $BUILD_NICE) while $PM2_APP keeps serving
			  write $BUILD_DIR/.next/MAKY_DEPLOY_META
			  start the bridge ($BRIDGE_APP, port $BRIDGE_PORT, clean environment) and run the whole gate on it
			  stop the bridge, remove $BUILD_DIR
			$PM2_APP, nginx, .env and $DEPLOY_LOG are not touched.
			EOF
			;;
	esac
}

# --- main ----------------------------------------------------------------------------
main() {
	parse_args "$@"
	trap 'exit 130' INT TERM
	trap on_exit EXIT

	take_lock
	preflight
	sync_secrets
	resolve_flow
	if [[ "$FLOW" != "classic" ]]; then
		preflight_aside
	fi

	if (( DRY_RUN == 1 )); then
		print_plan
		COMMITTED=1
		exit 0
	fi

	info "switching with: $FLOW — $FLOW_REASON"
	"run_$FLOW"

	if [[ "$FLOW" == "rehearse" ]]; then
		exit $(( POST_DEPLOY_FAILED == 1 ? 75 : 0 ))
	fi

	step "done"
	if [[ "$FLOW" == "bridge" ]]; then
		info "deployed ${DEPLOY_SHA:0:7} as BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID") through the bridge — ${PROBE_SUMMARY:-customers not measured}"
	else
		info "deployed ${DEPLOY_SHA:0:7} as BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID") ($FLOW) — downtime ${DOWNTIME}s, ${PROBE_SUMMARY:-customers not measured}"
	fi
	warn "now look at $PUBLIC_URL$SMOKE_PATH in a browser: automated checks cannot see a colourless button (§4.2)"

	if (( POST_DEPLOY_FAILED == 1 )); then
		# "see above" is not a diagnosis. A deploy that ends in 75 has to say which step,
		# by name, on the last line — that is the line a tired human actually reads.
		err "POST_DEPLOY_FAILED:"
		for failed_step in ${POST_DEPLOY_FAILED_STEPS+"${POST_DEPLOY_FAILED_STEPS[@]}"}; do
			err "  - ${failed_step}"
		done
		err "the build is live and verified locally; the steps above did not pass"
		exit 75
	fi
	info "POST_DEPLOY_FAILED: none"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main "$@"
fi
