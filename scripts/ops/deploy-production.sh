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

DRY_RUN=0
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
MARKET_LOG_FILE=""      # PM2 stdout log for $PM2_APP, resolved just before start
MARKET_LOG_OFFSET=0     # its size in bytes at that moment — this boot's log boundary
BUILD_LOG="/tmp/maky-deploy-$(date -u +%Y%m%d-%H%M%S).log"
CSS_PATH=""
declare -A CHECKED_BUILD_ASSETS=()

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
# Build chunks can legitimately be tiny. Require an exact nonzero byte match
# between this build's file and the body served by the new local process.
require_local_build_asset() {
	local asset="$1" disk_asset="$2"
	local out code served_size disk_size

	disk_size=$(stat -c '%s' -- "$disk_asset")
	(( disk_size > 0 )) || die "$asset is empty on disk ($disk_asset)"

	out=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 25 "$LOCAL_URL$asset" 2>/dev/null) \
		|| out="000 0"
	code="${out%% *}"
	served_size="${out##* }"
	[[ "$served_size" =~ ^[0-9]+$ ]] || die "$asset returned an invalid byte count: $served_size"
	[[ "$code" == "200" ]] || die "$LOCAL_URL$asset → HTTP $code, ${served_size} B"
	(( served_size == disk_size )) \
		|| die "$asset size mismatch: served ${served_size} B, build has ${disk_size} B"

	info "ok  $LOCAL_URL$asset  (${served_size} B, matches build)"
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

preflight() {
	step "preflight"

	[[ "${EUID:-$(id -u)}" -ne 0 ]] || die "run as ubuntu, not root — a root build makes .next unwritable for PM2"
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

	python3 - "$LOCAL_URL" "$market" <<'PY'
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
	curl -fsS --max-time 25 "$LOCAL_URL$path" -o "$html" || die "$label did not respond at $path"
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
		disk_asset="$APP_DIR/.next/${asset#/_next/}"
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
gate_local() {
	step "gate — local artifact"
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

	DOWNTIME=$(( $(date +%s) - DOWN_FROM ))
	COMMITTED=1
	info "local gate passed — downtime ${DOWNTIME}s. From here the new build stays."
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
		find "$APP_DIR/public" -type f -printf '/%P\n' | sort
	)
	# An empty `find` would make the loop below iterate over nothing and still
	# print a reassuring count. Same defect shape as the sitemap check.
	(( ${#assets[@]} > 0 )) || die "no files found under $APP_DIR/public — the static-asset check would pass vacuously"

	assets+=(/robots.txt /sitemap.xml /icon.png /apple-icon.png /opengraph-image.png /twitter-image.png /favicon.ico)

	for path in "${assets[@]}"; do
		code=$(http_code "$LOCAL_URL$path")
		[[ "$code" == "200" ]] || die "static asset $path answered $code — the matcher change has broken public/"
	done
	info "static assets and metadata routes: ${#assets[@]} × 200"

	# Junk must 404, including the dotted first segments that used to bypass the proxy.
	for path in /admin.php /wp-login.php /index.php /does.not.exist /does.not.exist/categories/x /wishlist; do
		code=$(http_code "$LOCAL_URL$path")
		[[ "$code" == "404" ]] || die "$path answered $code, expected 404 — the invalid-first-segment gate is open"
	done
	info "bogus paths (dotted and plain): 404"

	# Sitemap: reachable, parses, and not suspiciously short. A truncated sitemap
	# reads to Google as "the missing URLs are gone", and is indistinguishable
	# from a complete one without a floor to compare against.
	body=$(new_tmp)
	curl -fsS --max-time 25 "$LOCAL_URL/sitemap.xml" -o "$body" || die "/sitemap.xml did not respond"

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
	count=$(python3 - "$body" "$LOCAL_URL" <<'PY' 2>&1
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
	for path in "$SMOKE_PATH" "$SMOKE_PATH/products"; do
		code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 -H 'RSC: 1' "$LOCAL_URL$path" 2>/dev/null || echo 000)
		[[ "$code" == "200" ]] || die "RSC navigation to $path answered $code — client-side routing is broken"
	done
	info "RSC navigation: 200"

	# The pages a customer actually needs.
	for path in "$SMOKE_PATH/products" /checkout; do
		code=$(http_code "$LOCAL_URL$path")
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
	  gate (rollback if it fails):  homepage/PLP/category/PDP + every referenced CSS/JS, on disk and over local HTTP
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
soft "market language"      check_market_language
soft "deployment log"       write_deploy_log
soft "snapshot pruning"     prune

step "done"
info "deployed $(git rev-parse --short HEAD) as BUILD_ID $(cat "$APP_DIR/.next/BUILD_ID") — downtime ${DOWNTIME}s"
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
