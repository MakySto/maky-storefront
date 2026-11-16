#!/usr/bin/env python3
"""Regenerates src/checkout/lib/consts/phone-examples.ts.

The checkout shows each delivery country's example phone number (placeholder, hint, error text). The numbers come
from python-phonenumbers, the library Saleor validates phone numbers with, so what the form shows as an example is
a number Saleor accepts. Run from the repository root:  pip install phonenumbers && python3 scripts/gen-phone-examples.py
"""
import re

import phonenumbers as p
from phonenumbers import PhoneNumberFormat as F
from phonenumbers import PhoneNumberType as T

TARGET = "src/checkout/lib/consts/phone-examples.ts"
codes = re.findall(r'"([A-Z]{2})"', open("src/checkout/lib/consts/countries.ts").read())
rows = []
for code in codes:
    example = (
        p.example_number_for_type(code, T.MOBILE)
        or p.example_number_for_type(code, T.FIXED_LINE)
        or p.example_number_for_type(code, T.FIXED_LINE_OR_MOBILE)
    )
    if example and p.is_valid_number(example):
        rows.append((code, p.format_number(example, F.NATIONAL), p.format_number(example, F.INTERNATIONAL)))

lines = [
    f"// Generated with python-phonenumbers {p.__version__} (the library Saleor validates with): the national and the international",
    "// form of each country's example mobile number. Regenerate with `scripts/gen-phone-examples.py` (needs `pip install phonenumbers`).",
    "export const PHONE_EXAMPLES: Readonly<Record<string, readonly [national: string, international: string]>> = {",
]
lines += [f'\t{code}: ["{national}", "{international}"],' for code, national, international in rows]
lines.append("};")
open(TARGET, "w").write("\n".join(lines) + "\n")
