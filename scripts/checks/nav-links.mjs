// Do the categories the storefront links to actually exist, hold products, and answer
// as indexable pages?
//
//   node scripts/checks/nav-links.mjs
//   node scripts/checks/nav-links.mjs --base http://127.0.0.1:3311 --channel sk-eur
//   node scripts/checks/nav-links.mjs --saleor-only --all-channels
//
// `--saleor-only` asks Saleor and nothing else — no request to the storefront — so it can run BEFORE a
// deploy, from any checkout of this file (plain node, no install, no build): does Saleor hold exactly the
// categories `src/config/categories.ts` names, and does any product hold a category's slug? With
// `--all-channels` the product question is asked in every channel the storefront serves.
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
// Since 2026-10-06 every category Saleor holds has a root URL, so those three questions are
// asked of ALL of them — the catalogue's 8 and the other 22 in `OTHER_CATEGORY_SLUGS` — and a
// fourth is added: does Saleor hold a category the build does not name (it keeps its
// `/categories/` URL until `src/config/categories.ts` lists it), or does the build name one
// Saleor no longer has (its root URL is a soft 404)?
//
// The catalogue side is checked too: a tile pointing at a real but empty category is
// the "empty section" CLAUDE.md §6 forbids, and the page marks itself `noindex` while
// it holds nothing — so the link is a dead end even though every URL resolves. That
// strictness is for the SURFACED categories only; an accessory bucket with nothing in this
// channel is allowed to be empty and `noindex`.
//
// Exit 0 = every surfaced category resolves, holds products and is indexable, and every
//          category resolves at the root, redirects its retired URL and collides with no product.
// Exit 1 = at least one did not.  Exit 2 = the check could not run.
import process from "node:process";
import { readCategorySource, readChannels } from "./category-source.mjs";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
	const i = args.indexOf(flag);
	return i === -1 ? fallback : args[i + 1];
};

const BASE = (argOf("--base", "https://maky.store") || "").replace(/\/$/, "");
const CHANNEL = argOf("--channel", "sk-eur");
const MARKET = argOf("--market", "sk");
const API = argOf("--api", process.env.NEXT_PUBLIC_SALEOR_API_URL || "https://api.maky.store/graphql/");
const SALEOR_ONLY = args.includes("--saleor-only");
const ALL_CHANNELS = args.includes("--all-channels");

const fail = (msg) => {
	console.error(msg);
	process.exit(2);
};

/**
 * The catalogue is read out of the TypeScript source rather than imported: this script
 * is plain node with no build step, and the shape it needs — slug plus surfaces — is
 * stable enough to read literally. `categories.test.ts` is what guards the file's
 * internal consistency, and `category-source-script.test.ts` the reader itself.
 */
const { catalogue: entries, other: otherSlugs } = readCategorySource();
if (entries.length === 0) fail("could not read any category out of src/config/categories.ts");
if (otherSlugs.length === 0) fail("could not read OTHER_CATEGORY_SLUGS out of src/config/categories.ts");

const surfaced = entries.filter((c) => c.surfaces.length > 0);
const withheld = entries.filter((c) => c.surfaces.length === 0);

if (!SALEOR_ONLY) {
	console.log(
		`${BASE} · channel ${CHANNEL} — ${surfaced.length} surfaced categories, ${withheld.length} withheld\n`,
	);
}

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
async function productWithSlug(slug, channel = CHANNEL) {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `query($slug:String!,$channel:String!){product(slug:$slug,channel:$channel){id name}}`,
			variables: { slug, channel },
		}),
	});
	if (!res.ok) throw new Error(`Saleor returned ${res.status}`);
	return (await res.json())?.data?.product ?? null;
}

/** Every category Saleor holds, by slug — what the build's set has to name. */
async function saleorCategorySlugs() {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `{categories(first:100){pageInfo{hasNextPage} edges{node{slug}}}}`,
		}),
	});
	if (!res.ok) throw new Error(`Saleor returned ${res.status}`);
	const connection = (await res.json())?.data?.categories;
	if (!connection) throw new Error("Saleor returned no category list");
	if (connection.pageInfo.hasNextPage) throw new Error("more than 100 categories: page this query");
	return connection.edges.map((edge) => edge.node.slug);
}

/**
 * One category, end to end: it exists, its root URL answers and says so, its retired URL
 * redirects there, and no product holds its slug.
 *
 * `strict` is for the categories the site LINKS to. A linked category with nothing in this
 * channel is a dead end (CLAUDE.md §6) and must be indexable; an accessory bucket nobody links
 * to may hold nothing and answer `noindex` — that is the page doing its job, not a defect.
 */
