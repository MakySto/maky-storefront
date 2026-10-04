#!/usr/bin/env node
// The whole path in one run, for the five CoolZ coolers (and the invented block gallery, when its
// file is there): what the CFM producer wrote, what a local Saleor returns for it on a fresh read,
// and what the running storefront draws from that.
//
//   node scripts/sandbox/roundtrip-coolz.mjs --descriptions <dir with TK2040x.description.json>
//
// The producer's files come from `backend/scripts/storefront_comparison_sample.py --out <dir>` (the
// untyped description) or `backend/scripts/storefront_maky_content_sample.py --out <dir>` (the typed
// one, with `gallery.description.json`) in the CFM repository and were written into Saleor by
// `seed-coolz.mjs`; this script writes nothing anywhere, so it needs no credentials. It reads Saleor
// the way the storefront does (public query, channel, no token) and refuses any Saleor or storefront
// that is not on this machine, so it cannot be mistaken for a check of the shop.
//
// Per product it checks that
//   1. Saleor returned the producer's blocks unchanged (the table block cell for cell),
//   2. every block that carries a `maky:` marker is drawn as its role, once, and the typed page has
//      no marked block left as plain text (typed descriptions only),
// and, for a description that has the comparison table,
//   3. the product page holds exactly one comparison table,
//   4. the highlighted column is the model the page is about, and
//   5. every model name, row label and part title (of a part that still has rows) is on the page.
// Exit status is 1 when any check fails.
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const SKUS = ["TK20409", "TK20410", "TK20411", "TK20412", "TK20413"];
/** The invented gallery of `seed-coolz.mjs`: every role and icon once, not a product. */
const GALLERY_SKU = "SANDBOX-GALLERY";
/** What the storefront draws for a marker, as a class of the HTML (`src/lib/editorjs-content.ts`). */
const ROLE_CLASS = {
	benefits: "maky-benefits",
	inbox: "maky-inbox",
	features: "maky-features",
	steps: "maky-steps",
	faq: "maky-faq",
	specs: "maky-specs",
	documents: "maky-docs",
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : fallback;
};
const fail = (message) => {
	console.error(message);
	process.exit(2);
};

const apiUrl = process.env.NEXT_PUBLIC_SALEOR_API_URL ?? flag("--api-url");
if (!apiUrl) fail("Set NEXT_PUBLIC_SALEOR_API_URL (or --api-url) to the sandbox Saleor.");
const storefront = flag("--storefront", process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000");
const channel = flag("--channel", process.env.NEXT_PUBLIC_DEFAULT_CHANNEL ?? "sk-eur");
const market = flag("--market", "sk");
const descriptionsDir = flag("--descriptions");
if (!descriptionsDir)
	fail("Pass --descriptions <dir> with the CFM producer's TK2040x.description.json files.");
for (const url of [apiUrl, storefront]) {
	const host = new URL(url).hostname;
	if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
		fail(`Refusing ${host}: this script only reads a Saleor and a storefront on this machine.`);
	}
}

async function gql(query, variables) {
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	const body = await response.json();
	if (body.errors?.length) throw new Error(JSON.stringify(body.errors).slice(0, 400));
	return body.data;
}

const decode = (value) =>
	value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;|&#39;/g, "'")
		.replace(/&amp;/g, "&");
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
// The comparison is the table that carries no marker; a `maky:specs` table is a parameter sheet.
const tableOf = (document) =>
	document.blocks.find((block) => block.type === "table" && !String(block.id ?? "").startsWith("maky:"));
const unmarked = (cell) => cell.replace(/<\/?mark>/g, "");
// Saleor's HTML cleaner adds `rel="noopener noreferrer"` to every link it keeps. It is the one
// difference between a description sent and read back, and the storefront reads past it.
const withoutRel = (value) =>
	JSON.parse(JSON.stringify(value).replace(/ rel=\\"noopener noreferrer\\"/g, ""));

const galleryFile = path.join(descriptionsDir, "gallery.description.json");
const subjects = [
	...SKUS.map((sku) => ({ sku, file: `${sku}.description.json` })),
	...(fs.existsSync(galleryFile) ? [{ sku: GALLERY_SKU, file: "gallery.description.json" }] : []),
];

