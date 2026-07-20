// Runtime-closure gate for the commerce copy manifest (docs/i18n/commerce-source-en.json).
//
// Verifies, failing the process on any violation:
//  1. every runtime-used commerce key (static extraction + declared dynamic patterns) is in
//     the manifest;
//  2. every manifest storefront key with runtimeStatus "production" has >= 1 runtime
//     call-site; keys without call-sites must be runtimeStatus "dormant" or "staging-only";
//  3. manifest sources are byte-identical with the en-US catalog (single source of truth),
//     and every commerce key in the en-US catalog is in the manifest;
//  4. the placeholder registry (docs/i18n/commerce-placeholders.json) equals the registry
//     regenerated from the manifest, and each key's declared placeholders match the {x}
//     tokens of its source;
//  5. ICU plurals in every locale catalog carry at least the locale's integer plural
//     categories (a locale MAY define more branches than the EN source);
//  6. the documented hardcoded-string exceptions (scripts/i18n/hardcoded-exceptions.json)
//     still match reality — no silent drift in either direction.
//
// email.* keys live in the maky-apps SMTP repo; pass SMTP_APP_DIR=<path to apps/smtp> to
// verify them against that repo's catalogs (skipped with a warning otherwise).
import fs from "node:fs";
import path from "node:path";

import { extractAllCommerceUsage, isCommerceKey } from "./extract-commerce-usage.mjs";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(repoRoot, p), "utf8"));

const manifest = read("docs/i18n/commerce-source-en.json");
const registry = read("docs/i18n/commerce-placeholders.json");
const enUS = read("src/i18n/messages/en-US.json");
const skSK = read("src/i18n/messages/sk-SK.json");

const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-GB",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
];

const errors = [];
const warnings = [];

const flatten = (obj, prefix = "") => {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) {
			Object.assign(out, flatten(v, key));
		} else {
			out[key] = v;
		}
	}
	return out;
};

const manifestKeys = manifest.keys;
const storefrontManifestKeys = Object.keys(manifestKeys).filter((k) => !k.startsWith("email."));
const emailManifestKeys = Object.keys(manifestKeys).filter((k) => k.startsWith("email."));
const flatEn = flatten(enUS);
const flatSk = flatten(skSK);

// ——— 1 + 2: runtime closure ————————————————————————————————————————————————
const { keys: usage } = extractAllCommerceUsage(repoRoot);

for (const key of usage.keys()) {
	if (!manifestKeys[key]) {
		errors.push(`runtime key not in manifest: ${key} (${usage.get(key)[0]})`);
	}
}

const statusCounts = { production: 0, "staging-only": 0, dormant: 0 };

for (const key of storefrontManifestKeys) {
	const entry = manifestKeys[key];
	const status = entry.runtimeStatus ?? "production";
	if (!(status in statusCounts)) {
		errors.push(`manifest key ${key}: unknown runtimeStatus "${status}"`);
		continue;
	}
	statusCounts[status] += 1;
	const sites = usage.get(key) ?? [];
	if (status === "production" && sites.length === 0) {
		errors.push(`production manifest key has no runtime call-site: ${key}`);
	}
	if (status !== "production" && sites.length === 0 && !entry.dormantNote) {
		warnings.push(`${status} key ${key} has no call-site and no dormantNote explaining why it is kept`);
	}
}

// ——— 3: manifest sources === en-US catalog ————————————————————————————————
for (const key of storefrontManifestKeys) {
	if (!(key in flatEn)) {
		errors.push(`manifest key missing from en-US catalog: ${key}`);
		continue;
	}
	if (manifestKeys[key].source !== flatEn[key]) {
		errors.push(`manifest source out of sync with en-US catalog: ${key}`);
	}
	if (!(key in flatSk)) {
		errors.push(`manifest key missing from sk-SK catalog: ${key}`);
	}
}
for (const key of Object.keys(flatEn)) {
	if (isCommerceKey(key) && !manifestKeys[key]) {
		errors.push(`en-US commerce catalog key not in manifest: ${key}`);
	}
}

