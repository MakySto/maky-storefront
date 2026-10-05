#!/usr/bin/env node
// Seed a LOCAL, throw-away Saleor with the five CoolZ coolers, so the storefront can be run
// against real producer output without touching the shop.
//
// It writes to whatever NEXT_PUBLIC_SALEOR_API_URL points at, and therefore refuses to run unless
// that is this machine (localhost, 127.0.0.1 or ::1). It never takes a token from the
// environment: it logs in as the sandbox staff user it is given, so a production token cannot be
// used by mistake, and a production URL cannot be reached at all.
//
//   SANDBOX_STAFF_EMAIL=… SANDBOX_STAFF_PASSWORD=… \
//     node scripts/sandbox/seed-coolz.mjs --descriptions <dir with TK2040x.description.json>
//
// The descriptions are the files `backend/scripts/storefront_maky_content_sample.py` (typed
// `maky-content/1`, the CoolZ pages) and `backend/scripts/storefront_comparison_sample.py` (the
// earlier untyped form) in the CFM repository write from the real producer. Names, slugs and
// weights come from the same onboarding manifest; the prices are the catalogue prices shown in the
// approved design and are sandbox values. Run it twice and nothing is duplicated: every object is
// looked up by slug or SKU first.
//
// With the typed files the sandbox also gets the fridge attributes (`coolz-attributes.mjs`, a
// documented assumption about names and text values) and one more product, the block gallery: an
// invented page showing every block the profile has. It exists in the sandbox only.
import fs from "node:fs";
import path from "node:path";
import { FRIDGE_ATTRIBUTES, fridgeValues } from "./coolz-attributes.mjs";

// `ean` is the number CFM holds for the product (the onboarding manifest) and publishes as the public
// variant metafield `cfm_ean`; the sandbox writes the same key so the product page shows it.
const COOLERS = [
	{
		sku: "TK20409",
		ean: "8717809204097",
		model: "19",
		price: "249.00",
		name: "Kompresorová autochladnička PRO-USER CoolZ 19 l",
		weight: 8.9,
	},
	{
		sku: "TK20410",
		ean: "8717809204103",
		model: "32",
		price: "279.00",
		name: "Kompresorová autochladnička PRO-USER CoolZ 32 l",
		weight: 12.9,
	},
	{
		sku: "TK20411",
		ean: "8717809204110",
		model: "40",
		price: "319.00",
		name: "Kompresorová autochladnička PRO-USER CoolZ 40 l",
		weight: 13.8,
	},
	{
		sku: "TK20412",
		ean: "8717809204127",
		model: "65",
		price: "379.00",
		name: "Kompresorová autochladnička PRO-USER CoolZ 65 l",
		weight: 16.9,
	},
	{
		sku: "TK20413",
		ean: "8717809204134",
		model: "83",
		price: "489.00",
		name: "Dvojzónová kompresorová autochladnička PRO-USER CoolZ 83 l",
		weight: 20.5,
	},
];
/** The invented block gallery (`gallery.description.json`): every role and icon once. Not a product. */
const GALLERY = {
	sku: "SANDBOX-GALLERY",
	price: "99.00",
	name: "Ukážka blokov popisu (len sandbox)",
	weight: 1,
	file: "gallery.description.json",
};
const CHANNEL = { name: "SK EUR", slug: "sk-eur", currencyCode: "EUR", defaultCountry: "SK" };

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
if (!descriptionsDir)
	fail("Pass --descriptions <dir> with the CFM producer's TK2040x.description.json files.");

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

// ── channel, shipping, warehouse ─────────────────────────────────────────────────────────────
const base = await gql(`{
	channels{id slug}
	shippingZones(first:1){edges{node{id name countries{code}}}}
	warehouses(first:1){edges{node{id}}}
	productTypes(first:50){edges{node{id slug}}}
	categories(first:50){edges{node{id slug}}}
}`);
const zone = base.shippingZones.edges[0].node;
const warehouseId = base.warehouses.edges[0].node.id;

