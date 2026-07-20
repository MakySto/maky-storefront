// Drift gate for docs/i18n/commerce-locales.json against the code sources of truth
// (src/lib/channel-map.ts + src/config/locale.ts) and — when credentials are provided —
// against the live Saleor channel list.
//
//   node scripts/i18n/check-locale-matrix.mjs
//   SALEOR_API_URL=… SALEOR_APP_TOKEN=… node scripts/i18n/check-locale-matrix.mjs   # + live check
//
// The matrix mirrors code; code is canonical. Verified fields: market, channel, currency,
// saleorLanguageCode, stripeLocale, locale set equality, and (live) saleorChannelStatus +
// channel currency/active. launchStatus/checkoutReady/shippingConfigured are OPERATIONAL
// facts maintained by hand — the check only enforces that they exist and use known values.
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const read = (p) => fs.readFileSync(path.join(repoRoot, p), "utf8");

const matrix = JSON.parse(read("docs/i18n/commerce-locales.json"));
const errors = [];

// ——— parse CHANNEL_MAP from channel-map.ts ————————————————————————————————
const channelMapSource = read("src/lib/channel-map.ts");
const channelMap = {};
const channelEntryRe =
	/(\w+):\s*\{\s*saleorSlug:\s*"([^"]+)",\s*currency:\s*"([^"]+)",\s*locale:\s*"([^"]+)",\s*country:\s*"([^"]+)"\s*\}/g;
for (const m of channelMapSource.matchAll(channelEntryRe)) {
	channelMap[m[1]] = { saleorSlug: m[2], currency: m[3], locale: m[4], country: m[5] };
}
if (Object.keys(channelMap).length === 0) {
	throw new Error("could not parse CHANNEL_MAP from src/lib/channel-map.ts — update the regex");
}

// ——— parse LOCALE_MAP from config/locale.ts ————————————————————————————————
const localeSource = read("src/config/locale.ts");
const localeMap = {};
const localeEntryRe =
	/"([a-z]{2}-[A-Z]{2})":\s*\{\s*locale:\s*"[^"]+",\s*htmlLang:\s*"[^"]+",\s*graphqlLanguageCode:\s*LanguageCodeEnum\.(\w+),[^}]*stripeLocale:\s*"([^"]+)"/g;
for (const m of localeSource.matchAll(localeEntryRe)) {
	// enum member PascalCase -> GraphQL value (Sk -> SK, EnGb -> EN_GB)
	const languageCode = m[2].replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
	localeMap[m[1]] = { saleorLanguageCode: languageCode, stripeLocale: m[3] };
}
if (Object.keys(localeMap).length === 0) {
	throw new Error("could not parse LOCALE_MAP from src/config/locale.ts — update the regex");
}

// ——— compare ————————————————————————————————————————————————————————————————
const matrixLocales = Object.keys(matrix.locales);
const codeLocales = Object.values(channelMap).map((c) => c.locale);

for (const locale of codeLocales) {
	if (!matrixLocales.includes(locale)) errors.push(`locale in code but not in matrix: ${locale}`);
}
for (const locale of matrixLocales) {
	if (!codeLocales.includes(locale)) errors.push(`locale in matrix but not in code: ${locale}`);
}

const KNOWN_LAUNCH_STATUS = new Set(["launch-candidate", "pending", "blocked"]);
const KNOWN_VERIFIED = new Set([true, false, "unverified"]);
const KNOWN_CHANNEL_STATUS = new Set(["active", "inactive", "missing"]);

for (const [locale, entry] of Object.entries(matrix.locales)) {
	const code = channelMap[entry.market];
	if (!code) {
		errors.push(`${locale}: market "${entry.market}" not in CHANNEL_MAP`);
		continue;
	}
	if (code.saleorSlug !== entry.channel)
		errors.push(`${locale}: channel ${entry.channel} != code ${code.saleorSlug}`);
	if (code.currency !== entry.currency)
		errors.push(`${locale}: currency ${entry.currency} != code ${code.currency}`);
	if (code.locale !== locale)
		errors.push(`${locale}: CHANNEL_MAP market ${entry.market} maps to ${code.locale}`);
	const localeCfg = localeMap[locale];
	if (!localeCfg) {
		errors.push(`${locale}: missing from LOCALE_MAP`);
	} else {
		if (localeCfg.saleorLanguageCode !== entry.saleorLanguageCode)
			errors.push(
				`${locale}: saleorLanguageCode ${entry.saleorLanguageCode} != code ${localeCfg.saleorLanguageCode}`,
			);
		if (localeCfg.stripeLocale !== entry.stripeLocale)
			errors.push(`${locale}: stripeLocale ${entry.stripeLocale} != code ${localeCfg.stripeLocale}`);
	}
	if (!KNOWN_LAUNCH_STATUS.has(entry.launchStatus))
		errors.push(`${locale}: launchStatus missing/unknown (${entry.launchStatus})`);
	if (!KNOWN_VERIFIED.has(entry.checkoutReady))
		errors.push(`${locale}: checkoutReady missing/unknown (${entry.checkoutReady})`);
	if (!KNOWN_VERIFIED.has(entry.shippingConfigured))
		errors.push(`${locale}: shippingConfigured missing/unknown (${entry.shippingConfigured})`);
	if (!KNOWN_CHANNEL_STATUS.has(entry.saleorChannelStatus))
		errors.push(`${locale}: saleorChannelStatus missing/unknown (${entry.saleorChannelStatus})`);
}

// ——— optional live Saleor check ————————————————————————————————————————————
const apiUrl = process.env.SALEOR_API_URL;
const token = process.env.SALEOR_APP_TOKEN;

if (apiUrl && token) {
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
		body: JSON.stringify({ query: "{ channels { slug currencyCode isActive } }" }),
	});
	const payload = await response.json();
	if (payload.errors) {
		errors.push(`live channels query failed: ${payload.errors[0]?.message}`);
	} else {
		const live = new Map(payload.data.channels.map((c) => [c.slug, c]));
		for (const [locale, entry] of Object.entries(matrix.locales)) {
			const channel = live.get(entry.channel);
			const expected = entry.saleorChannelStatus;
			if (!channel) {
				if (expected !== "missing")
					errors.push(`${locale}: channel ${entry.channel} not in live Saleor but matrix says "${expected}"`);
				continue;
			}
			const actual = channel.isActive ? "active" : "inactive";
			if (expected !== actual)
				errors.push(`${locale}: live channel ${entry.channel} is ${actual}, matrix says "${expected}"`);
			if (channel.currencyCode !== entry.currency)
				errors.push(`${locale}: live currency ${channel.currencyCode} != matrix ${entry.currency}`);
		}
	}
	console.log("live Saleor channel check: done");
} else {
	console.warn(
		"WARN: SALEOR_API_URL/SALEOR_APP_TOKEN not set — live channel check skipped (code↔matrix check still enforced)",
	);
}

if (errors.length) {
	for (const e of errors) console.error(`FAIL: ${e}`);
	process.exit(1);
}
console.log(`locale matrix OK (${matrixLocales.length} locales)`);
