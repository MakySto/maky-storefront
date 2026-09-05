import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadFitmentDataset } from "./provider";
import { isDemoDataset, resolveFitmentOffers } from "./offers";
import { resolveVehicleOutcome } from "./resolve";
import { type VehicleSelection } from "./contract";

/**
 * The offer layer is where a compatibility answer becomes a thing with a price and a buy
 * button, so it is where an untrue claim costs the most.
 *
 * The demo tests matter more than they look. In v1 a demo dataset named REAL Saleor
 * product ids, so the storefront fetched a real roof box and rendered it with its real
 * photograph and price under an invented "complete roof rack set" badge. These assert
 * that a demo dataset is now served entirely from its own catalogue and can never reach
 * the live API at all — which is why none of these tests needs a network mock.
 */

const ORIGINAL = process.env.MAKY_FITMENT_PROVIDER;

const OCTAVIA: VehicleSelection = {
	makeId: "skoda",
	modelId: "skoda-octavia",
	generationId: "skoda-octavia-4",
	year: 2022,
	roofType: "flush-rails",
	bodyType: "estate",
};

beforeEach(() => {
	process.env.MAKY_FITMENT_PROVIDER = "fixture";
});
afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.MAKY_FITMENT_PROVIDER;
	else process.env.MAKY_FITMENT_PROVIDER = ORIGINAL;
});

async function demoOffersFor(selection: VehicleSelection) {
	const { dataset } = await loadFitmentDataset();
	const outcome = resolveVehicleOutcome(dataset, selection);
	const offers = await resolveFitmentOffers(
		outcome.verified.map((o) => o.ref),
		"sk-eur",
		"sk-SK",
		{ dataset },
	);
	return { dataset, outcome, offers };
}

describe("a demo dataset is self-contained", () => {
	it("is recognised as demo", async () => {
		const { dataset } = await loadFitmentDataset();
		expect(isDemoDataset(dataset)).toBe(true);
	});

	it("uses synthetic ids that cannot name a real product", async () => {
		const { dataset } = await loadFitmentDataset();
		const ids = dataset!.applications.flatMap((a) => a.products.map((p) => p.saleorProductId));
		expect(ids.every((id) => id.startsWith("demo-"))).toBe(true);
	});

	it("marks every offer as demo, so no surface can present one as a real one", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		expect(offers.isDemo).toBe(true);
		expect(offers.offers.every((o) => o.isDemo)).toBe(true);
	});

	it("names its own instance, not the live one", async () => {
		const { dataset } = await loadFitmentDataset();
		expect(dataset!.saleorInstance).not.toBe("api.maky.store");
	});
});

describe("what reaches the offer list", () => {
	it("offers only verified sets", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		const ids = offers.offers.map((o) => o.saleorProductId);
		expect(ids).toContain("demo-product-aero-flush");
		expect(ids).toContain("demo-product-square-flush");
	});

	it("excludes a roof box even though a verified row points at it", async () => {
		// Excluded at the RESOLVER stage — it never becomes a candidate at all.
		const { outcome, offers } = await demoOffersFor(OCTAVIA);
		expect(outcome.verified.map((o) => o.ref.saleorProductId)).not.toContain("demo-product-box");
		expect(offers.offers.map((o) => o.saleorProductId)).not.toContain("demo-product-box");
	});

	it("rejects a roof box at the offer layer too, if one is handed to it directly", async () => {
		// Defence in depth: kind filtering is not only a property of how the candidate
		// list happens to be built, so a future caller cannot route around it.
		const { dataset } = await loadFitmentDataset();
		const box = dataset!.applications.flatMap((a) => a.products).find((p) => p.productKind === "roof-box")!;
		const offers = await resolveFitmentOffers([box], "sk-eur", "sk-SK", { dataset });
		expect(offers.offers).toEqual([]);
		expect(offers.rejected["wrong-kind"]).toBe(1);
	});

	it("excludes a year-hold set", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		expect(offers.offers.map((o) => o.saleorProductId)).not.toContain("demo-product-fixpoint");
	});

	it("excludes a set with an explicit negative row for this selection", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		expect(offers.offers.map((o) => o.saleorProductId)).not.toContain("demo-product-raised");
	});

	it("still offers the sets that DO fit alongside one that does not", async () => {
		// The whole point of per-identity resolution.
		const { offers } = await demoOffersFor(OCTAVIA);
		expect(offers.offers.length).toBeGreaterThan(0);
	});

	it("every offer carries the configurator's product kind", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		expect(offers.offers.every((o) => o.productKind === "roof-rack-set")).toBe(true);
	});
});

describe("verified but not on sale", () => {
	it("counts a verified set with no catalogue entry as not-published, not as no-fit", async () => {
		const bmw: VehicleSelection = {
			makeId: "bmw",
			modelId: "bmw-3",
			generationId: "bmw-3-g20",
			year: 2021,
			roofType: "flush-rails",
			bodyType: "estate",
		};
		const { outcome, offers } = await demoOffersFor(bmw);
		expect(outcome.verified).toHaveLength(1);
		expect(offers.purchasableCount).toBe(0);
		expect(offers.compatibleCount).toBe(1);
		expect(offers.rejected["not-published"]).toBe(1);
	});
});

describe("availability", () => {
	it("reports a hard zero as out of stock and everything else as on-demand", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		const outOfStock = offers.offers.find((o) => o.saleorProductId === "demo-product-outofstock");
		expect(outOfStock?.availability).toBe("out-of-stock");
		const normal = offers.offers.find((o) => o.saleorProductId === "demo-product-aero-flush");
		// Sale-to-order, not a stock claim — quantityAvailable is a synthetic cap.
		expect(normal?.availability).toBe("on-demand");
	});

	it("gives each offer the price of its own variant", async () => {
		const { offers } = await demoOffersFor(OCTAVIA);
		const amounts = offers.offers.map((o) => o.price?.amount);
		expect(new Set(amounts).size).toBe(amounts.length);
	});
});

describe("nothing to offer", () => {
	it("returns an empty, non-failing result for no refs", async () => {
		const { dataset } = await loadFitmentDataset();
		const offers = await resolveFitmentOffers([], "sk-eur", "sk-SK", { dataset });
		expect(offers.offers).toEqual([]);
		expect(offers.lookupFailed).toBe(false);
	});
});