if (!zone.countries.some((country) => country.code === CHANNEL.defaultCountry)) {
	await mutate(
		"mutation($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field code message}}}",
		{
			id: zone.id,
			input: { countries: [...zone.countries.map((country) => country.code), CHANNEL.defaultCountry] },
		},
		"shippingZoneUpdate",
	);
}

let channel = base.channels.find((candidate) => candidate.slug === CHANNEL.slug);
if (!channel) {
	const created = await mutate(
		"mutation($input:ChannelCreateInput!){channelCreate(input:$input){channel{id slug} errors{field code message}}}",
		{
			input: {
				...CHANNEL,
				isActive: true,
				addShippingZones: [zone.id],
				addWarehouses: [warehouseId],
			},
		},
		"channelCreate",
	);
	channel = created.channel;
	console.log(`created channel ${channel.slug}`);
}

const methods = await gql("query($id:ID!){shippingZone(id:$id){shippingMethods{id name}}}", { id: zone.id });
let method = methods.shippingZone.shippingMethods.find((candidate) => candidate.name === "Kuriér");
if (!method) {
	method = (
		await mutate(
			"mutation($input:ShippingPriceInput!){shippingPriceCreate(input:$input){shippingMethod{id name} errors{field code message}}}",
			{
				input: {
					name: "Kuriér",
					shippingZone: zone.id,
					type: "PRICE",
					minimumDeliveryDays: 1,
					maximumDeliveryDays: 3,
				},
			},
			"shippingPriceCreate",
		)
	).shippingMethod;
}
await mutate(
	"mutation($id:ID!,$input:ShippingMethodChannelListingInput!){shippingMethodChannelListingUpdate(id:$id,input:$input){errors{field code message}}}",
	{
		id: method.id,
		input: {
			addChannels: [
				{ channelId: channel.id, price: "4.90", minimumOrderPrice: "0", maximumOrderPrice: null },
			],
		},
	},
	"shippingMethodChannelListingUpdate",
);

// ── product type, category ───────────────────────────────────────────────────────────────────
const productTypeSlug = "autochladnicka";
const categorySlug = "autochladnicky";
let productType = base.productTypes.edges
	.map((edge) => edge.node)
	.find((node) => node.slug === productTypeSlug);
if (!productType) {
	productType = (
		await mutate(
			"mutation($input:ProductTypeInput!){productTypeCreate(input:$input){productType{id slug} errors{field code message}}}",
			{ input: { name: "Autochladnička", slug: productTypeSlug, hasVariants: false, kind: "NORMAL" } },
			"productTypeCreate",
		)
	).productType;
}
let category = base.categories.edges.map((edge) => edge.node).find((node) => node.slug === categorySlug);
if (!category) {
	category = (
		await mutate(
			"mutation($input:CategoryInput!){categoryCreate(input:$input){category{id slug} errors{field code message}}}",
			{ input: { name: "Autochladničky", slug: categorySlug } },
			"categoryCreate",
		)
	).category;
}

// ── manufacturer attribute ───────────────────────────────────────────────────────────────────
// Every production product carries Saleor's `manufacturer` attribute (CFM fills it) and the storefront
// builds its brand list from it. A catalogue without a single maker makes a production build fail
// (src/lib/brands/catalog.ts then asks Saleor for the counts of zero makers), so the sandbox has one.
const MAKER = "Pro-USER";
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
					values: [{ name: MAKER }],
				},
			},
			"attributeCreate",
		)
	).attribute;
	console.log("created attribute manufacturer");
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

