#!/usr/bin/env node
/**
 * COMMERCE-2 payment canary — prepared for GO-COMMERCE-LIVE, NOT run before it.
 *
 * What it proves, and the exact line it stops at:
 *
 *   PAYMENT_CONFIG_VERIFIED   not this script: needs MANAGE_APPS or the Saleor Dashboard
 *   PAYMENT_INIT_TESTED       THIS script, --execute: a public canary checkout in one channel
 *                             reaches paymentGatewayInitialize and the Stripe app answers
 *   PAYMENT_CHARGE_TESTED     never this script
 *   ORDER_E2E                 never this script
 *
 * Steps with --execute (every one is a WRITE to the Saleor the URL names):
 *
 *   1. checkoutCreate          channel, languageCode, one line, email, shipping + billing address
 *   2. deliveryMethodUpdate    the cheapest shipping method Saleor offers for that address
 *   3. read-back               currency = the channel's, a total, tax lines as Saleor computed them
 *   4. paymentGatewayInitialize  for `saleor.app.payment.stripe` only; prints gateway ids, errors,
 *                              the data KEYS and whether the publishable key is live or test —
 *                              never a key
 *   5. STOP                    the checkout id is printed; nothing is paid, confirmed or completed
 *
 * The mutations that would go further are not in this file at all, and
 * `src/lib/payment-canary-script.test.ts` fails if one is ever added.
 *
 * With --hidden-negative it instead tries to put a HIDDEN variant into a fresh checkout and
 * passes only if Saleor refuses. That is also a write, and also only under GO.
 *
 * Without --execute it prints the plan and changes nothing (no network at all unless --read,
 * which runs the anonymous pre-checks: product visible, variant priced in the channel's currency,
 * shop gateways listed).
 *
 *   node scripts/checks/payment-canary.mjs --channel at-eur --variant <id> --product-slug <slug>
 *   node scripts/checks/payment-canary.mjs --channel at-eur --variant <id> --product-slug <slug> --read
 *   MAKY_GO_COMMERCE_LIVE=at-eur node scripts/checks/payment-canary.mjs --execute \
 *       --channel at-eur --variant <id> --email canary@… --address canary-address.at.json
 *
 * Exit: 0 passed / plan printed, 1 a check failed, 2 refused or misused.
 */
import { readFileSync } from "node:fs";

const API =
	process.env.SALEOR_API_URL || process.env.NEXT_PUBLIC_SALEOR_API_URL || "https://api.maky.store/graphql/";
const STRIPE = "saleor.app.payment.stripe";

