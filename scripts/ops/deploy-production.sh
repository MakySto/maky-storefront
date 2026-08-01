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
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/storefront}"
ROLLBACK_DIR="${ROLLBACK_DIR:-/opt/storefront-rollbacks}"
PM2_APP="${PM2_APP:-maky-storefront}"          # never maky-smtp-app: separate service, transactional mail
LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3000}"
PUBLIC_URL="${PUBLIC_URL:-https://maky.store}"
SMOKE_PATH="${SMOKE_PATH:-/sk}"
DEPLOY_LOG="${DEPLOY_LOG:-/opt/DEPLOYMENTS.log}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-2}"
MIN_FREE_MEM_MB="${MIN_FREE_MEM_MB:-10240}"
MIN_FREE_DISK_MB="${MIN_FREE_DISK_MB:-10240}"
READY_TIMEOUT_S="${READY_TIMEOUT_S:-120}"
MIN_ASSET_BYTES="${MIN_ASSET_BYTES:-1000}"

DRY_RUN=0
ALLOW_DIRTY=0
NOTE=""

# --- state the failure handler needs -----------------------------------------------
SNAPSHOT=""          # absolute path of the moved-out .next; empty until it is moved
COMMITTED=0          # 1 once the smoke test has passed
DOWN_FROM=0
DOWNTIME=0
BUILD_LOG="/tmp/maky-deploy-$(date -u +%Y%m%d-%H%M%S).log"
PREV_BUILD_ID="none"

c_red=$'\033[31m'; c_yel=$'\033[33m'; c_grn=$'\033[32m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
info() { printf '%s==>%s %s\n' "$c_grn" "$c_off" "$*"; }
step() { printf '\n%s=== %s ===%s\n' "$c_dim" "$*" "$c_off"; }
warn() { printf '%swarn:%s %s\n' "$c_yel" "$c_off" "$*" >&2; }
err()  { printf '%serror:%s %s\n' "$c_red" "$c_off" "$*" >&2; }
die()  { err "$*"; exit 1; }

usage() {
	sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
	cat <<-EOF

	Options:
	  -m, --note TEXT   what is going out and why (recorded in $DEPLOY_LOG)
	      --dry-run     run preflight, print the plan, change nothing
	      --allow-dirty deploy with a dirty working tree (you will not know what you built)
	  -h, --help        this text
	EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-m|--note)     NOTE="${2:-}"; shift 2 ;;
		--dry-run)     DRY_RUN=1; shift ;;
		--allow-dirty) ALLOW_DIRTY=1; shift ;;
		-h|--help)     usage; exit 0 ;;
		*)             die "unknown argument: $1 (try --help)" ;;
	esac
done

# --- failure handling ---------------------------------------------------------------
# Any exit before the smoke test passes restores the previous build. A partial .next is
# never started (CLAUDE.md §13.4).
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
		rm -rf "$APP_DIR/.next"
	fi

	info "restoring $(basename "$SNAPSHOT")"
	sudo mv "$SNAPSHOT" "$APP_DIR/.next"
	SNAPSHOT=""
	pm2 start "$PM2_APP" >/dev/null 2>&1 || pm2 restart "$PM2_APP" >/dev/null 2>&1 || true

	if wait_ready "${RESTORE_TIMEOUT_S:-60}" && [[ "$(http_code "$LOCAL_URL$SMOKE_PATH")" == "200" ]]; then
		info "previous build is back up"
	else
		err "RESTORE DID NOT COME UP — the site is down, intervene now"
		err "  pm2 logs $PM2_APP --nostream --lines 50"
		return 1
	fi
}

on_exit() {
	local code=$?
	trap - EXIT
	if (( code == 0 )) && (( COMMITTED == 1 )); then
		exit 0
	fi
	err "deploy failed (exit $code)"
	restore || true
	err "build log: $BUILD_LOG"
	exit "$code"
}
trap 'exit 130' INT TERM
trap on_exit EXIT

