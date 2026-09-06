import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentProductRef } from "./contract";

/**
 * The REAL branch of the offer layer, with Saleor replaced by a recorded answer.
 *
 * `offers.test.ts` proves the demo branch never asks Saleor. This file proves what the
 * real branch does with what Saleor says — and in particular WHERE it reads the
 * availability fact from. CFM publishes `cfm_availability_mode` on the ProductVariant
 * (100/100 variants, 0/100 products in the pre-existing catalogue, measured live); the
 * Nordrive sets published on 2026-09-05 carry it on the product as well. Reading only
 * the product node made every older product resolve to "unknown" and dropped the
 * "Na objednávku" line silently, with a green build and a green suite.
 *
 * Every identity here is synthetic.
 */

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));

import { availabilityFrom, resolveFitmentOffers, verifyPurchasable } from "./offers";

const REF: FitmentProductRef = {
	externalReference: "test:product:set-a",
	saleorProductId: "test-product-set-a",
	saleorVariantId: "test-variant-set-a",
	productKind: "roof-rack-set",
};

type NodeOverrides = {
	productMeta?: string | null;
	variantMeta?: string | null;
	quantityAvailable?: number;
	externalReference?: string;
	variantId?: string;
};

/** One product node shaped like `FitmentProductsByIds` returns it. */
function node(over: NodeOverrides = {}) {
	return {
		id: REF.saleorProductId,
		name: "Test set A",
		slug: "test-set-a",
		externalReference: over.externalReference ?? REF.externalReference,
		isAvailableForPurchase: true,
		metafield: over.productMeta ?? null,
		translation: null,
		thumbnail: null,
		category: null,
		variants: [
			{
				id: over.variantId ?? REF.saleorVariantId,
				name: "V1",
				quantityAvailable: over.quantityAvailable ?? 50,
				metafield: over.variantMeta ?? null,
				pricing: { price: { gross: { amount: 100, currency: "EUR" } } },
			},
		],
	};
}

const answer = (nodes: ReturnType<typeof node>[]) => ({
	ok: true as const,
	data: { products: { totalCount: nodes.length, edges: nodes.map((n) => ({ node: n })) } },
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("availabilityFrom reads the variant first and the product second", () => {
	it("variant only (the pre-existing catalogue)", () => {
		expect(availabilityFrom("sale_to_order", null, 50)).toBe("on-demand");
	});
	it("product only", () => {
		expect(availabilityFrom(null, "sale_to_order", 50)).toBe("on-demand");
	});
	it("both (the Nordrive sets)", () => {
		expect(availabilityFrom("sale_to_order", "sale_to_order", 50)).toBe("on-demand");
	});
	it("neither is honestly unknown, not on-demand", () => {
		expect(availabilityFrom(null, null, 50)).toBe("unknown");
	});
	it("a hard zero outranks the mode", () => {
		expect(availabilityFrom("sale_to_order", "sale_to_order", 0)).toBe("out-of-stock");
	});
	it("an unrecognised mode is not promoted to on-demand", () => {
		expect(availabilityFrom("something_else", null, 50)).toBe("unknown");
	});
});

describe("resolveFitmentOffers on a live-shaped answer", () => {
	it("resolves 'on-demand' when the metafield is on the variant only", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node({ variantMeta: "sale_to_order" })]));

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });

		expect(result.offers).toHaveLength(1);
		expect(result.offers[0]!.availability).toBe("on-demand");
		expect(result.offers[0]!.price).toEqual({ amount: 100, currency: "EUR" });
	});

	it("still resolves 'on-demand' when only the product carries it", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node({ productMeta: "sale_to_order" })]));

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });
		expect(result.offers[0]!.availability).toBe("on-demand");
	});

	it("asks by id, for this channel, never by external reference", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node({ variantMeta: "sale_to_order" })]));

		await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });

		expect(executePublicGraphQL).toHaveBeenCalledTimes(1);
		const [, options] = executePublicGraphQL.mock.calls[0] as [
			unknown,
			{ variables: Record<string, unknown> },
		];
		expect(options.variables).toMatchObject({ ids: [REF.saleorProductId], channel: "sk-eur" });
	});

	it("rejects an identity the catalogue contradicts", async () => {
		executePublicGraphQL.mockResolvedValue(
			answer([node({ externalReference: "test:product:someone-else" })]),
		);

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });
		expect(result.offers).toHaveLength(0);
		expect(result.rejected["identity-mismatch"]).toBe(1);
	});

	it("rejects a product whose variant is not the one the row names", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node({ variantId: "test-variant-other" })]));

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });
		expect(result.offers).toHaveLength(0);
		expect(result.rejected["variant-missing"]).toBe(1);
	});

	it("reports a transport failure as a failed lookup, not as 'nothing fits'", async () => {
		executePublicGraphQL.mockResolvedValue({ ok: false, error: { message: "boom" } });

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });
		expect(result.lookupFailed).toBe(true);
		expect(result.rejected["lookup-failed"]).toBe(1);
		expect(result.offers).toHaveLength(0);
	});
});

describe("verifyPurchasable on a live-shaped answer", () => {
	it("reads availability from the variant", async () => {
		executePublicGraphQL.mockResolvedValue(answer([node({ variantMeta: "sale_to_order" })]));

		await expect(
			verifyPurchasable(REF.saleorProductId, REF.saleorVariantId, "sk-eur", "sk-SK", REF.externalReference),
		).resolves.toEqual({ ok: true, availability: "on-demand", price: { amount: 100, currency: "EUR" } });
	});

	it("does not confirm a product whose identity disagrees", async () => {
		executePublicGraphQL.mockResolvedValue(
			answer([node({ externalReference: "test:product:someone-else" })]),
		);

		await expect(
			verifyPurchasable(REF.saleorProductId, REF.saleorVariantId, "sk-eur", "sk-SK", REF.externalReference),
		).resolves.toEqual({ ok: false, reason: "identity-mismatch" });
	});
});
