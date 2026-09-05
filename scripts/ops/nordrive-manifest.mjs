#!/usr/bin/env node
/**
 * Read-only Nordrive identity + sellability manifest.
 *
 * Answers, per product, the questions a canary sale actually depends on:
 * does it have a variant, an SKU, an external reference, a category, images,
 * a price in this channel, and is it purchasable — and if not, which of those
 * is missing. Historical counts (20 / 278 / 414) are deliberately NOT baked in;
 * the cohort is whatever the API reports today.
 *
 *   node scripts/ops/nordrive-manifest.mjs [--channel sk-eur] [--json out.json]
 *
 * Anonymous and read-only: it uses the same public endpoint a shopper does, so
 * what it reports is what a shopper can actually buy. It never mutates.
 */
const args = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const API = process.env.NEXT_PUBLIC_SALEOR_API_URL ?? "https://api.maky.store/graphql/";
const CHANNEL = arg("--channel", "sk-eur");
const JSON_OUT = arg("--json", null);
const BRAND = arg("--brand", "Nordrive");

const QUERY = `
query NordriveManifest($channel: String!, $first: Int!, $after: String, $brand: String!) {
  products(
    first: $first
    after: $after
    channel: $channel
    where: { attributes: [{ slug: "manufacturer", value: { name: { eq: $brand } } }] }
  ) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node {
      id
      name
      slug
      externalReference
      isAvailableForPurchase
      availableForPurchase
      category { slug }
      media { id }
      pricing { priceRange { start { gross { amount currency } } } }
      variants {
        id
        sku
        externalReference
        quantityAvailable
        metafield(key: "cfm_availability_mode")
        pricing { price { gross { amount currency } } }
      }
    } }
  }
}`;

async function post(variables) {
	const res = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query: QUERY, variables }),
	});
	const body = await res.json();
	if (body.errors) throw new Error(JSON.stringify(body.errors));
	return body.data.products;
}

const rows = [];
let after = null;
let total = 0;
for (;;) {
	const page = await post({ channel: CHANNEL, first: 100, after, brand: BRAND });
	total = page.totalCount;
	for (const { node } of page.edges) {
		const variants = node.variants ?? [];
		const price = variants[0]?.pricing?.price?.gross ?? node.pricing?.priceRange?.start?.gross ?? null;
		const blockers = [];
		if (variants.length === 0) blockers.push("no-variant");
		if (variants.length > 1) blockers.push(`multi-variant(${variants.length})`);
		if (!variants.some((v) => v.sku)) blockers.push("no-sku");
		if (!node.externalReference && !variants.some((v) => v.externalReference))
			blockers.push("no-external-reference");
		if (!node.category) blockers.push("no-category");
		if ((node.media ?? []).length === 0) blockers.push("no-image");
		if (!price) blockers.push("no-price");
		if (!node.isAvailableForPurchase) blockers.push("not-purchasable");
		const saleToOrder = variants.some((v) => v.metafield);
		if (!saleToOrder && variants.every((v) => (v.quantityAvailable ?? 0) < 1))
			blockers.push("no-stock-and-no-sale-to-order");

		rows.push({
			slug: node.slug,
			productId: node.id,
			variantId: variants[0]?.id ?? null,
			sku: variants[0]?.sku ?? null,
			externalReference: node.externalReference ?? variants[0]?.externalReference ?? null,
			category: node.category?.slug ?? null,
			media: (node.media ?? []).length,
			price: price ? `${price.amount} ${price.currency}` : null,
			purchasable: Boolean(node.isAvailableForPurchase),
			availableFrom: node.availableForPurchase ?? null,
			availabilityMode: variants[0]?.metafield ?? null,
			quantityAvailable: variants[0]?.quantityAvailable ?? null,
			blockers,
		});
	}
	if (!page.pageInfo.hasNextPage) break;
	after = page.pageInfo.endCursor;
}

const sellable = rows.filter((r) => r.blockers.length === 0);
console.log(`channel        ${CHANNEL}`);
console.log(`brand          ${BRAND}`);
console.log(`public cohort  ${total} (measured now — do not carry a historical count forward)`);
console.log(`canary-ready   ${sellable.length}/${rows.length}`);
console.log("");
const pad = (v, n) =>
	String(v ?? "—")
		.slice(0, n)
		.padEnd(n);
console.log(`${pad("slug", 54)} ${pad("sku", 16)} ${pad("category", 30)} ${pad("price", 12)} blockers`);
for (const r of rows) {
	console.log(
		`${pad(r.slug, 54)} ${pad(r.sku, 16)} ${pad(r.category, 30)} ${pad(r.price, 12)} ${
			r.blockers.join(",") || "ok"
		}`,
	);
}

const byBlocker = {};
for (const r of rows) for (const b of r.blockers) byBlocker[b] = (byBlocker[b] ?? 0) + 1;
console.log("\nblockers across the cohort:");
for (const [b, n] of Object.entries(byBlocker).sort((a, c) => c[1] - a[1])) console.log(`  ${n}  ${b}`);
if (Object.keys(byBlocker).length === 0) console.log("  none");

if (JSON_OUT) {
	const { writeFileSync } = await import("node:fs");
	writeFileSync(JSON_OUT, JSON.stringify({ channel: CHANNEL, brand: BRAND, total, rows }, null, 2));
	console.log(`\nwrote ${JSON_OUT}`);
}