// ── fridge attributes ────────────────────────────────────────────────────────────────────────
// Created with CFM's external references and input types, so the storefront reads them exactly as it
// reads CFM's (`cfm:attribute:<key>`). Names and text values are a sandbox assumption, see
// `coolz-attributes.mjs`. Skipped when the descriptions are not the typed ones.
const typedDescriptions = fs.existsSync(path.join(descriptionsDir, GALLERY.file));
const fridgeAttributeIds = {};
if (typedDescriptions) {
	const present = await gql("query($id:ID!){productType(id:$id){productAttributes{id slug}}}", {
		id: productType.id,
	});
	const assignedSlugs = new Set(present.productType.productAttributes.map((attribute) => attribute.slug));
	const toAssign = [];
	for (const [key, name, inputType] of FRIDGE_ATTRIBUTES) {
		const slug = key.replace(/_/g, "-");
		let attribute = (await gql("query($slug:String!){attribute(slug:$slug){id slug}}", { slug })).attribute;
		if (!attribute) {
			attribute = (
				await mutate(
					"mutation($input:AttributeCreateInput!){attributeCreate(input:$input){attribute{id slug} errors{field code message}}}",
					{
						input: {
							name,
							slug,
							type: "PRODUCT_TYPE",
							inputType,
							externalReference: `cfm:attribute:${key}`,
							valueRequired: false,
							visibleInStorefront: true,
						},
					},
					"attributeCreate",
				)
			).attribute;
		}
		fridgeAttributeIds[key] = { id: attribute.id, inputType };
		if (!assignedSlugs.has(slug)) toAssign.push({ id: attribute.id, type: "PRODUCT" });
	}
	if (toAssign.length > 0) {
		await mutate(
			"mutation($id:ID!,$operations:[ProductAttributeAssignInput!]!){productAttributeAssign(productTypeId:$id,operations:$operations){errors{field code message}}}",
			{ id: productType.id, operations: toAssign },
			"productAttributeAssign",
		);
		console.log(`assigned ${toAssign.length} fridge attributes to ${productTypeSlug}`);
	}
}

/** The `attributes` input of a product: the maker, and the fridge values when it has them. */
function attributeInput(values) {
	const input = [{ id: maker.id, dropdown: { value: MAKER } }];
	for (const [key, value] of Object.entries(values ?? {})) {
		const { id, inputType } = fridgeAttributeIds[key] ?? {};
		if (!id) continue;
		if (inputType === "NUMERIC") input.push({ id, numeric: String(value) });
		else if (inputType === "BOOLEAN") input.push({ id, boolean: Boolean(value) });
		else input.push({ id, plainText: String(value) });
	}
	return input;
}

// ── the five coolers ─────────────────────────────────────────────────────────────────────────
const SEEDED = [
	...COOLERS.map((cooler) => ({ ...cooler, file: `${cooler.sku}.description.json`, fridge: true })),
	...(typedDescriptions ? [{ ...GALLERY, fridge: false }] : []),
];
for (const cooler of SEEDED) {
	const slug = `${cooler.name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}-${cooler.sku.toLowerCase()}`;
	const file = path.join(descriptionsDir, cooler.file);
	const description = fs.readFileSync(file, "utf8").trim();
	JSON.parse(description); // refuse a file that is not JSON before anything is written

	const found = await gql(
		"query($slug:String!){products(first:1,where:{slug:{eq:$slug}}){edges{node{id variants{id sku}}}}}",
		{ slug },
	);
	let product = found.products.edges[0]?.node;
	const input = {
		name: cooler.name,
		slug,
		description,
		seo: { title: cooler.name, description: `${cooler.name} - sandbox` },
		weight: cooler.weight,
		category: category.id,
		attributes: attributeInput(typedDescriptions && cooler.fridge ? fridgeValues(cooler.sku) : null),
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

	let variant = product.variants?.find((candidate) => candidate.sku === cooler.sku);
	if (!variant) {
		variant = (
			await mutate(
				"mutation($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id sku} errors{field code message}}}",
				{
					input: {
						product: product.id,
						sku: cooler.sku,
						name: cooler.name,
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
		{ id: variant.id, input: [{ channelId: channel.id, price: cooler.price }] },
		"productVariantChannelListingUpdate",
	);
	if (cooler.ean) {
		await mutate(
			"mutation($id:ID!,$input:[MetadataInput!]!){updateMetadata(id:$id,input:$input){errors{field code message}}}",
			{ id: variant.id, input: [{ key: "cfm_ean", value: cooler.ean }] },
			"updateMetadata",
		);
	}
	console.log(`${cooler.sku}  ${cooler.model ? `CoolZ ${cooler.model}` : "gallery"}  ${slug}`);
}

console.log("done");