async function checkCategory(slug, { strict }) {
	const problems = [];
	let count = null;
	let page = null;

	try {
		const saleor = await saleorCount(slug);
		if (!saleor) problems.push("not a category in Saleor");
		else {
			count = saleor.products.totalCount;
			if (count === 0 && strict) problems.push("0 products in this channel — the link is a dead end");
		}
	} catch (err) {
		problems.push(`Saleor lookup failed: ${err.message}`);
	}

	try {
		page = await livePage(slug);
		if (page.status !== 200) problems.push(`HTTP ${page.status}`);
		// The soft-404 tell. A resolved category titles itself; a missing one says so in
		// the body while still answering 200.
		if (/nen[aá]jden|not found/i.test(page.title)) problems.push(`soft-404: title "${page.title}"`);
		if (/noindex/i.test(page.robots) && (strict || count > 0)) problems.push(`robots: ${page.robots}`);
		if (page.canonical && !page.canonical.endsWith(`/${MARKET}/${slug}`)) {
			problems.push(`canonical points elsewhere: ${page.canonical}`);
		}
	} catch (err) {
		problems.push(`live fetch failed: ${err.message}`);
	}

	try {
		const legacy = await legacyRedirect(slug);
		if (legacy.status !== 308) problems.push(`retired /categories/ URL answers ${legacy.status}, not 308`);
		else if (!legacy.location.endsWith(`/${MARKET}/${slug}`)) {
			problems.push(`retired URL redirects to ${legacy.location}`);
		}
	} catch (err) {
		problems.push(`legacy redirect check failed: ${err.message}`);
	}

	try {
		const clash = await productWithSlug(slug);
		if (clash) problems.push(`a PRODUCT holds this slug and is shadowed by the category: ${clash.name}`);
	} catch (err) {
		problems.push(`collision check failed: ${err.message}`);
	}

	return { slug, count, page, problems };
}

const print = ({ slug, count, page, problems }) => {
	const mark = problems.length === 0 ? "ok  " : "FAIL";
	const products = count === null ? "     ?" : String(count).padStart(6);
	console.log(`  ${mark}  ${slug.padEnd(38)} ${products} products  ${page?.title ?? ""}`);
	for (const problem of problems) console.log(`          ${problem}`);
};

const named = new Set([...entries.map((category) => category.slug), ...otherSlugs]);

/** The build's categories against Saleor's, both ways. Prints each mismatch, returns how many there were. */
async function compareWithSaleor() {
	let problems = 0;
	try {
		const held = await saleorCategorySlugs();
		for (const slug of held.filter((slug) => !named.has(slug))) {
			problems += 1;
			console.log(
				`  FAIL  Saleor holds "${slug}" and src/config/categories.ts does not: it keeps /${MARKET}/categories/${slug} until it is added to OTHER_CATEGORY_SLUGS`,
			);
		}
		for (const slug of [...named].filter((slug) => !held.includes(slug))) {
			problems += 1;
			console.log(
				`  FAIL  src/config/categories.ts names "${slug}" and Saleor has no such category: /${MARKET}/${slug} is a soft 404`,
			);
		}
		if (problems === 0) console.log(`\n  the build names exactly the ${held.length} categories Saleor holds`);
	} catch (err) {
		problems += 1;
		console.log(`  FAIL  could not compare the build's categories with Saleor's: ${err.message}`);
	}
	return problems;
}

/**
 * `--saleor-only`: the two questions only Saleor can answer, with no request to the storefront.
 * Read-only: one `categories` query and one anonymous `product(slug:, channel:)` per slug and channel.
 */
async function saleorOnly() {
	const channels = ALL_CHANNELS ? readChannels() : [CHANNEL];
	if (channels.length === 0) fail("could not read any channel out of src/lib/channel-map.ts");
	console.log(
		`${API}\n${named.size} category slugs in the build, ${channels.length} channel(s): ${channels.join(
			", ",
		)}`,
	);

	let problems = await compareWithSaleor();

	console.log("\n  does any product hold a category's slug?");
	let asked = 0;
	for (const channel of channels) {
		for (const slug of named) {
			try {
				const clash = await productWithSlug(slug, channel);
				asked += 1;
				if (clash) {
					problems += 1;
					console.log(`  FAIL  ${channel}: product "${clash.name}" holds the category slug "${slug}"`);
				}
			} catch (err) {
				problems += 1;
				console.log(`  FAIL  ${channel}: could not ask about "${slug}": ${err.message}`);
			}
		}
	}
	console.log(
		problems === 0
			? `\n  none: ${asked} questions asked, no product holds a category slug`
			: `\n  ${problems} problem(s) above`,
	);
	process.exit(problems === 0 ? 0 : 1);
}

if (SALEOR_ONLY) await saleorOnly();

let failed = 0;

for (const category of surfaced) {
	const row = await checkCategory(category.slug, { strict: true });
	if (row.problems.length > 0) failed += 1;
	print(row);
}

// --- every other category: the build's set against Saleor's, then each one end to end ------------------
const rest = [...withheld.map((category) => category.slug), ...otherSlugs];
console.log(
	`\n  the other ${rest.length} categories (withheld from the nav, or not in the catalogue at all):`,
);

let otherFailed = 0;
for (const slug of rest) {
	const row = await checkCategory(slug, { strict: false });
	if (row.problems.length > 0) otherFailed += 1;
	print(row);
}

const setProblems = await compareWithSaleor();

const totalFailed = failed + otherFailed + setProblems;
console.log(
	totalFailed === 0
		? `\nall ${surfaced.length} surfaced categories resolve at the root, hold products, are indexable,\nand all ${named.size} categories redirect their retired URL, collide with no product slug and\nmatch what Saleor holds`
		: `\n${failed} of ${surfaced.length} surfaced categories are broken, ${otherFailed} of the other ${rest.length}, ${setProblems} mismatch(es) with Saleor`,
);
process.exit(totalFailed === 0 ? 0 : 1);
