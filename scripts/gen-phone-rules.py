#!/usr/bin/env python3
"""Regenerates src/checkout/lib/consts/phone-rules.ts.

When Saleor refuses a phone number, the checkout says what is wrong with it (a digit short, a digit too many, a
mobile number of another market written without its calling code). That needs the numbering rules Saleor itself
validates with, which are the metadata of python-phonenumbers. This script reads them out of the package archive as
text (zipfile + ast, nothing from the archive is imported or run), so it needs no installed package:

    pip download phonenumbers==9.0.43 --no-deps -d /tmp/pn
    python3 -I scripts/gen-phone-rules.py /tmp/pn/phonenumbers-9.0.43-py2.py3-none-any.whl
    pnpm prettier --write src/checkout/lib/consts/phone-rules.ts

Only the countries of the twelve markets are written: the table is for explaining a refusal, never for refusing.
"""
import ast
import json
import re
import sys
import zipfile

TARGET = "src/checkout/lib/consts/phone-rules.ts"
MARKETS = ["SK", "CZ", "DE", "AT", "PL", "HU", "IT", "FR", "ES", "RO", "US", "CA"]
# The order python-phonenumbers asks the types in; a number is valid when the general pattern and one of these match.
TYPES = [
    "premium_rate", "toll_free", "shared_cost", "voip", "personal_number",
    "pager", "uan", "voicemail", "fixed_line", "mobile",
]  # fmt: skip


def metadata(archive: zipfile.ZipFile, code: str) -> dict:
    tree = ast.parse(archive.read(f"phonenumbers/data/region_{code}.py").decode("utf-8"))
    call = next(
        node.value
        for node in tree.body
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and node.value.func.id == "PhoneMetadata"
    )
    found: dict = {}
    for keyword in call.keywords:
        value = keyword.value
        if isinstance(value, ast.Constant):
            found[keyword.arg] = value.value
        elif isinstance(value, ast.Call) and value.func.id == "PhoneNumberDesc":
            found[keyword.arg] = {
                inner.arg: ast.literal_eval(inner.value) for inner in value.keywords
            }
    return found


def main() -> None:
    wheel = sys.argv[1]
    version = re.search(r"phonenumbers-([\d.]+)-", wheel).group(1)
    rows = []
    with zipfile.ZipFile(wheel) as archive:
        for code in MARKETS:
            data = metadata(archive, code)
            row = {
                "callingCode": str(data["country_code"]),
                "general": data["general_desc"]["national_number_pattern"],
                "types": [
                    data[name]["national_number_pattern"]
                    for name in TYPES
                    if data.get(name, {}).get("national_number_pattern")
                ],
                "mobile": data.get("mobile", {}).get("national_number_pattern"),
            }
            if data.get("national_prefix_for_parsing"):
                row["trunk"] = data["national_prefix_for_parsing"]
            if data.get("national_prefix_transform_rule"):
                # None of the twelve markets rewrites its trunk prefix; the reader of this table only drops it.
                raise SystemExit(f"{code}: a trunk prefix transform rule is not supported")
            rows.append((code, row))

    lines = [
        f"// Generated with scripts/gen-phone-rules.py from python-phonenumbers {version}, the library Saleor validates phone",
        "// numbers with. Do not edit by hand. The patterns are regular-expression sources for the national number (without",
        "// the calling code and the trunk prefix). They explain a number Saleor refused; they never refuse one themselves.",
        "export type PhoneRule = {",
        "\t/** The country calling code, digits only. */",
        "\treadonly callingCode: string;",
        "\t/** What every national number of the country looks like. */",
        "\treadonly general: string;",
        "\t/** The kinds of number the country has; a number is valid when `general` and one of these match it whole. */",
        "\treadonly types: readonly string[];",
        "\t/** The mobile numbers alone. */",
        "\treadonly mobile: string | null;",
        "\t/** The trunk prefix people dial inside the country (\"0\", \"06\", \"1\"), as a pattern at the start of the number. */",
        "\treadonly trunk?: string;",
        "};",
        "",
        "export const PHONE_RULES: Readonly<Record<string, PhoneRule>> = {",
    ]
    for code, row in rows:
        lines.append(f"\t{code}: {json.dumps(row, ensure_ascii=False)},")
    lines.append("};")
    open(TARGET, "w").write("\n".join(lines) + "\n")
    print(f"{TARGET}: {len(rows)} countries")


main()
