// The Slovak meta description (`seoDescription`) of the catalogue categories, written to Saleor.
//
//   node scripts/ops/category-seo-descriptions.mjs docs/storefront-4.5/data/category-seo-descriptions-20261030.json            # dry run
//   node scripts/ops/category-seo-descriptions.mjs docs/storefront-4.5/data/category-seo-descriptions-20261030.json --apply    # writes
//   node scripts/ops/category-seo-descriptions.mjs <pack> --rollback <receipt.json> --apply                                    # puts the old texts back
//
// Environment (names only, values are never printed):
//   SALEOR_API_URL        the GraphQL endpoint; falls back to NEXT_PUBLIC_SALEOR_API_URL
//   SALEOR_STAFF_TOKEN    a token that may MANAGE_PRODUCTS (`categoryUpdate`)
//
// Why only Slovak. A category page abroad reads the TRANSLATION's `seoDescription`
// (`resolveExactLocaleTaxonomy`, and it refuses the category in that market when the translation's
// name, description, seoTitle or seoDescription is empty). Those rows are written by CFM's
// `market_config` category-translation step with a compare-and-swap on the whole translation, so a
// hand edit from here would make its next verify report `translation_changed_since_manifest`. The
// other languages in the pack therefore go through CFM; this file refuses to touch them.
//
// What it does, in order, and what it will not do:
//   1. Reads the pack and keeps the `sk` records. Each must be a single line of 70 to 200 characters.
//   2. Resolves every category by its Slovak slug (the last part of `source_sk_path`) and refuses when
//      one is missing, so a typo cannot create or change another category.
//   3. Dry run: prints the text now in Saleor and the text it would write, and writes nothing.
//   4. --apply: writes the pre-image of every category to a receipt file FIRST, then `categoryUpdate`
//      with `seoDescription` only (a partial update, the other fields stay), then reads each one back
//      and compares. A category that already holds the text is not written, and a run with nothing to
//      write leaves no receipt. The first failure stops the run.
//   5. --rollback <receipt> --apply writes the receipt's old texts back, with the same read-back.
//
// Exit 0 = dry run printed, or every write was read back equal. 1 = a write or a read-back failed.
// 2 = refused (bad pack, missing category, no token).
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const packPath = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--rollback");
const argOf = (flag) => {
	const i = args.indexOf(flag);
	return i === -1 ? null : args[i + 1] ?? null;
};
const APPLY = args.includes("--apply");
const ROLLBACK = argOf("--rollback");

const API = process.env.SALEOR_API_URL || process.env.NEXT_PUBLIC_SALEOR_API_URL;
const TOKEN = process.env.SALEOR_STAFF_TOKEN;

const refuse = (message) => {
	console.error(`refused: ${message}`);
	process.exit(2);
};

if (!packPath) refuse("the first argument is the content pack (JSON)");
if (!API) refuse("SALEOR_API_URL is not set");
if (APPLY && !TOKEN) refuse("SALEOR_STAFF_TOKEN is not set");

async function graphql(query, variables) {
	const response = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const body = await response.json();
	if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
	return body.data;
}

const READ = `query ($slug: String!) { category(slug: $slug) { id name slug seoDescription } }`;
const WRITE = `mutation ($id: ID!, $input: CategoryInput!) {
	categoryUpdate(id: $id, input: $input) { category { id seoDescription } errors { field code message } }
}`;

/** What the run is asked to make true: category slug -> the text it should hold. */
function targets() {
	if (ROLLBACK) {
		const receipt = JSON.parse(readFileSync(ROLLBACK, "utf8"));
		if (!Array.isArray(receipt.categories)) refuse(`${ROLLBACK} is not a receipt of this tool`);
		return receipt.categories.map((c) => ({ slug: c.slug, text: c.before ?? "" }));
	}
	const pack = JSON.parse(readFileSync(packPath, "utf8"));
	const rows = (pack.records ?? []).filter((r) => r.locale === "sk");
	if (rows.length === 0) refuse("the pack holds no Slovak records");
	return rows.map((r) => {
		const slug = String(r.source_sk_path ?? "")
			.split("/")
			.filter(Boolean)
			.pop();
		const text = String(r.seo_description ?? "");
		if (!slug) refuse(`record ${r.category_key} has no source_sk_path`);
		if (text.length < 70 || text.length > 200 || /[\r\n]/.test(text) || text !== text.trim())
			refuse(`record ${r.category_key}: the text must be one trimmed line of 70 to 200 characters`);
		return { slug, text };
	});
}

const wanted = targets();
const found = [];
for (const { slug, text } of wanted) {
	const { category } = await graphql(READ, { slug });
	if (!category) refuse(`no category with slug "${slug}" in Saleor`);
	found.push({ slug, id: category.id, name: category.name, before: category.seoDescription ?? "", text });
}

console.log(
	`${APPLY ? "APPLY" : "dry run"}${ROLLBACK ? " (rollback)" : ""}: ${found.length} categories at ${
		new URL(API).host
	}`,
);
for (const c of found) {
	const state = c.before === c.text ? "already in place" : "will change";
	console.log(`\n${c.slug} (${c.name}) — ${state}\n  now:  ${c.before || "(empty)"}\n  next: ${c.text}`);
}
if (!APPLY) process.exit(0);

if (found.every((c) => c.before === c.text)) {
	console.log("\nnothing to write: every category already holds the text");
	process.exit(0);
}

const receiptPath = `category-seo-receipt-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(
	receiptPath,
	JSON.stringify(
		{
			at: new Date().toISOString(),
			host: new URL(API).host,
			categories: found.map(({ slug, id, before, text }) => ({ slug, id, before, text })),
		},
		null,
		2,
	),
);
console.log(
	`\npre-image written to ${receiptPath} (keep it: --rollback ${receiptPath} --apply puts it back)`,
);

let failed = 0;
for (const c of found) {
	if (c.before === c.text) continue;
	try {
		const result = (await graphql(WRITE, { id: c.id, input: { seoDescription: c.text } })).categoryUpdate;
		if (result.errors?.length)
			throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join("; "));
		const back = (await graphql(READ, { slug: c.slug })).category;
		if (back?.seoDescription !== c.text) throw new Error("read-back differs from what was written");
		console.log(`written and read back: ${c.slug}`);
	} catch (error) {
		failed += 1;
		console.error(`FAILED ${c.slug}: ${error.message}`);
		// The first failure stops the run: the same cause (a token, a schema change) would fail the rest too.
		break;
	}
}
console.log(failed ? `\n${failed} failed` : "\nall categories hold the text");
process.exit(failed ? 1 : 0);