// ——— 4: placeholder registry is generated from the manifest ————————————————
const extractPlaceholders = (source) => {
	// ICU-aware: plural/select constructs contribute their ARGUMENT name; their branch
	// text is stripped so words inside branches (e.g. "{business day}") are not
	// mistaken for placeholders.
	const names = new Set();
	let stripped = source;
	const icuRe = /\{(\w+),\s*(?:plural|select|selectordinal),/g;
	let m;
	while ((m = icuRe.exec(stripped))) {
		names.add(m[1]);
		let i = icuRe.lastIndex;
		let depth = 1;
		while (i < stripped.length && depth > 0) {
			if (stripped[i] === "{") depth++;
			else if (stripped[i] === "}") depth--;
			i++;
		}
		stripped = stripped.slice(0, m.index) + stripped.slice(i);
		icuRe.lastIndex = 0;
	}
	for (const token of stripped.matchAll(/\{(\w+)\}/g)) {
		names.add(token[1]);
	}
	return names;
};

const regenerated = {
	$about: registry.$about,
	byKey: {},
};

for (const key of Object.keys(manifestKeys).sort()) {
	const entry = manifestKeys[key];
	const tokens = [...extractPlaceholders(entry.source)];
	const declared = Object.keys(entry.placeholders ?? {});
	const missingDecl = tokens.filter((t) => !declared.includes(t));
	const extraDecl = declared.filter((d) => !tokens.includes(d));
	if (missingDecl.length) {
		errors.push(`${key}: source has undeclared placeholders {${missingDecl.join(", ")}}`);
	}
	if (extraDecl.length) {
		errors.push(`${key}: declares placeholders not present in source: {${extraDecl.join(", ")}}`);
	}
	if (declared.length) {
		regenerated.byKey[key] = entry.placeholders;
	}
}

if (JSON.stringify(registry.byKey) !== JSON.stringify(regenerated.byKey)) {
	errors.push(
		"commerce-placeholders.json is out of date — regenerate with: node scripts/i18n/check-commerce-i18n.mjs --write-registry",
	);
}

if (process.argv.includes("--write-registry")) {
	fs.writeFileSync(
		path.join(repoRoot, "docs/i18n/commerce-placeholders.json"),
		JSON.stringify(regenerated, null, "\t") + "\n",
	);
	console.log("registry written");
}

// ——— 5: ICU plural branches per locale ————————————————————————————————————
// Integer plural categories for realistic commerce counts (0–200). Deliberately excludes
// the large-number categories some locales add at 10^6+ (fr/es/it "many") — item counts
// and delivery days never get there.
const integerPluralCategories = (locale) => {
	const rules = new Intl.PluralRules(locale);
	const set = new Set();
	for (let n = 0; n <= 200; n++) {
		set.add(rules.select(n));
	}
	return set;
};

const pluralBranches = (message) => {
	// returns array of {arg, branches[]} for each ICU plural in the message
	const results = [];
	const re = /\{(\w+),\s*plural,/g;
	let m;
	while ((m = re.exec(message))) {
		let i = re.lastIndex;
		let depth = 1;
		const branches = [];
		let word = "";
		while (i < message.length && depth > 0) {
			const ch = message[i];
			if (ch === "{") {
				if (depth === 1 && word.trim()) branches.push(word.trim().replace(/^=/, "="));
				depth++;
			} else if (ch === "}") {
				depth--;
				if (depth === 1) word = "";
			} else if (depth === 1) {
				word += ch;
			}
			i++;
		}
		results.push({ arg: m[1], branches });
	}
	return results;
};

for (const locale of LOCALES) {
	const flat = flatten(read(`src/i18n/messages/${locale}.json`));
	const required = integerPluralCategories(locale);
	for (const [key, value] of Object.entries(flat)) {
		if (!isCommerceKey(key) || typeof value !== "string") continue;
		for (const { arg, branches } of pluralBranches(value)) {
			const named = branches.filter((b) => !b.startsWith("="));
			for (const category of required) {
				if (!named.includes(category)) {
					errors.push(
						`${locale} ${key}: ICU plural over {${arg}} is missing the "${category}" branch required for ${locale} integers (has: ${branches.join(
							", ",
						)})`,
					);
				}
			}
		}
	}
}

// ——— 6: documented hardcoded exceptions must still match reality ————————————
const exceptions = read("scripts/i18n/hardcoded-exceptions.json");

for (const exception of exceptions.entries) {
	const filePath = path.join(repoRoot, exception.file);
	if (!fs.existsSync(filePath)) {
		errors.push(`hardcoded-exception file gone: ${exception.file} — update the ledger`);
		continue;
	}
	const content = fs.readFileSync(filePath, "utf8");
	if (!content.includes(exception.literal)) {
		errors.push(
			`hardcoded-exception literal no longer present in ${exception.file}: ${JSON.stringify(
				exception.literal,
			)} — update the ledger`,
		);
	}
}

// ——— email.* keys (optional, needs the maky-apps SMTP repo) ————————————————
const smtpDir = process.env.SMTP_APP_DIR;

if (smtpDir) {
	const smtpEn = flatten(
		JSON.parse(fs.readFileSync(path.join(smtpDir, "src/modules/smtp/i18n/catalogs/en.json"), "utf8")),
	);
	const smtpSk = flatten(
		JSON.parse(fs.readFileSync(path.join(smtpDir, "src/modules/smtp/i18n/catalogs/sk.json"), "utf8")),
	);
	for (const key of emailManifestKeys) {
		const catalogKey = key.slice("email.".length);
		if (!(catalogKey in smtpEn)) {
			errors.push(`manifest email key missing from SMTP en catalog: ${key}`);
		} else if (manifestKeys[key].source !== smtpEn[catalogKey]) {
			errors.push(`manifest email source out of sync with SMTP en catalog: ${key}`);
		}
		if (!(catalogKey in smtpSk)) {
			errors.push(`manifest email key missing from SMTP sk catalog: ${key}`);
		}
	}
	for (const catalogKey of Object.keys(smtpEn)) {
		if (!manifestKeys[`email.${catalogKey}`]) {
			errors.push(`SMTP en catalog key not in manifest: email.${catalogKey}`);
		}
	}
	const skOnly = Object.keys(smtpSk).filter((k) => !(k in smtpEn));
	for (const k of skOnly) {
		errors.push(`SMTP sk catalog has a key absent from en: ${k}`);
	}
} else {
	warnings.push("SMTP_APP_DIR not set — email.* manifest keys not verified against the SMTP repo catalogs");
}

// ——— report ————————————————————————————————————————————————————————————————
console.log(
	`manifest: ${Object.keys(manifestKeys).length} keys (${storefrontManifestKeys.length} storefront + ${
		emailManifestKeys.length
	} email) | runtime: ${usage.size} keys | status: ${JSON.stringify(statusCounts)}`,
);

for (const w of warnings) console.warn(`WARN: ${w}`);

if (errors.length) {
	for (const e of errors) console.error(`FAIL: ${e}`);
	console.error(`\n${errors.length} closure violation(s)`);
	process.exit(1);
}

console.log("commerce i18n closure OK");
