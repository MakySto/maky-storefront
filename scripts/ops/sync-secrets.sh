#!/usr/bin/env bash
# Copy the storefront's secrets from AWS SSM Parameter Store into /opt/storefront/.env.
#
# Why this exists (owner, 2026-09-26): keys that another system issues — today the CMS's
# `preview-reader` API key — must reach this server without anybody copying them by hand, and
# never through a chat, a repository or a log. The issuing system writes the key into SSM
# (SecureString); this script copies it into the storefront's .env. Rotation is the same step:
# the issuer writes a new value, this script is run again, the storefront restarts.
#
# Access (set up 2026-09-26 in CloudShell):
#   maky-ec2-ssm-role (this server)  may READ  /maky/storefront/*
#   maky-cms-role     (CMS server)   may WRITE /maky/storefront/cms/* only
#
# Only the parameters named in MAPPINGS below are copied, each onto exactly one variable. A
# parameter the CMS is allowed to write can therefore never override any other setting of the
# storefront, whatever it is called. Values are never printed; only variable NAMES appear in the
# output.
#
# usage: scripts/ops/sync-secrets.sh [--check]
#   --check   report what would change, write nothing
# exit:  0 nothing changed · 10 .env changed (restart the storefront) · 1 error (.env untouched)
#
# A server-side variable needs a restart to take effect, not a rebuild. This script never
# restarts anything itself; the caller decides when.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/storefront/.env}"
REGION="${AWS_REGION:-eu-central-1}"
BACKUP_DIR="${SECRETS_BACKUP_DIR:-/home/ubuntu/.config/maky/env-backups}"
AWS="${AWS_CLI:-$(command -v aws || echo /snap/bin/aws)}"

# SSM parameter -> .env variable. Add a line here to hand the storefront a new secret.
MAPPINGS=(
	"/maky/storefront/cms/PAYLOAD_PREVIEW_API_KEY PAYLOAD_PREVIEW_API_KEY"
)

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

die() {
	echo "sync-secrets: $*" >&2
	exit 1
}

[ -f "$ENV_FILE" ] || die "no $ENV_FILE"
[ -x "$AWS" ] || die "aws cli not found"

# Read every mapped parameter first; any failure leaves .env exactly as it was.
declare -a NAMES=() VALUES=()
for mapping in "${MAPPINGS[@]}"; do
	param="${mapping%% *}"
	name="${mapping##* }"
	err="$(mktemp)"
	if ! value="$("$AWS" ssm get-parameter --region "$REGION" --name "$param" --with-decryption \
		--query Parameter.Value --output text 2>"$err")"; then
		if grep -q ParameterNotFound "$err"; then
			rm -f "$err"
			echo "sync-secrets: $name — not in SSM yet ($param), left as it is"
			continue
		fi
		rm -f "$err"
		die "$name — could not read $param from SSM"
	fi
	rm -f "$err"
	# Written unquoted into .env, which Next reads with variable expansion: only characters that
	# cannot be mis-parsed (no spaces, quotes, `$`, `#` or newlines) are accepted.
	[[ "$value" =~ ^[A-Za-z0-9._~+/=:-]{16,4096}$ ]] || die "$name — the value in SSM has an unexpected shape, not copied"
	NAMES+=("$name")
	VALUES+=("$value")
done

[ "${#NAMES[@]}" -gt 0 ] || { echo "sync-secrets: nothing to copy"; exit 0; }

# Rewrite .env in one step: replace the variable's line, or append it. Values travel to Python
# through its environment, never its command line, so no process listing shows them.
tmp="$(mktemp "$(dirname "$ENV_FILE")/.env.sync.XXXXXX")"
chmod 600 "$tmp"
trap 'rm -f "$tmp"' EXIT

for i in "${!NAMES[@]}"; do
	# `export` is a shell builtin: no process is started, so no argument list carries a value.
	export "SYNC_NAME_$i=${NAMES[$i]}" "SYNC_VALUE_$i=${VALUES[$i]}"
done
export SYNC_COUNT="${#NAMES[@]}"
changed="$(python3 - "$ENV_FILE" "$tmp" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]
wanted = {}
for i in range(int(os.environ["SYNC_COUNT"])):
    wanted[os.environ[f"SYNC_NAME_{i}"]] = os.environ[f"SYNC_VALUE_{i}"]
lines = open(src, encoding="utf-8").read().splitlines()
seen, changed, out = set(), [], []
for line in lines:
    key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
    if key in wanted:
        if key in seen:
            continue  # a duplicate line would shadow the synced one; drop it
        seen.add(key)
        new = f"{key}={wanted[key]}"
        if line != new:
            changed.append(key)
        out.append(new)
    else:
        out.append(line)
for key, value in wanted.items():
    if key not in seen:
        out.append(f"{key}={value}")
        changed.append(key)
open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
print(" ".join(changed))
PY
)"
for i in "${!NAMES[@]}"; do unset "SYNC_NAME_$i" "SYNC_VALUE_$i"; done
unset SYNC_COUNT

if [ -z "$changed" ]; then
	echo "sync-secrets: .env already up to date"
	exit 0
fi

if [ "$CHECK" -eq 1 ]; then
	echo "sync-secrets: would change $changed (--check, nothing written)"
	exit 0
fi

# The previous .env, kept outside the repository and readable by this user only.
install -d -m 700 "$BACKUP_DIR"
install -m 600 "$ENV_FILE" "$BACKUP_DIR/env.$(date -u +%Y%m%dT%H%M%SZ)"
ls -1t "$BACKUP_DIR"/env.* 2>/dev/null | tail -n +6 | xargs -r rm -f

mv -f "$tmp" "$ENV_FILE"
trap - EXIT
echo "sync-secrets: changed $changed — restart the storefront for it to take effect"
exit 10
