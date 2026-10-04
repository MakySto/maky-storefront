// The car-fridge attributes the page template stands on, as a Saleor really serves them.
//
//   node --env-file=/opt/storefront/.env scripts/checks/fridge-attributes.mjs
//   node scripts/checks/fridge-attributes.mjs --api http://127.0.0.1:8000/graphql/ --verbose
//   node scripts/checks/fridge-attributes.mjs --from-file response.json --json
//
// READ-ONLY. It sends one GraphQL `query` (never a mutation) with no token, for the products of the
// car-fridge category in one channel, and prints what came back. It writes nothing anywhere. The
// address comes from NEXT_PUBLIC_SALEOR_API_URL (or --api) and is never printed.
//
// Why it exists: the car-fridge template (`src/lib/product-templates.ts`) draws the key-facts band,
// groups the technical parameters and writes the units from the `cfm:attribute:<key>` external
// references of a product's attributes and from whether their values are plain numbers. The
// previews were made on sandbox attributes whose names and text values were written by hand
// (`scripts/sandbox/coolz-attributes.mjs`), so they cannot say what the live page will look like.
// This reads the real rows and says whether the five coolers would get the page that was approved.
//
// Run it before CFM switches the typed descriptions on, and once more after CoolZ 32 is
// republished: the question is the same for the data the page really gets.
//
// Exit 0 = every cooler would get the approved page. Exit 1 = at least one would not; each such
// row is named, and the difference is a customer effect nobody approved, so hold the publication
// and ask. Exit 2 = the check could not run (no address, no answer, an unreadable response), which
// is not a pass.
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** The five CoolZ coolers (`COOLZ_COOLER_SKUS` in CFM). The two accessories have no fridge attributes. */
export const COOLER_SKUS = ["TK20409", "TK20410", "TK20411", "TK20412", "TK20413"];

const CATEGORY = "autochladnicky";
const CHANNEL = "sk-eur";

/** The key-facts band's facts that have to be plain numbers, and the one that has to be a yes. */
export const NUMERIC_FACTS = ["volume", "rated_power", "temperature_min", "temperature_max"];
export const YES_FACT = "bluetooth_app_control";

/** The rule `formatAttributeValue` applies (`src/lib/product-attributes.ts`): only these get a unit. */
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;

const TEMPLATE_SOURCE = fileURLToPath(new URL("../../src/lib/product-templates.ts", import.meta.url));

/**
 * What the car-fridge template names, read out of its source rather than typed again here: a
 * parameter added to a group there must not need a second edit in a checking script that would
 * silently rot (the approach `published-content.mjs` takes for the category slugs).
 */
export function readTemplate(source) {
	const start = source.indexOf("const AUTOCHLADNICKA");
	const end = start === -1 ? -1 : source.indexOf("\n};", start);
	const block = end === -1 ? "" : source.slice(start, end);
	const refs = [
		...new Set([...block.matchAll(/attr\("([a-z0-9_]+)"\)/g)].map((m) => `cfm:attribute:${m[1]}`)),
	];
	const min = /const MIN_GROUPED_ROWS = (\d+);/.exec(source);
	return { refs, minGroupedRows: min ? Number(min[1]) : null };
}

const numberOf = (value) =>
	PLAIN_NUMBER.test(value.trim()) ? Number.parseFloat(value.trim().replace(",", ".")) : null;

/**
 * Judge the products a category query returned against what the template needs.
 *
 * `problems` change what the customer sees from what was approved (no band, no grouping, a fact
 * without its number). `notes` are cosmetic: a row that stays as text, a fact that is not a yes.
 */
export function judge(products, { refs, minGroupedRows, skus = COOLER_SKUS }) {
	const bySku = new Map();
	for (const product of products)
		for (const variant of product.variants ?? []) bySku.set(variant.sku, product);

	return skus.map((sku) => {
		const product = bySku.get(sku);
		if (!product) {
			return {
				sku,
				name: null,
				slug: null,
				problems: [
					"not returned: it is not in the category, not published in the channel, or the channel is wrong",
				],
				notes: [],
				rows: [],
			};
		}

		const rows = product.attributes
			.map(({ attribute, values }) => ({
				ref: attribute.externalReference ?? "",
				label: attribute.name ?? "",
				type: attribute.inputType,
				values: values.map((value) => (value.name ?? "").trim()).filter(Boolean),
				yes: values.some((value) => value.boolean === true),
			}))
			// The page's own filter: a row needs a name and a value to be drawn at all.
			.filter((row) => row.label && row.values.length > 0);
		const byRef = new Map(rows.map((row) => [row.ref, row]));
		const known = rows.filter((row) => refs.includes(row.ref)).length;

		const problems = [];
		const notes = [];
		const facts = {};
		for (const key of NUMERIC_FACTS) {
			const row = byRef.get(`cfm:attribute:${key}`);
			const number = row ? numberOf(row.values[0]) : null;
			facts[key] = row ? row.values[0] : null;
			if (!row) problems.push(`${key}: no row (cfm:attribute:${key} is missing, or has no name or value)`);
			else if (number === null)
				problems.push(`${key}: "${row.values[0]}" is not a plain number, so no fact and no unit`);
		}
		const min = numberOf(facts.temperature_min ?? "");
		const max = numberOf(facts.temperature_max ?? "");
		if (min !== null && max !== null && min > max) problems.push(`temperature range: ${min} is above ${max}`);

		const bluetooth = byRef.get(`cfm:attribute:${YES_FACT}`);
		facts[YES_FACT] = Boolean(bluetooth?.yes);
		if (!bluetooth)
			notes.push(`${YES_FACT}: no row, the band has three facts and takes the next generic one`);
		else if (bluetooth.type !== "BOOLEAN")
			notes.push(`${YES_FACT}: ${bluetooth.type} instead of BOOLEAN, no Bluetooth fact`);
		else if (!bluetooth.yes) notes.push(`${YES_FACT}: a no, so no Bluetooth fact`);

		if (known < minGroupedRows) {
			problems.push(
				`${known} of ${rows.length} rows are named by the template (at least ${minGroupedRows} needed): the parameters stay one flat list`,
			);
		}
		return { sku, name: product.name, slug: product.slug, problems, notes, rows, known, facts };
	});
}

