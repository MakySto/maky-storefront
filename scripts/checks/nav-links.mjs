// Do the categories the storefront links to actually exist, hold products, and answer
// as indexable pages?
//
//   node scripts/checks/nav-links.mjs
//   node scripts/checks/nav-links.mjs --base http://127.0.0.1:3311 --channel sk-eur
//
// Run it after a deploy and after any catalogue change in Saleor.
//
// The failure this exists for returns HTTP 200. `/sk/categories/nosice-lyz` was linked
// from the homepage for months: the category does not exist in Saleor, and because a
// category page cannot set a 404 once the streaming shell is flushed, it answered 200
// with a "Stránka nenájdená" body and `noindex`. Every status-code monitor on earth
// calls that healthy. So this check reads the title and the robots meta, not the status.
//
// Since category URLs moved to the root (`/sk/stresne-nosice`), it also asks three
// questions that only a live system can answer: does the canonical name the new URL,
// does the retired `/categories/` URL still 308, and — the one nothing else can see —
// has a PRODUCT been given a category's slug, which the proxy would silently shadow.
//
// The catalogue side is checked too: a tile pointing at a real but empty category is
// the "empty section" CLAUDE.md §6 forbids, and the page marks itself `noindex` while
// it holds nothing — so the link is a dead end even though every URL resolves.
//
// Exit 0 = every surfaced category resolves, holds products and is indexable.
// Exit 1 = at least one did not.  Exit 2 = the check could not run.
import { readFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};

const BASE = (argOf("--base", "https://maky.store") || "").replace(/\/$/, "");
const CHANNEL = argOf("--channel", "sk-eur");
const MARKET = argOf("--market", "sk");
const API = argOf("--api", process.env.NEXT_PUBLIC_SALEOR_API_URL || "https://api.maky.store/graphql/");

const fail = (msg) => {
	console.error(msg);
	process.exit(2);
};

/**
 * The catalogue is read out of the TypeScript source rather than imported: this script
 * is plain node with no build step, and the shape it needs — slug plus surfaces — is
 * stable enough to read literally. `categories.test.ts` is what guards the file's
 * internal consistency; this only needs the list.
 */
const source = readFileSync(new URL("../../src/config/categories.ts", import.meta.url), "utf8");
const entries = [
	...source.matchAll(/\{\s*slug:\s*"([a-z0-9-]+)",\s*key:\s*"(\w+)",\s*surfaces:\s*\[([^\]]*)\]/g),
].map(([, slug, key, surfaces]) => ({
	slug,
	key,
	surfaces: [...surfaces.matchAll(/"(\w+)"/g)].map(([, s]) => s),
}));
if (entries.length === 0) fail("could not read any category out of src/config/categories.ts");

const surfaced = entries.filter((c) => c.surfaces.length > 0);
const withheld = entries.filter((c) => c.surfaces.length === 0);

console.log(
	`${BASE} · channel ${CHANNEL} — ${surfaced.length} surfaced categories, ${withheld.length} withheld\n`,
);

async function saleorCount(slug) {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `query($slug:String!,$channel:String!){category(slug:$slug){name products(channel:$channel,first:0){totalCount}}}`,
			variables: { slug, channel: CHANNEL },
		}),
	});
	if (!res.ok) throw new Error(`Saleor returned ${res.status}`);
	const body = await res.json();
	return body?.data?.category ?? null;
}

async function livePage(slug) {
	const url = `${BASE}/${MARKET}/${slug}`;
	const res = await fetch(url);
	const html = await res.text();
	return {
		url,
		status: res.status,
		title: (html.match(/<title>([^<]*)<\/title>/) || [, ""])[1],
		robots: (html.match(/<meta name="robots" content="([^"]*)"/) || [, ""])[1],
		canonical: (html.match(/<link rel="canonical" href="([^"]*)"/) || [, ""])[1],
	};
}

