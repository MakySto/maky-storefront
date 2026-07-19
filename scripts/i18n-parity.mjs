#!/usr/bin/env node
/**
 * i18n catalog gates (krok 2/3):
 *
 *   node scripts/i18n-parity.mjs            # report
 *   node scripts/i18n-parity.mjs --strict   # exit 1 on any finding (post-translation-bundle gate)
 *
 * Checks, per locale file vs the en-US source:
 *  1. exact key parity (missing / extra)
 *  2. placeholder parity ({name} sets must match per key)
 *  3. ICU plural sanity (plural blocks parse; sk/cs need one+few+other branches)
 *  4. unintended-English report: values byte-identical to en-US (candidates only — brand nouns
 *     and genuinely shared strings are legitimate; review the list, don't auto-fail pre-bundle)
 *
 * Before the reviewed 13-locale translation bundle lands, missing keys in the 11 non-source
 * locales are EXPECTED (new commerce keys ship in sk-SK + en-US only; the runtime deep-merge in
 * src/i18n/request.ts serves the EN source for those). --strict is the post-bundle gate.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/i18n/messages");
const SOURCE = "en-US";
const STRICT = process.argv.includes("--strict");
const MULTI_PLURAL = new Set(["sk-SK", "cs-CZ", "pl-PL", "ro-RO"]); // need one/few/other at minimum

const locales = fs
	.readdirSync(DIR)
	.filter((f) => f.endsWith(".json"))
	.map((f) => f.replace(".json", ""))
	.sort();

const load = (l) => JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), "utf8"));

const flat = (obj, prefix = "") => {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, key));
		else out[key] = String(v);
	}
	return out;
};

// {name} placeholders, excluding ICU plural/select internals
const placeholders = (msg) => {
	const found = new Set();
	const re = /\{(\w+)(?:,\s*(plural|select|selectordinal|number|date|time)[^]*?)?\}/g;
	let m;
	while ((m = re.exec(msg))) found.add(m[1]);
	return found;
};

const pluralBranches = (msg) => {
	const m = msg.match(/\{(\w+),\s*plural\s*,([^]*)\}/);
	if (!m) return null;
	return [...m[2].matchAll(/(?:^|\s)(one|few|many|other|zero|two|=\d+)\s*\{/g)].map((x) => x[1]);
};

const source = flat(load(SOURCE));
const sourceKeys = new Set(Object.keys(source));
let findings = 0;
const note = (locale, kind, detail) => {
	findings += 1;
	console.log(`${locale}  ${kind}  ${detail}`);
};

let identicalReport = [];

for (const locale of locales) {
	if (locale === SOURCE) continue;
	const messages = flat(load(locale));
	const keys = new Set(Object.keys(messages));

	for (const k of sourceKeys) if (!keys.has(k)) note(locale, "MISSING", k);
	for (const k of keys) if (!sourceKeys.has(k)) note(locale, "EXTRA", k);

	for (const k of keys) {
		if (!sourceKeys.has(k)) continue;
		const a = [...placeholders(source[k])].sort().join(",");
		const b = [...placeholders(messages[k])].sort().join(",");
		if (a !== b) note(locale, "PLACEHOLDERS", `${k}: source{${a}} vs ${locale}{${b}}`);

		const branches = pluralBranches(messages[k]);
		if (branches) {
			if (!branches.includes("other")) note(locale, "PLURAL", `${k}: missing 'other' branch`);
			if (MULTI_PLURAL.has(locale) && !(branches.includes("few") && branches.includes("one")))
				note(locale, "PLURAL", `${k}: ${locale} needs one+few branches (has: ${branches.join("/")})`);
		}

		if (messages[k] === source[k] && /[A-Za-z]{3,}/.test(source[k])) {
			identicalReport.push(`${locale}: ${k} = ${JSON.stringify(source[k]).slice(0, 60)}`);
		}
	}
}

if (identicalReport.length) {
	console.log(`\n— values identical to en-US (${identicalReport.length}; review, may be legitimate):`);
	for (const line of identicalReport.slice(0, 40)) console.log("  " + line);
	if (identicalReport.length > 40) console.log(`  … +${identicalReport.length - 40} more`);
}

console.log(`\n${locales.length} locales, ${sourceKeys.size} source keys, ${findings} parity findings`);

if (STRICT && findings > 0) process.exit(1);