# --- helpers -------------------------------------------------------------------------
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$1" 2>/dev/null || echo 000; }

# Fetch a URL and require 200 with a non-trivial body. A 200 serving an empty file is
# still a broken site.
require_asset() {
	local url="$1" out code size
	out=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 25 "$url" 2>/dev/null) || out="000 0"
	code="${out%% *}"; size="${out##* }"
	[[ "$code" == "200" ]] || die "$url → HTTP $code"
	if (( size < MIN_ASSET_BYTES )); then
		die "$url → 200 but only ${size} B (expected ≥ ${MIN_ASSET_BYTES})"
	fi
	info "ok  $url  (${size} B)"
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

# --- steps ---------------------------------------------------------------------------
preflight() {
	step "preflight"

	[[ "${EUID:-$(id -u)}" -ne 0 ]] || die "run as ubuntu, not root — a root build makes .next unwritable for PM2"
	[[ -d "$APP_DIR/.git" ]] || die "$APP_DIR is not a git checkout"
	cd "$APP_DIR"

	[[ -z "${NEXT_OUTPUT:-}" ]] || die "NEXT_OUTPUT='$NEXT_OUTPUT' is set — production runs in normal mode (CLAUDE.md §13.6); unset it"

	local cmd
	for cmd in pnpm pm2 curl git; do
		command -v "$cmd" >/dev/null || die "$cmd not found in PATH"
	done
	pm2 describe "$PM2_APP" >/dev/null 2>&1 || die "PM2 knows no app called '$PM2_APP'"

	# Ask for sudo now, not halfway through with the site already stopped.
	sudo -v || die "sudo is required (snapshot moves into $ROLLBACK_DIR, and $DEPLOY_LOG)"
	[[ -d "$ROLLBACK_DIR" ]] || { info "creating $ROLLBACK_DIR"; sudo mkdir -p "$ROLLBACK_DIR"; }

	local avail_mem avail_disk
	avail_mem=$(free -m | awk '/^Mem:/ {print $7}')
	avail_disk=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
	info "memory available: ${avail_mem} MB   disk free: ${avail_disk} MB"
	(( avail_mem >= MIN_FREE_MEM_MB )) || die "only ${avail_mem} MB of memory available, need ${MIN_FREE_MEM_MB}"
	(( avail_disk >= MIN_FREE_DISK_MB )) || die "only ${avail_disk} MB of disk free, need ${MIN_FREE_DISK_MB}"

	if [[ -n "$(git status --porcelain)" ]]; then
		git status --short | head -20 >&2
		if (( ALLOW_DIRTY == 1 )); then
			warn "working tree is dirty and --allow-dirty was passed — you will not be able to reproduce this build"
		else
			die "working tree is dirty; commit, stash, or pass --allow-dirty"
		fi
	fi

	if [[ -f "$APP_DIR/.next/BUILD_ID" ]]; then
		PREV_BUILD_ID=$(cat "$APP_DIR/.next/BUILD_ID")
	elif [[ "${ALLOW_NO_BASELINE:-0}" == "1" ]]; then
		warn "no current .next/BUILD_ID — deploying without a rollback point (ALLOW_NO_BASELINE=1)"
	else
		die "no .next/BUILD_ID in $APP_DIR — there is nothing to snapshot, so this deploy would have no rollback.
Restore a snapshot first (CLAUDE.md §13.3), or set ALLOW_NO_BASELINE=1 if that is genuinely intended."
	fi

	info "deploying $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD)) — $(git log -1 --format=%s)"
	info "currently serving BUILD_ID $PREV_BUILD_ID"
	ps -eo pid,comm,rss --sort=-rss | head -5
}