/** Mirrors src/lib/channel-map.ts + LOCALE_MAP.graphqlLanguageCode; the test pins the two together. */
export const CHANNELS = {
	"sk-eur": { currency: "EUR", languageCode: "SK" },
	"cz-czk": { currency: "CZK", languageCode: "CS" },
	"de-eur": { currency: "EUR", languageCode: "DE" },
	"at-eur": { currency: "EUR", languageCode: "DE_AT" },
	"pl-pln": { currency: "PLN", languageCode: "PL" },
	"hu-huf": { currency: "HUF", languageCode: "HU" },
	"it-eur": { currency: "EUR", languageCode: "IT" },
	"fr-eur": { currency: "EUR", languageCode: "FR" },
	"es-eur": { currency: "EUR", languageCode: "ES" },
	"ro-ron": { currency: "RON", languageCode: "RO" },
	"us-usd": { currency: "USD", languageCode: "EN" },
	"ca-cad": { currency: "CAD", languageCode: "EN_CA" },
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

const refuse = (message) => {
	console.error(`REFUSED: ${message}`);
	process.exit(2);
};

const channel = option("channel");
const variant = option("variant");
if (!channel || !CHANNELS[channel]) refuse(`--channel must be one of ${Object.keys(CHANNELS).join(", ")}`);
if (!variant) refuse("--variant <ProductVariant id> is required");
const { currency, languageCode } = CHANNELS[channel];

async function gql(query, variables) {
	const response = await fetch(API, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok || body.errors) {
		throw new Error(`HTTP ${response.status}: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
	}
	return body.data;
}

const PLAN = [
	`API ${API}, channel ${channel} (${currency}, ${languageCode}), variant ${variant}`,
	"1. checkoutCreate with one line, the canary email and address",
	"2. checkoutDeliveryMethodUpdate: cheapest shipping method offered for that address",
	`3. read-back: currency ${currency}, a total, tax as Saleor computed it`,
	`4. paymentGatewayInitialize for ${STRIPE}: ids, errors, data keys, live/test — never a key`,
	"5. STOP — nothing is paid, confirmed or completed; the checkout id is printed",
];

if (!flag("execute") && !flag("hidden-negative")) {
	console.log("PLAN (nothing written):");
	for (const line of PLAN) console.log(`  ${line}`);

	if (flag("read")) {
		const slug = option("product-slug");
		if (!slug) refuse("--read needs --product-slug");
		const data = await gql(
			`query CanaryRead($slug: String!, $channel: String!) {
				product(slug: $slug, channel: $channel) { id isAvailableForPurchase variants { id pricing { price { gross { amount currency } } } } }
				shop { availablePaymentGateways(channel: $channel) { id currencies } }
			}`,
			{ slug, channel },
		);
		const product = data.product;
		const found = product?.variants?.find((v) => v.id === variant);
		const gross = found?.pricing?.price?.gross;
		console.log("\nREAD (anonymous):");
		console.log(
			`  product visible in ${channel}: ${Boolean(product)}; purchasable: ${
				product?.isAvailableForPurchase ?? "—"
			}`,
		);
		console.log(`  variant priced: ${gross ? `${gross.amount} ${gross.currency}` : "—"}`);
		console.log(
			`  shop gateways: ${
				data.shop.availablePaymentGateways.map((g) => g.id).join(", ") || "none"
			} (transaction apps are not listed here)`,
		);
		if (product && gross && gross.currency !== currency) {
			console.error(`FAIL: variant priced in ${gross.currency}, channel is ${currency}`);
			process.exit(1);
		}
	}
	process.exit(0);
}

// ─── Writes. Only under the owner's GO, named for this exact channel. ─────────────────────
if (process.env.MAKY_GO_COMMERCE_LIVE !== channel) {
	refuse(
		`writes need MAKY_GO_COMMERCE_LIVE=${channel} — the GO-COMMERCE-LIVE for this channel, not a general one`,
	);
}
if (process.env.MAKY_SALEOR_WRITES === "block") refuse("MAKY_SALEOR_WRITES=block is set in this shell");

const email = option("email");
const addressFile = option("address");
if (!email) refuse("--email <canary mailbox> is required");
if (!addressFile) refuse("--address <json file> is required");
const address = JSON.parse(readFileSync(addressFile, "utf8"));

const CHECKOUT_FIELDS = `id totalPrice { gross { amount currency } tax { amount currency } }
	shippingMethods { id name price { amount currency } }`;

const created = await gql(
	`mutation CanaryCheckout($input: CheckoutCreateInput!) {
		checkoutCreate(input: $input) { checkout { ${CHECKOUT_FIELDS} } errors { field code message } }
	}`,
	{
		input: {
			channel,
			languageCode,
			email,
			lines: [{ variantId: variant, quantity: 1 }],
			shippingAddress: address,
			billingAddress: address,
		},
	},
);

if (flag("hidden-negative")) {
	const refused = created.checkoutCreate.errors.length > 0 || !created.checkoutCreate.checkout;
	console.log(
		`hidden variant ${variant} in ${channel}: ${refused ? "REFUSED by Saleor (pass)" : "ACCEPTED (fail)"}`,
	);
	if (created.checkoutCreate.errors.length)
		console.log(`  errors: ${created.checkoutCreate.errors.map((e) => e.code).join(", ")}`);
	if (created.checkoutCreate.checkout)
		console.log(`  checkout ${created.checkoutCreate.checkout.id} — abandoned, not completed`);
	process.exit(refused ? 0 : 1);
}

const checkout = created.checkoutCreate.checkout;
if (!checkout) {
	console.error(`FAIL checkoutCreate: ${JSON.stringify(created.checkoutCreate.errors)}`);
	process.exit(1);
}
console.log(`1. checkout ${checkout.id} (country ${address.country})`);

const cheapest = [...checkout.shippingMethods].sort((a, b) => a.price.amount - b.price.amount)[0];
if (!cheapest) {
	console.error(`FAIL: no shipping method offered in ${channel} for ${address.country}`);
	process.exit(1);
}
const delivered = await gql(
	`mutation CanaryDelivery($id: ID!, $method: ID!) {
		checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $method) {
			checkout { ${CHECKOUT_FIELDS} } errors { field code message }
		}
	}`,
	{ id: checkout.id, method: cheapest.id },
);
const withDelivery = delivered.checkoutDeliveryMethodUpdate.checkout;
if (!withDelivery) {
	console.error(
		`FAIL deliveryMethodUpdate: ${JSON.stringify(delivered.checkoutDeliveryMethodUpdate.errors)}`,
	);
	process.exit(1);
}
console.log(`2. shipping ${cheapest.name}: ${cheapest.price.amount} ${cheapest.price.currency}`);

const total = withDelivery.totalPrice.gross;
console.log(
	`3. total ${total.amount} ${total.currency}, tax ${withDelivery.totalPrice.tax.amount} ${withDelivery.totalPrice.tax.currency}`,
);
if (total.currency !== currency) {
	console.error(`FAIL: checkout in ${total.currency}, channel is ${currency}`);
	process.exit(1);
}

const initialized = await gql(
	`mutation CanaryGatewayInit($id: ID!, $gateways: [PaymentGatewayToInitialize!]) {
		paymentGatewayInitialize(id: $id, paymentGateways: $gateways) {
			gatewayConfigs { id data errors { field code message } }
			errors { field code message }
		}
	}`,
	{ id: checkout.id, gateways: [{ id: STRIPE }] },
);
const result = initialized.paymentGatewayInitialize;
const configs = result.gatewayConfigs ?? [];
const stripe = configs.find((config) => config.id === STRIPE);
const key = stripe?.data?.stripePublishableKey;
const mode =
	typeof key === "string"
		? key.startsWith("pk_live_")
			? "LIVE"
			: key.startsWith("pk_test_")
				? "TEST"
				: "UNKNOWN"
		: "none";
console.log(
	`4. paymentGatewayInitialize: gateways [${configs.map((c) => c.id).join(", ")}], errors ${JSON.stringify(
		result.errors,
	)}`,
);
console.log(
	`   ${STRIPE}: data keys [${Object.keys(stripe?.data ?? {}).join(
		", ",
	)}], publishable key mode ${mode}, errors ${JSON.stringify(stripe?.errors ?? [])}`,
);
console.log("5. STOP — no transaction, no confirmation, no order. The checkout expires on its own.");

const passed =
	Boolean(stripe) && (stripe.errors ?? []).length === 0 && result.errors.length === 0 && mode !== "none";
console.log(
	passed ? `PAYMENT_INIT_TESTED ${channel}: PASS (${mode})` : `PAYMENT_INIT_TESTED ${channel}: FAIL`,
);
process.exit(passed ? 0 : 1);
