#!/usr/bin/env bash
#
# Has Cloudflare changed the ranges nginx trusts?
#
# `set_real_ip_from` is a TRUST list: nginx believes CF-Connecting-IP from any address in
# it. So it must be neither stale nor self-updating.
#
#   - stale, missing a range: real visitors arriving through a new Cloudflare POP are
#     logged and rate-limited as that POP, silently, for everyone behind it;
#   - self-updating from the internet: a web server that rewrites its own trust list from
#     a URL is a worse failure than the one it prevents.
#
# So this only ever REPORTS. Applying a change is a person editing the file, and the same
# ranges also live in the AWS prefix list that the security group points at — a drift that
# is fixed in one place and not the other is the outage this script exists to prevent.
#
# Exit 0 in sync, 1 drifted, 2 could not ask Cloudflare.
set -uo pipefail

CONF="${CONF:-/etc/nginx/conf.d/00-cloudflare-realip.conf}"
[[ -r "$CONF" ]] || { echo "cannot read $CONF"; exit 2; }

fetch() { curl -fsS --max-time 20 "$1"; }

# `echo` between the two, not a bare concatenation: Cloudflare's lists do not end with a
# newline, so joining them directly welds the last IPv4 range onto the first IPv6 one and
# invents a range that exists in neither. This script found exactly that bug in its own
# first draft.
upstream=$( { fetch https://www.cloudflare.com/ips-v4; echo; fetch https://www.cloudflare.com/ips-v6; echo; } | grep -v '^$' | sort -u ) \
	|| { echo "could not fetch the Cloudflare ranges — nothing was compared"; exit 2; }

# Guard against an upstream that answers 200 with something useless: acting on a truncated
# list would quietly narrow the trust list to whatever came back.
count=$(wc -l <<<"$upstream")
(( count >= 15 )) || { echo "refusing a suspiciously short list from Cloudflare ($count entries)"; exit 2; }

installed=$(grep -oE '^set_real_ip_from[[:space:]]+[^;]+' "$CONF" | awk '{print $2}' | sort -u)

added=$(comm -23 <(echo "$upstream") <(echo "$installed"))
removed=$(comm -13 <(echo "$upstream") <(echo "$installed"))

if [[ -z "$added" && -z "$removed" ]]; then
	echo "cloudflare ranges: in sync ($count entries)"
	exit 0
fi

echo "cloudflare ranges: DRIFTED — $CONF no longer matches what Cloudflare publishes"
[[ -n "$added" ]] && { echo "  new at Cloudflare, missing here (visitors behind these are logged as the POP):"; sed 's/^/    + /' <<<"$added"; }
[[ -n "$removed" ]] && { echo "  trusted here, no longer Cloudflare's (stop trusting these):"; sed 's/^/    - /' <<<"$removed"; }
echo "  fix BOTH: this file (then nginx -t && systemctl reload nginx) and the AWS prefix list the security group points at."
exit 1
