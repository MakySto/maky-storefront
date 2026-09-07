// Are all 12 message files structurally identical?
//
//   node scripts/i18n/check-message-parity.mjs
//
// CLAUDE.md §11 has stated this invariant since June and gives the one-liner to test
// it, but nothing ran it — so on 2026-09-07 `en-CA.json` was found holding 236 of 448
// keys. The entire `cart.*` and `checkout.*` vocabulary was absent. next-intl is not
// type-augmented here, so a missing key is not a build error and not a type error: it
// throws at render, in that market, on that screen, and nowhere else.
//
// The two checks that already run are about different questions. `check-commerce-i18n`
// verifies the manifest closure (every key the code asks for exists); `check-locale-
// matrix` verifies code and matrix agree about which locales exist. Neither compares
// one message file against another, which is why a locale can quietly lose 47% of its
// keys with both of them green.
//
// The invariant is "all 12 identical", not "all 12 have N keys" — the count moves as
// keys are added and removed, and pinning it would only produce a number to update.
//
// Exit 0 = identical. Exit 1 = at least one file drifted.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const DIR = new URL("../../src/i18n/messages/", import.meta.url).pathname;
const REFERENCE = "en-US";

/** Dotted paths of every leaf. Arrays count as leaves — order inside one is not structure. */
function leaves(value, prefix = "") {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
	return Object.keys(value).flatMap((key) => leaves(value[key], prefix ? `${prefix}.${key}` : key));
}

const locales = readdirSync(DIR)
	.filter((name) => name.endsWith(".json"))
	.map((name) => name.replace(/\.json$/, ""))
	.sort();

if (!locales.includes(REFERENCE)) {
	console.error(`message parity — no ${REFERENCE}.json to compare against`);
	process.exit(2);
}

const read = (locale) => new Set(leaves(JSON.parse(readFileSync(join(DIR, `${locale}.json`), "utf8"))));
const reference = read(REFERENCE);

let drifted = 0;
for (const locale of locales) {
	if (locale === REFERENCE) continue;
	const keys = read(locale);
	const missing = [...reference].filter((key) => !keys.has(key));
	const extra = [...keys].filter((key) => !reference.has(key));
	if (missing.length === 0 && extra.length === 0) continue;

	drifted += 1;
	console.error(`\n${locale}: missing ${missing.length}, extra ${extra.length}`);
	for (const key of missing.slice(0, 10)) console.error(`  missing  ${key}`);
	if (missing.length > 10) console.error(`  …and ${missing.length - 10} more missing`);
	for (const key of extra.slice(0, 10)) console.error(`  extra    ${key}`);
	if (extra.length > 10) console.error(`  …and ${extra.length - 10} more extra`);
}

if (drifted > 0) {
	console.error(
		`\nmessage parity FAILED — ${drifted} of ${locales.length} locales drifted from ${REFERENCE}`,
	);
	process.exit(1);
}

console.log(`message parity OK — ${locales.length} locales, ${reference.size} keys, identical`);
