import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentProductsByIdsQuery } from "@/gql/graphql";
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
 * It also proves the localization boundary. `resolveExactLocaleProduct` REFUSES a
 * product without a complete translation rather than falling back to the Slovak row, so
 * a foreign market either gets the product in its own language or does not get it — and
 * the query has to project every field that judgement reads. A fixture that only carried
 * `translation { name }`, as this query once did, would have let a boundary that drops
 * every foreign offer look perfectly healthy.
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

/**
 * Bound to the generated query type, so a change to the projection breaks this file
 * instead of quietly making the fixture describe a shape Saleor no longer returns —
 * which is exactly how the `translation { name }`-only query survived review.
 */
type ProductNode = NonNullable<FitmentProductsByIdsQuery["products"]>["edges"][number]["node"];
type ProductTranslation = ProductNode["translation"];

type NodeOverrides = {
	productMeta?: string | null;
	variantMeta?: string | null;
	quantityAvailable?: number;
	externalReference?: string;
	variantId?: string;
	id?: string;
	translation?: ProductTranslation;
	attributes?: ProductNode["attributes"];
};

/** A translation complete enough for `resolveExactLocaleProduct` to accept. */
const FULL_TRANSLATION: ProductTranslation = {
	name: "Testsatz A",
	slug: "testsatz-a",
	description: "Beschreibung",
	seoTitle: "SEO",
	seoDescription: "SEO-Beschreibung",
};

/** One product node shaped like `FitmentProductsByIds` returns it. */
function node(over: NodeOverrides = {}): ProductNode {
	return {
		id: over.id ?? REF.saleorProductId,
		name: "Test set A",
		slug: "test-set-a",
		externalReference: over.externalReference ?? REF.externalReference,
		isAvailableForPurchase: true,
		metafield: over.productMeta ?? null,
		translation: over.translation ?? null,
		attributes: over.attributes ?? [],
		thumbnail: null,
		category: null,
		variants: [
			{
				id: over.variantId ?? REF.saleorVariantId,
				name: "V1",
				quantityAvailable: over.quantityAvailable ?? 50,
				metafield: over.variantMeta ?? null,
				pricing: { price: { gross: { amount: 100, currency: "EUR" } } },
				selectionAttributes: [],
			},
		],
	};
}