/** The class the page must carry for a block id, or null when the id is not a role marker. */
function drawnAs(id) {
	const found = /^maky:([a-z]+)(?::([a-z]+))?(?:#\d+)?$/.exec(id ?? "");
	if (!found) return null;
	if (found[1] === "callout") return `maky-callout-${found[2]}`;
	return ROLE_CLASS[found[1]] ?? null;
}

const rows = [];
for (const { sku, file } of subjects) {
	const checks = [];
	const check = (name, ok, detail = "") => checks.push({ name, ok, detail: ok ? "" : detail });

	const sent = JSON.parse(fs.readFileSync(path.join(descriptionsDir, file), "utf8"));
	const sentTable = tableOf(sent);
	const typed = String(sent.version ?? "").startsWith("maky-content/");

	let slug = "";
	try {
		const data = await gql(
			"query($sku:String!,$channel:String!){productVariant(sku:$sku,channel:$channel){product{slug description}}}",
			{ sku, channel },
		);
		const product = data.productVariant?.product;
		check("Saleor returns the product", Boolean(product), `no product for ${sku} in ${channel}`);
		if (product) {
			slug = product.slug;
			const read = JSON.parse(product.description);
			check(
				"blocks read back unchanged",
				isDeepStrictEqual(withoutRel(read.blocks), sent.blocks),
				"the blocks differ from the producer's",
			);
			if (sentTable) {
				check(
					"table cells read back unchanged",
					isDeepStrictEqual(tableOf(read)?.data.content, sentTable.data.content),
					"the table cells differ",
				);
			}
			check(
				"version read back unchanged",
				read.version === sent.version,
				`sent ${sent.version}, read ${read.version}`,
			);
		}
	} catch (error) {
		check("Saleor is reachable", false, String(error.message ?? error));
	}

	if (slug) {
		try {
			const response = await fetch(`${storefront}/${market}/${slug}`, { redirect: "follow" });
			const html = await response.text();
			check("product page answers 200", response.status === 200, `HTTP ${response.status}`);

			if (typed) {
				const marked = sent.blocks.map((block) => ({ id: block.id, drawn: drawnAs(block.id) }));
				const unknown = marked.filter((entry) => entry.id?.startsWith("maky:") && !entry.drawn);
				check("every marker is a role the page knows", unknown.length === 0, JSON.stringify(unknown));
				const wrong = [];
				for (const { id, drawn } of marked) {
					if (!drawn) continue;
					const count = (html.match(new RegExp(`class="[^"]*\\b${drawn}\\b`, "g")) ?? []).length;
					const wanted = marked.filter((entry) => entry.drawn === drawn).length;
					if (count !== wanted) wrong.push(`${id}: drawn ${count}x, sent ${wanted}x`);
				}
				check("every marked block is drawn as its role", wrong.length === 0, [...new Set(wrong)].join("; "));
			}

			if (!sentTable) {
				rows.push({ sku, slug, checks });
				continue;
			}
			const tables = (html.match(/class="maky-cmp"/g) ?? []).length;
			check("exactly one comparison table", tables === 1, `${tables} found`);

			const header = sentTable.data.content[0].slice(1);
			const expectedName = unmarked(header.find((cell) => cell.startsWith("<mark>")) ?? "");
			const self = html.match(
				/<th scope="col" class="maky-cmp-self">[\s\S]*?<span class="maky-cmp-name">([^<]*)<\/span>/,
			);
			check(
				"highlighted column is this model",
				self !== null && decode(self[1]) === expectedName,
				`page: ${self?.[1] ?? "none"}, expected ${expectedName}`,
			);

			const names = [...html.matchAll(/<span class="maky-cmp-name">([^<]*)<\/span>/g)].map((match) =>
				decode(match[1]),
			);
			check(
				"model columns in order",
				isDeepStrictEqual(names, header.map(unmarked)),
				`page: ${names.join(", ")}`,
			);

			// The page gathers rows that are the same for every model into one band, and a part whose
			// rows all went there has no heading left (docs/contracts/comparison-table.md).
			const parts = [];
			for (const [label, ...values] of sentTable.data.content.slice(1)) {
				if (values.every((value) => value === "")) parts.push({ title: label, rows: [] });
				else parts.at(-1).rows.push({ label, values });
			}
			const varies = (values) => new Set(values.map((value) => value.trim())).size > 1;
			const anyVaries = parts.some((part) => part.rows.some((row) => varies(row.values)));
			const plain = text(html);
			const expected = [
				...parts
					.filter((part) => !anyVaries || part.rows.some((row) => varies(row.values)))
					.map((part) => unmarked(part.title)),
				...parts.flatMap((part) => part.rows.map((row) => unmarked(row.label))),
			];
			const missing = expected.filter((label) => !plain.includes(label));
			check(
				"every row label and every part that still has rows is on the page",
				missing.length === 0,
				`missing: ${missing.join(", ")}`,
			);
		} catch (error) {
			check("storefront is reachable", false, String(error.message ?? error));
		}
	}
	rows.push({ sku, slug, checks });
}

let failed = 0;
for (const { sku, slug, checks } of rows) {
	const bad = checks.filter((entry) => !entry.ok);
	failed += bad.length;
	console.log(
		`${bad.length === 0 ? "PASS" : "FAIL"}  ${sku}  ${slug || "(no product)"}  ${
			checks.length - bad.length
		}/${checks.length} checks`,
	);
	for (const entry of bad) console.log(`        ✗ ${entry.name}: ${entry.detail}`);
}
console.log(
	failed === 0
		? `round trip holds for all ${rows.length} products (${rows.map(({ sku }) => sku).join(", ")})`
		: `${failed} check(s) failed`,
);
process.exit(failed === 0 ? 0 : 1);
