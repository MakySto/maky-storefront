// What the catalogue actually publishes, sampled from the live site.
//
//   node scripts/checks/published-content.mjs                        # 40 pages off maky.store
//   node scripts/checks/published-content.mjs --sample 100
//   node scripts/checks/published-content.mjs --base http://127.0.0.1:3311
//
// Run it after every deploy AND after every catalogue publish. The second one is the
// point: on 2026-09-06 CFM published 9,189 products onto a storefront whose gates were
// all green, and 94% of the resulting pages were wrong in two ways at once — an internal
// identifier in the `sku` Google reads, and no `brand` at all. Nothing in the repo
// noticed, because nothing in the repo looks at a published page.
//
// A green build, HTTP 200, 226 verified assets and 1,213 passing tests all held while
// that was true. Those check that the code is consistent with itself. This checks what a
// crawler receives, which is a different question and the one that costs money.
//
// Exit 0 = every invariant held across the sample. Exit 1 = at least one did not.
// Exit 2 = the check could not run (no sitemap, no products), which is not a pass.
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};

const BASE = (argOf("--base", "https://maky.store") || "").replace(/\/$/, "");
const SAMPLE = Number(argOf("--sample", "40"));
const CONCURRENCY = 8;

// MAKY's internal identifier. It is allowed to exist in Saleor; it may never be published.
const INTERNAL_MARKER = /CFMP-/i;

const NON_PRODUCT = new Set([
	"products",
	"kontakt",
	"cart",
	"obchodne-podmienky",
	"reklamacie-a-vratenie",
	"o-nas",
	"poradna",
	"odstupenie-od-zmluvy",
	"ochrana-osobnych-udajov",
	"cookies",
	"doprava-a-platba",
]);

const fail = (msg) => {
	console.error(msg);
	process.exit(2);
};

const sitemapUrl = `${BASE}/sitemap.xml`;
let xml;
try {
	const res = await fetch(sitemapUrl);
	if (!res.ok) fail(`sitemap ${sitemapUrl} returned ${res.status}`);
	xml = await res.text();
} catch (err) {
	fail(`could not fetch ${sitemapUrl}: ${err.message}`);
}

const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const products = locs.filter((u) => {
	const m = /\/sk\/([a-z0-9-]+)$/.exec(u);
	return m && !NON_PRODUCT.has(m[1]);
});

if (products.length === 0) fail(`no product URLs found in ${sitemapUrl} (${locs.length} <loc> total)`);

// Deterministic-enough sampling: shuffle with a fixed stride so repeated runs vary,
// but a single run covers the catalogue evenly rather than clustering at the start.
const stride = Math.max(1, Math.floor(products.length / Math.min(SAMPLE, products.length)));
const offset = Math.floor(Math.random() * stride);
const sample = [];
for (let i = offset; i < products.length && sample.length < SAMPLE; i += stride) sample.push(products[i]);

console.log(`${BASE} — ${products.length} product URLs in the sitemap, sampling ${sample.length}\n`);

const INVARIANTS = [
	["page is 200", (p) => p.status === 200],
	["no internal identifier anywhere in the HTML", (p) => !INTERNAL_MARKER.test(p.html)],
	[
		"has product structured data",
		(p) => p.jsonLd?.["@type"] === "Product" || p.jsonLd?.["@type"] === "ProductGroup",
	],
	["structured data carries a brand", (p) => Boolean(p.jsonLd?.brand?.name)],
	["structured data carries a sku", (p) => Boolean(p.jsonLd?.sku || p.jsonLd?.productGroupID)],
	["sku is free of the internal identifier", (p) => !INTERNAL_MARKER.test(String(p.jsonLd?.sku ?? ""))],
	["has an offer", (p) => Boolean(p.jsonLd?.offers || p.jsonLd?.hasVariant)],
	[
		"offer states an exact price",
		(p) => p.jsonLd?.offers?.price !== undefined || Array.isArray(p.jsonLd?.hasVariant),
	],
	[
		"availability is a schema.org value",
		(p) =>
			/schema\.org\/(InStock|OutOfStock|BackOrder|PreOrder)$/.test(
				p.jsonLd?.offers?.availability ?? p.jsonLd?.hasVariant?.[0]?.offers?.availability ?? "",
			),
	],
];

async function inspect(url) {
	try {
		const res = await fetch(url);
		const html = await res.text();
		const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
		let jsonLd = null;
		if (m) {
			try {
				jsonLd = JSON.parse(m[1]);
			} catch {
				/* left null — "has product structured data" will fail and name the page */
			}
		}
		return { url, status: res.status, html, jsonLd };
	} catch (err) {
		return { url, status: 0, html: "", jsonLd: null, error: err.message };
	}
}

const pages = [];
for (let i = 0; i < sample.length; i += CONCURRENCY) {
	pages.push(...(await Promise.all(sample.slice(i, i + CONCURRENCY).map(inspect))));
}

let failed = 0;
const width = Math.max(...INVARIANTS.map(([label]) => label.length));

for (const [label, holds] of INVARIANTS) {
	const bad = pages.filter((p) => !holds(p));
	const mark = bad.length === 0 ? "ok  " : "FAIL";
	console.log(`  ${mark}  ${label.padEnd(width)}  ${pages.length - bad.length}/${pages.length}`);
	if (bad.length) {
		failed++;
		for (const p of bad.slice(0, 3))
			console.log(`          ${p.url.replace(BASE, "")}${p.error ? ` — ${p.error}` : ""}`);
		if (bad.length > 3) console.log(`          …and ${bad.length - 3} more`);
	}
}

// A sample is a sample. Say so, so nobody quotes 40/40 as proof about 9,606 pages.
console.log(
	`\n${failed === 0 ? "all invariants held" : `${failed} invariant(s) broken`} across ${pages.length} of ${
		products.length
	} published pages.`,
);
if (failed === 0)
	console.log("A clean sample is evidence, not proof — widen it with --sample before a launch claim.");
process.exit(failed === 0 ? 0 : 1);