const answer = (nodes: ProductNode[]) => ({
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

describe("localization at the data boundary — A refuses, it does not fall back", () => {
	const DE_REF: FitmentProductRef = { ...REF };

	it("offers a foreign market a NON-EMPTY list, in its own language", async () => {
		// The case the empty-DE-channel check could never see: a real product, really
		// translated. The offer must carry the German name and the German slug.
		executePublicGraphQL.mockResolvedValue(
			answer([node({ variantMeta: "sale_to_order", translation: FULL_TRANSLATION })]),
		);

		const result = await resolveFitmentOffers([DE_REF], "de-eur", "de-DE", { dataset: null });

		expect(result.offers).toHaveLength(1);
		expect(result.offers[0]!.name).toBe("Testsatz A");
		expect(result.offers[0]!.slug).toBe("testsatz-a");
		expect(result.rejected["not-localized"]).toBe(0);
	});

	it("drops a product whose translation is missing the description", async () => {
		executePublicGraphQL.mockResolvedValue(
			answer([node({ translation: { ...FULL_TRANSLATION, description: null } })]),
		);

		const result = await resolveFitmentOffers([DE_REF], "de-eur", "de-DE", { dataset: null });

		expect(result.offers).toHaveLength(0);
		expect(result.rejected["not-localized"]).toBe(1);
		// Not "does not fit" and not "not published". It is sold here and it fits.
		expect(result.rejected["not-published"]).toBe(0);
		expect(result.compatibleCount).toBe(1);
	});

	it("drops a product whose translation is missing the SEO description", async () => {
		executePublicGraphQL.mockResolvedValue(
			answer([node({ translation: { ...FULL_TRANSLATION, seoDescription: "  " } })]),
		);

		const result = await resolveFitmentOffers([DE_REF], "de-eur", "de-DE", { dataset: null });
		expect(result.rejected["not-localized"]).toBe(1);
	});

	it("drops a product whose ATTRIBUTE translation is incomplete", async () => {
		// A translated heading over a Slovak specification table is the failure this
		// half of the policy exists to prevent — and it is only reachable because the
		// query now projects attributes at all.
		executePublicGraphQL.mockResolvedValue(
			answer([
				node({
					translation: FULL_TRANSLATION,
					attributes: [
						{
							attribute: {
								name: "Nosnosť",
								slug: "load",
								externalReference: null,
								unit: null,
								translation: null,
							},
							values: [{ name: "75 kg", translation: null }],
						},
					],
				}),
			]),
		);

		const result = await resolveFitmentOffers([DE_REF], "de-eur", "de-DE", { dataset: null });
		expect(result.offers).toHaveLength(0);
		expect(result.rejected["not-localized"]).toBe(1);
	});

	it("keeps the same product on the source locale, where the base row IS the content", async () => {
		// translation(SK).name is null across the Nordrive sets (measured live). Slovak
		// is the source locale, so that is correct and must not be treated as a gap.
		executePublicGraphQL.mockResolvedValue(answer([node({ translation: null })]));

		const result = await resolveFitmentOffers([REF], "sk-eur", "sk-SK", { dataset: null });
		expect(result.offers).toHaveLength(1);
		expect(result.offers[0]!.name).toBe("Test set A");
		expect(result.rejected["not-localized"]).toBe(0);
	});
});

describe("batching — more candidates than one Saleor page", () => {
	const refs: FitmentProductRef[] = Array.from({ length: 250 }, (_, i) => ({
		externalReference: `test:product:set-${i}`,
		saleorProductId: `test-product-set-${i}`,
		saleorVariantId: `test-variant-set-${i}`,
		productKind: "roof-rack-set",
	}));

	const nodeFor = (ref: FitmentProductRef) =>
		node({
			id: ref.saleorProductId,
			externalReference: ref.externalReference,
			variantId: ref.saleorVariantId,
			variantMeta: "sale_to_order",
		});

	it("asks in pages of 100 and offers every one of them", async () => {
		executePublicGraphQL.mockImplementation((_doc: unknown, options: { variables: { ids: string[] } }) =>
			Promise.resolve(
				answer(options.variables.ids.map((id) => nodeFor(refs.find((r) => r.saleorProductId === id)!))),
			),
		);

		const result = await resolveFitmentOffers(refs, "sk-eur", "sk-SK", { dataset: null });

		expect(executePublicGraphQL).toHaveBeenCalledTimes(3); // 100 + 100 + 50
		expect(result.offers).toHaveLength(250);
		expect(result.purchasableCount).toBe(250);
		// Fitment order, not batch-arrival order.
		expect(result.offers.map((o) => o.saleorProductId)).toEqual(refs.map((r) => r.saleorProductId));
	});

	it("a partial result never looks complete when one batch fails", async () => {
		let call = 0;
		executePublicGraphQL.mockImplementation((_doc: unknown, options: { variables: { ids: string[] } }) => {
			call += 1;
			if (call === 2) return Promise.resolve({ ok: false, error: { message: "boom" } });
			return Promise.resolve(
				answer(options.variables.ids.map((id) => nodeFor(refs.find((r) => r.saleorProductId === id)!))),
			);
		});

		const result = await resolveFitmentOffers(refs, "sk-eur", "sk-SK", { dataset: null });

		expect(result.lookupFailed).toBe(true);
		expect(result.rejected["lookup-failed"]).toBe(100);
		expect(result.offers).toHaveLength(150);
		// The count of what FITS is unchanged by a transport failure; only the count of
		// what we could offer moved. Collapsing the two would report a Saleor outage as
		// "fewer sets fit your car".
		expect(result.compatibleCount).toBe(250);
		expect(result.purchasableCount).toBe(150);
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
