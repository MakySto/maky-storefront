#!/usr/bin/env node
// Seed a LOCAL, throw-away Saleor with roof-rack sets (Thule, Nordrive), so the storefront can be
// run against real producer output without touching the shop.
//
// It writes to whatever NEXT_PUBLIC_SALEOR_API_URL points at, and therefore refuses to run unless
// that is this machine (localhost, 127.0.0.1 or ::1). It never takes a token from the
// environment: it logs in as the sandbox staff user it is given, so a production token cannot be
// used by mistake, and a production URL cannot be reached at all.
//
//   SANDBOX_STAFF_EMAIL=… SANDBOX_STAFF_PASSWORD=… \
//     node scripts/sandbox/seed-roof-racks.mjs --descriptions <dir with <id>.description.json>
//
// The descriptions are what CFM's producer writes for a set as `maky-content/1:stresny-nosic`
// (`docs/contracts/maky-content.md`): the sample files in `docs/contracts/maky-content/` or any
// directory holding the same files. Names are the catalogue names of four real sets (Thule and
// Nordrive, classic rails, flush rails, integrated rails, a smooth roof); the SKUs and prices are
// sandbox values. The sandbox set carries the maker and no other attribute; that is a choice made
// here, not a reading of the production sets (which attributes those carry was not read). Run it
// twice and nothing is duplicated: every object is looked up by slug or SKU first.
import fs from "node:fs";
import path from "node:path";

const SETS = [
	{
		id: "thule-pilot-71732",
		sku: "SANDBOX-RR-71732",
		brand: "Thule",
		category: { slug: "thule-stresne-nosice", name: "Thule strešné nosiče" },
		price: "329.00",
		name: "Strešný nosič Thule WingBar EVO Silver BMW X5 E70 (2011–2013) — Klasické lyžiny",
		weight: 11.2,
	},
	{
		id: "nordrive-ramp-56243",
		sku: "SANDBOX-RR-56243",
		brand: "Nordrive",
		category: { slug: "nordrive-stresne-nosice", name: "Nordrive strešné nosiče" },
		price: "139.00",
		name: "Strešný nosič Nordrive Silenzio Silver Evos ST Abarth 500 (2008–2016) — Hladká strecha",
		weight: 8.4,
	},
	{
		id: "thule-edge-two-lengths",
		sku: "SANDBOX-RR-71740",
		brand: "Thule",
		category: { slug: "thule-stresne-nosice", name: "Thule strešné nosiče" },
		price: "389.00",
		name: "Strešný nosič Thule WingBar Edge Black BMW X2 U10 (2024–) — Integrované lyžiny",
		weight: 10.6,
	},
	{
		id: "thule-smooth-roof",
		sku: "SANDBOX-RR-71747",
		brand: "Thule",
		category: { slug: "thule-stresne-nosice", name: "Thule strešné nosiče" },
		price: "359.00",
		name: "Strešný nosič Thule WingBar Edge Silver Fiat Punto 199 (2010–2012) — Hladká strecha",
		weight: 10.9,
	},
];
const CHANNEL = { name: "SK EUR", slug: "sk-eur", currencyCode: "EUR", defaultCountry: "SK" };
const PRODUCT_TYPE = { name: "Strešný nosič (sada)", slug: "roof-rack-bundle" };

const args = process.argv.slice(2);
const flag = (name) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
};

const apiUrl = process.env.NEXT_PUBLIC_SALEOR_API_URL ?? flag("--api-url");
if (!apiUrl) fail("Set NEXT_PUBLIC_SALEOR_API_URL (or --api-url) to the sandbox Saleor.");
const host = new URL(apiUrl).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
	fail(`Refusing to seed ${host}: this script only writes to a Saleor on this machine.`);
}
const email = process.env.SANDBOX_STAFF_EMAIL;
const password = process.env.SANDBOX_STAFF_PASSWORD;
if (!email || !password) fail("Set SANDBOX_STAFF_EMAIL and SANDBOX_STAFF_PASSWORD (the sandbox staff user).");
const descriptionsDir = flag("--descriptions");
if (!descriptionsDir) fail("Pass --descriptions <dir> with CFM's <id>.description.json files.");

function fail(message) {
	console.error(message);
	process.exit(2);
}

let token = null;
async function gql(query, variables = {}) {
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
		body: JSON.stringify({ query, variables }),
	});
	const body = await response.json();
	if (body.errors?.length) throw new Error(JSON.stringify(body.errors).slice(0, 600));
	return body.data;
}

/** Run a mutation and stop at the first user error: a half-seeded sandbox is worse than none. */
async function mutate(query, variables, key) {
	const data = await gql(query, variables);
	const errors = data[key]?.errors ?? [];
	if (errors.length) throw new Error(`${key}: ${JSON.stringify(errors)}`);
	return data[key];
}

const login = await gql(
	"mutation($email:String!,$password:String!){tokenCreate(email:$email,password:$password){token errors{message}}}",
	{ email, password },
);
token = login.tokenCreate.token;
if (!token) fail(`Login failed: ${JSON.stringify(login.tokenCreate.errors)}`);

const shop = await gql("{shop{version}}");
console.log(`Saleor ${shop.shop.version} at ${apiUrl}`);