const QUERY = `query FridgeAttributes($channel: String!) {
  category(slug: ${JSON.stringify(CATEGORY)}) {
    products(first: 50, channel: $channel) {
      edges { node { name slug variants { sku } attributes { attribute { slug name externalReference inputType unit } values { name boolean } } } }
    }
  }
}`;

async function load(args) {
	const flag = (name) => {
		const i = args.indexOf(name);
		return i === -1 ? null : args[i + 1];
	};
	const file = flag("--from-file");
	let body;
	if (file) {
		body = JSON.parse(readFileSync(file, "utf8"));
	} else {
		const api = flag("--api") ?? process.env.NEXT_PUBLIC_SALEOR_API_URL;
		if (!api)
			throw new Error("no address: set NEXT_PUBLIC_SALEOR_API_URL (node --env-file=… ) or pass --api");
		const response = await fetch(api, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query: QUERY, variables: { channel: flag("--channel") ?? CHANNEL } }),
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) throw new Error(`the API answered HTTP ${response.status}`);
		body = await response.json();
	}
	if (body.errors?.length) throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`);
	const edges = body.data?.category?.products?.edges;
	if (!Array.isArray(edges))
		throw new Error(`no products in category "${CATEGORY}" (is the category slug or the channel right?)`);
	return edges.map((edge) => edge.node);
}

async function main() {
	const args = process.argv.slice(2);
	const skuFlag = args.indexOf("--sku");
	const skus = skuFlag === -1 ? COOLER_SKUS : args[skuFlag + 1].split(",");
	let report;
	try {
		const template = readTemplate(readFileSync(TEMPLATE_SOURCE, "utf8"));
		if (template.refs.length < 20 || template.minGroupedRows === null) {
			throw new Error("could not read the car-fridge template out of src/lib/product-templates.ts");
		}
		const products = await load(args);
		report = { ...template, checked: judge(products, { ...template, skus }), returned: products.length };
	} catch (error) {
		console.error(`check could not run: ${error instanceof Error ? error.message : error}`);
		process.exit(2);
	}

	const failed = report.checked.filter((item) => item.problems.length > 0);
	if (args.includes("--json")) {
		console.log(JSON.stringify({ pass: failed.length === 0, ...report }, null, 2));
	} else {
		console.log(
			`category ${CATEGORY}, ${report.returned} products returned, ${report.checked.length} coolers checked\n`,
		);
		for (const item of report.checked) {
			const band = item.facts
				? NUMERIC_FACTS.map((key) => `${key} ${item.facts[key] ?? "-"}`).join(" · ") +
					` · bluetooth ${item.facts[YES_FACT] ? "yes" : "no"}`
				: "";
			console.log(
				`${item.problems.length ? "FAIL" : "ok  "}  ${item.sku}  ${item.name ?? "(not returned)"}${
					item.slug ? `  /${item.slug}` : ""
				}`,
			);
			if (band)
				console.log(
					`      band: ${band}\n      rows: ${item.rows.length} drawn, ${item.known} named by the template`,
				);
			for (const problem of item.problems) console.log(`      FAIL ${problem}`);
			for (const note of item.notes) console.log(`      note ${note}`);
			if (args.includes("--verbose")) {
				for (const row of item.rows)
					console.log(
						`        ${row.ref || "(no reference)"} [${row.type}] ${row.label}: ${row.values.join(" | ")}`,
					);
			}
		}
		console.log(
			failed.length === 0
				? "\nPASS: every cooler gets the approved page."
				: `\nFAIL: ${failed.length} of ${report.checked.length} coolers would not.`,
		);
	}
	process.exit(failed.length === 0 ? 0 : 1);
}

// Importable for the tests; runs only when started as a script.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