/** The retired `/categories/<slug>` URL must 308 to the root one, not serve it. */
async function legacyRedirect(slug) {
	const res = await fetch(`${BASE}/${MARKET}/categories/${slug}`, { redirect: "manual" });
	return { status: res.status, location: res.headers.get("location") || "" };
}

/**
 * Does a PRODUCT hold this category's slug?
 *
 * Category URLs are root-level, so they share a namespace with 9,577 product slugs,
 * and `src/proxy.ts` resolves the collision in the category's favour. Nothing in
 * Saleor prevents the collision being created, and neither side would fail: the
 * category would render and the product would silently lose its canonical URL. Only
 * Saleor knows the product slugs, so only a live check can ask this.
 */
async function productWithSlug(slug) {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `query($slug:String!,$channel:String!){product(slug:$slug,channel:$channel){id name}}`,
			variables: { slug, channel: CHANNEL },
		}),
	});
	if (!res.ok) throw new Error(`Saleor returned ${res.status}`);
	return (await res.json())?.data?.product ?? null;
}

const rows = [];
let failed = 0;

for (const category of surfaced) {
	const problems = [];
	let count = null;
	let page = null;

	try {
		const saleor = await saleorCount(category.slug);
		if (!saleor) problems.push("not a category in Saleor");
		else {
			count = saleor.products.totalCount;
			if (count === 0) problems.push("0 products in this channel — the link is a dead end");
		}
	} catch (err) {
		problems.push(`Saleor lookup failed: ${err.message}`);
	}

	try {
		page = await livePage(category.slug);
		if (page.status !== 200) problems.push(`HTTP ${page.status}`);
		// The soft-404 tell. A resolved category titles itself; a missing one says so in
		// the body while still answering 200.
		if (/nen[aá]jden|not found/i.test(page.title)) problems.push(`soft-404: title "${page.title}"`);
		if (/noindex/i.test(page.robots)) problems.push(`robots: ${page.robots}`);
		if (page.canonical && !page.canonical.endsWith(`/${MARKET}/${category.slug}`)) {
			problems.push(`canonical points elsewhere: ${page.canonical}`);
		}
	} catch (err) {
		problems.push(`live fetch failed: ${err.message}`);
	}

	try {
		const legacy = await legacyRedirect(category.slug);
		if (legacy.status !== 308) problems.push(`retired /categories/ URL answers ${legacy.status}, not 308`);
		else if (!legacy.location.endsWith(`/${MARKET}/${category.slug}`)) {
			problems.push(`retired URL redirects to ${legacy.location}`);
		}
	} catch (err) {
		problems.push(`legacy redirect check failed: ${err.message}`);
	}

	try {
		const clash = await productWithSlug(category.slug);
		if (clash) problems.push(`a PRODUCT holds this slug and is shadowed by the category: ${clash.name}`);
	} catch (err) {
		problems.push(`collision check failed: ${err.message}`);
	}

	if (problems.length > 0) failed += 1;
	rows.push({ category, count, page, problems });
}

for (const { category, count, page, problems } of rows) {
	const mark = problems.length === 0 ? "ok  " : "FAIL";
	const products = count === null ? "     ?" : String(count).padStart(6);
	console.log(`  ${mark}  ${category.slug.padEnd(20)} ${products} products  ${page?.title ?? ""}`);
	for (const problem of problems) console.log(`          ${problem}`);
}

if (withheld.length > 0) {
	console.log("\n  withheld on purpose (not linked from the nav or the homepage):");
	for (const category of withheld) {
		let note = "";
		try {
			const saleor = await saleorCount(category.slug);
			note = saleor ? `${saleor.products.totalCount} products` : "not in Saleor";
		} catch {
			note = "unchecked";
		}
		console.log(`    ${category.slug.padEnd(20)} ${note}`);
	}
}

console.log(
	failed === 0
		? `\nall ${surfaced.length} surfaced categories resolve at the root, hold products, are indexable,\nredirect their retired URL and collide with no product slug`
		: `\n${failed} of ${surfaced.length} surfaced categories are broken`,
);
process.exit(failed === 0 ? 0 : 1);