snapshot() {
	step "stop + snapshot"
	DOWN_FROM=$(date +%s)
	pm2 stop "$PM2_APP" >/dev/null
	info "$PM2_APP stopped — downtime starts now"

	[[ -e "$APP_DIR/.next" ]] || { warn "no .next to snapshot"; return 0; }

	local sha name
	sha=$(git rev-parse --short HEAD)
	name="$ROLLBACK_DIR/.next.rollback-${sha}-${PREV_BUILD_ID}"
	if [[ -e "$name" ]]; then
		name="${name}-$(date -u +%H%M%S)"
	fi
	sudo mv "$APP_DIR/.next" "$name"
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
	# on since. This travels with the artifact into the rollback directory.
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

smoke() {
	step "smoke test"
	local html css disk_css
	html=$(mktemp)
	# shellcheck disable=SC2064
	trap "rm -f '$html'" RETURN

	curl -fsS --max-time 25 "$LOCAL_URL$SMOKE_PATH" -o "$html" || die "local page did not respond"

	# Next 16 / Turbopack emits stylesheets under /_next/static/chunks/, NOT
	# /_next/static/css/. Anchoring on the latter matches nothing on a healthy page.
	css=$(grep -oE '/_next/static/[^"]+\.css' "$html" | head -1 || true)
	[[ -n "$css" ]] || die "no CSS chunk referenced in the served HTML — the page would render unstyled"

	# The chunk the server advertises must exist in the build we just made. This is the
	# direct test for the stale-chunk failure in §13.1.
	disk_css="$APP_DIR/.next/${css#/_next/}"
	[[ -f "$disk_css" ]] || die "served CSS $css is not present in this build ($disk_css)"

	require_asset "$LOCAL_URL$css"
	require_asset "$PUBLIC_URL$SMOKE_PATH"
	require_asset "$PUBLIC_URL$css"

	DOWNTIME=$(( $(date +%s) - DOWN_FROM ))
	COMMITTED=1
	info "smoke passed — downtime ${DOWNTIME}s"
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
		echo "previous: ${PREV_BUILD_ID}"
		echo "snapshot: ${snap_name}"
		echo "downtime: ${DOWNTIME}s"
		echo "note:     ${NOTE:-<none>}"
	} | sudo tee -a "$DEPLOY_LOG" >/dev/null
	info "appended to $DEPLOY_LOG"
}

prune() {
	step "prune snapshots"
	local -a snaps=()
	mapfile -t snaps < <(find "$ROLLBACK_DIR" -maxdepth 1 -mindepth 1 -type d -name '.next.rollback-*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{print $2}')
	local kept=0 s
	for s in "${snaps[@]}"; do
		if [[ -e "$s/.keep" ]]; then
			info "pinned, keeping: $(basename "$s")"
			continue
		fi
		kept=$(( kept + 1 ))
		if (( kept > KEEP_SNAPSHOTS )); then
			info "pruning: $(basename "$s")"
			sudo rm -rf "$s"
		fi
	done
}

# --- main ----------------------------------------------------------------------------
preflight

if (( DRY_RUN == 1 )); then
	step "dry run — nothing was changed"
	cat <<-EOF
	Would, in this order:
	  pm2 stop $PM2_APP
	  sudo mv $APP_DIR/.next $ROLLBACK_DIR/.next.rollback-$(git rev-parse --short HEAD)-${PREV_BUILD_ID}
	  pnpm build
	  write $APP_DIR/.next/MAKY_DEPLOY_META
	  pm2 start $PM2_APP
	  smoke: $LOCAL_URL$SMOKE_PATH + its CSS chunk, then the same through $PUBLIC_URL
	  append to $DEPLOY_LOG
	  keep the newest $KEEP_SNAPSHOTS snapshots (plus any with a .keep file)
	On any failure the snapshot is restored and PM2 restarted.
	EOF
	COMMITTED=1
	exit 0
fi

snapshot
build
write_meta
start
smoke
write_deploy_log
prune

step "done"
info "deployed $(git rev-parse --short HEAD) as BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID") — downtime ${DOWNTIME}s"
warn "now look at $PUBLIC_URL$SMOKE_PATH in a browser: automated checks cannot see a colourless button (§4.2)"