// ── channel, warehouse, product type, categories ─────────────────────────────────────────────
// The channel, the shipping zone and the warehouse come from `seed-coolz.mjs`; this script adds only
// what the sets need, and stops if they are not there.
const base = await gql(`{
	channels{id slug}
	warehouses(first:1){edges{node{id}}}
	productTypes(first:50){edges{node{id slug}}}
	categories(first:50){edges{node{id slug}}}
}`);
const channel = base.channels.find((candidate) => candidate.slug === CHANNEL.slug);
if (!channel)
	fail(`Channel ${CHANNEL.slug} is missing: run seed-coolz.mjs first, it creates the shop's basics.`);
const warehouseId = base.warehouses.edges[0]?.node.id;
if (!warehouseId) fail("No warehouse: run seed-coolz.mjs first.");

let productType = base.productTypes.edges
	.map((edge) => edge.node)
	.find((node) => node.slug === PRODUCT_TYPE.slug);
if (!productType) {
	productType = (
		await mutate(
			"mutation($input:ProductTypeInput!){productTypeCreate(input:$input){productType{id slug} errors{field code message}}}",
			{ input: { ...PRODUCT_TYPE, hasVariants: false, kind: "NORMAL" } },
			"productTypeCreate",
		)
	).productType;
}
const categories = new Map(base.categories.edges.map((edge) => [edge.node.slug, edge.node]));
for (const { category } of SETS) {
	if (categories.has(category.slug)) continue;
	categories.set(
		category.slug,
		(
			await mutate(
				"mutation($input:CategoryInput!){categoryCreate(input:$input){category{id slug} errors{field code message}}}",
				{ input: category },
				"categoryCreate",
			)
		).category,
	);
}

// The maker: the storefront builds its brand list from Saleor's `manufacturer` attribute
// (`src/lib/brands/catalog.ts`), so the sandbox set carries it. It carries nothing else.
let maker = (await gql('{attribute(slug:"manufacturer"){id slug}}')).attribute;
if (!maker) {
	maker = (
		await mutate(
			"mutation($input:AttributeCreateInput!){attributeCreate(input:$input){attribute{id slug} errors{field code message}}}",
			{
				input: {
					name: "Výrobca",
					slug: "manufacturer",
					type: "PRODUCT_TYPE",
					inputType: "DROPDOWN",
					valueRequired: false,
					values: [{ name: "Thule" }],
				},
			},
			"attributeCreate",
		)
	).attribute;
}
const assigned = await gql("query($id:ID!){productType(id:$id){productAttributes{slug}}}", {
	id: productType.id,
});
if (!assigned.productType.productAttributes.some((attribute) => attribute.slug === "manufacturer")) {
	await mutate(
		"mutation($id:ID!,$operations:[ProductAttributeAssignInput!]!){productAttributeAssign(productTypeId:$id,operations:$operations){errors{field code message}}}",
		{ id: productType.id, operations: [{ id: maker.id, type: "PRODUCT" }] },
		"productAttributeAssign",
	);
}

// ── the sets ─────────────────────────────────────────────────────────────────────────────────
for (const set of SETS) {
	const slug = `${set.name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}-${set.sku.toLowerCase()}`;
	const description = fs
		.readFileSync(path.join(descriptionsDir, `${set.id}.description.json`), "utf8")
		.trim();
	JSON.parse(description); // refuse a file that is not JSON before anything is written

	const found = await gql(
		"query($slug:String!){products(first:1,where:{slug:{eq:$slug}}){edges{node{id variants{id sku}}}}}",
		{ slug },
	);
	let product = found.products.edges[0]?.node;
	const input = {
		name: set.name,
		slug,
		description,
		// Saleor's SEO title is at most 70 characters: the name without its roof-type suffix.
		seo: { title: set.name.split(" — ")[0].slice(0, 70), description: `${set.name} - sandbox` },
		weight: set.weight,
		category: categories.get(set.category.slug).id,
		attributes: [{ id: maker.id, dropdown: { value: set.brand } }],
	};
	if (product) {
		await mutate(
			"mutation($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field code message}}}",
			{ id: product.id, input },
			"productUpdate",
		);
	} else {
		product = (
			await mutate(
				"mutation($input:ProductCreateInput!){productCreate(input:$input){product{id variants{id sku}} errors{field code message}}}",
				{ input: { ...input, productType: productType.id } },
				"productCreate",
			)
		).product;
	}

	await mutate(
		"mutation($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field code message}}}",
		{
			id: product.id,
			input: {
				updateChannels: [
					{ channelId: channel.id, isPublished: true, visibleInListings: true, isAvailableForPurchase: true },
				],
			},
		},
		"productChannelListingUpdate",
	);

	let variant = product.variants?.find((candidate) => candidate.sku === set.sku);
	if (!variant) {
		variant = (
			await mutate(
				"mutation($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id sku} errors{field code message}}}",
				{
					input: {
						product: product.id,
						sku: set.sku,
						name: set.name,
						trackInventory: true,
						attributes: [],
						stocks: [{ warehouse: warehouseId, quantity: 25 }],
					},
				},
				"productVariantCreate",
			)
		).productVariant;
	}
	await mutate(
		"mutation($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field code message}}}",
		{ id: variant.id, input: [{ channelId: channel.id, price: set.price }] },
		"productVariantChannelListingUpdate",
	);
	console.log(`${set.sku}  ${set.id}  ${slug}`);
}

console.log("done");
