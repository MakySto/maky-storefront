import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addConfiguredSetToCart } from "./cart-actions";

/**
 * The interlock, asserted at the only level that matters.
 *
 * A disabled button is not a control. This action is a POST endpoint: anything that can
 * reach the site can invoke it directly, so "demo data cannot be bought" has to be true
 * in the ACTION, not in the UI that usually calls it.
 *
 * The refusal happens before any cookie is read and before any Saleor mutation is
 * prepared, which is why this test needs no request context and no network mock — there
 * is no code path from demo data to a live cart to mock.
 */

const ORIGINAL = process.env.MAKY_FITMENT_PROVIDER;

const DEMO_SET = {
	channel: "sk-eur",
	saleorProductId: "demo-product-aero-flush",
	saleorVariantId: "demo-variant-aero-flush",
};

afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.MAKY_FITMENT_PROVIDER;
	else process.env.MAKY_FITMENT_PROVIDER = ORIGINAL;
});

describe("demo data can never reach a real cart", () => {
	beforeEach(() => {
		process.env.MAKY_FITMENT_PROVIDER = "fixture";
	});

	it("refuses a demo set called directly, outside any UI", async () => {
		expect(await addConfiguredSetToCart(DEMO_SET)).toEqual({ ok: false, reason: "simulation" });
	});

	it("refuses even when handed a real-looking Saleor id", async () => {
		// A caller cannot escape the demo interlock by naming a real product: the mode is
		// decided by the DATASET, never by the request.
		const result = await addConfiguredSetToCart({
			channel: "sk-eur",
			saleorProductId: "UHJvZHVjdDo0MzE=",
			saleorVariantId: "UHJvZHVjdFZhcmlhbnQ6NDMx",
		});
		expect(result).toEqual({ ok: false, reason: "simulation" });
	});
});

describe("with no provider at all", () => {
	beforeEach(() => {
		delete process.env.MAKY_FITMENT_PROVIDER;
	});

	it("refuses rather than falling through to an unverified add", async () => {
		expect(await addConfiguredSetToCart(DEMO_SET)).toEqual({
			ok: false,
			reason: "provider-unavailable",
		});
	});
});

describe("input validation", () => {
	beforeEach(() => {
		process.env.MAKY_FITMENT_PROVIDER = "fixture";
	});

	it.each([
		["no channel", { channel: "", saleorProductId: "p", saleorVariantId: "v" }],
		["no product", { channel: "sk-eur", saleorProductId: "", saleorVariantId: "v" }],
		["no variant", { channel: "sk-eur", saleorProductId: "p", saleorVariantId: "" }],
	])("refuses %s", async (_name, input) => {
		expect(await addConfiguredSetToCart(input)).toEqual({ ok: false, reason: "invalid-input" });
	});
});
