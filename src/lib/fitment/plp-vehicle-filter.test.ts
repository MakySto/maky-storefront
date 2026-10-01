import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset, type VehicleSelection } from "./contract";

/**
 * The listing filter, and the three ways it could lie.
 *
 * The failures this file exists to prevent were all measured against live Saleor
 * (api.maky.store, 2026-09-06), and none of them is visible in a green build:
 *
 *   1. `filter: { ids: [] }` returns the ENTIRE catalogue — all 9 606 products — not
 *      nothing. So "no verified products for this car" rendered as "here is the whole
 *      shop, filtered for your car".
 *   2. `first: 100` caps the PAGE, not the filter: 250 ids answer `totalCount: 250` and
 *      page correctly. Truncating candidates to 100 would silently hide sets from
 *      anyone whose car has many.
 *   3. Not knowing is not the same as nothing fitting. A dataset that cannot answer must
 *      leave the listing alone, because an empty listing is a claim.
 *
 * Every identity here is synthetic.
 */

const { loadFitmentDataset, readGarage } = vi.hoisted(() => ({
	loadFitmentDataset: vi.fn(),
	readGarage: vi.fn(),
}));

vi.mock("./provider", () => ({ loadFitmentDataset }));
vi.mock("@/lib/garage/state", () => ({ readGarage }));

import {
	isSaleorProductId,
	isVehicleFilterRequested,
	NO_PRODUCTS_SENTINEL_ID,
	resolveVehicleListingFilter,
	settleVehicleFilter,
	vehicleFilterHref,
	vehicleFilterIds,
	vehicleFilterRequestOf,
	type VehicleListingFilter,
} from "./plp-vehicle-filter";
import { buildFilterVariables } from "@/ui/components/plp/filter-utils";

const SELECTION: VehicleSelection = {
	makeId: "make-1",
	modelId: "model-1",
	generationId: "gen-1",
	year: 2022,
};

/** A real-shaped Saleor product global id, base64 of `Product:<pk>`. */
const gid = (pk: number) => Buffer.from(`Product:${pk}`, "utf8").toString("base64");

function dataset(productIds: string[], overrides: Partial<FitmentDataset> = {}): FitmentDataset {
	return {
		schemaVersion: "2.0.0",
		datasetVersion: "test-1",
		datasetHash: "hash",
		generatedAt: new Date().toISOString(),
		source: { system: "test" },
		saleorInstance: "api.example.test",
		validity: { validUntil: null, staleAfterDays: 3650 },
		coverage: {
			scope: { programId: "test-roof-racks", productKinds: ["roof-rack-set"] },
			completeForMakeIds: [],
		},
		makes: [{ id: "make-1", name: "Make" }],
		models: [{ id: "model-1", makeId: "make-1", name: "Model" }],
		generations: [
			{
				id: "gen-1",
				modelId: "model-1",
				name: "Gen",
				productionYearFrom: 2018,
				productionYearTo: null,
				qualifiers: {},
			},
		],
		applications: productIds.map((id, index) => ({
			applicationId: `a${index}`,
			generationId: "gen-1",
			window: {
				from: { year: 2018 },
				to: null,
				startPrecision: "year",
				endPrecision: "open",
				reconciledToGeneration: false,
			},
			qualifiers: {},
			conditions: [],
			products: [
				{
					externalReference: `test:product:${id}`,
					saleorProductId: id,
					saleorVariantId: `${id}-v`,
					productKind: "roof-rack-set" as const,
					evidence: { kind: "manufacturer-application" as const, supplier: "test" },
					qaStatus: "accepted" as const,
					verification: "cfm-verified" as const,
					eligibility: { sellable: true, reasons: [] },
				},
			],
		})),
		...overrides,
	};
}

function garageWith(selection: VehicleSelection | null) {
	const vehicle = selection && {
		stored: { k: "make-1", m: "model-1", g: "gen-1", y: 2022 },
		selection,
		makeName: "Make",
		modelName: "Model",
		generationName: "Gen",
		unresolved: false,
	};
	return {
		status: vehicle ? "ok" : "absent",
		vehicles: vehicle ? [vehicle] : [],
		activeIndex: 0,
		active: vehicle ?? null,
		repaired: false,
		signed: true,
	};
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe("what narrows the listing, and what must not", () => {
	it("never narrows when the filter was not requested", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(false);
		expect(filter).toMatchObject({ state: "offered", reason: "all" });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("offers the control without applying it, so it is reachable without editing a URL", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(false);
		// The YEAR is part of the label on purpose: this banner claims a result for a
		// car, and "Make Model Gen" is the same string for a 2018 and a 2024 vehicle,
		// which are different generations taking different racks.
		expect(filter).toMatchObject({ state: "offered", vehicleLabel: "Make Model Gen · 2022", reason: "all" });
	});

	it("narrows to every verified id when asked", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1), gid(2)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "active", productIds: [gid(1), gid(2)] });
	});

	it("does not narrow when there is no usable saved car", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(null));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "no-vehicle", requested: true });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("does not narrow when the dataset cannot answer — not knowing is not 'nothing fits'", async () => {
		// Stale: past `validUntil`. resolveVehicleOutcome reports this as unanswerable.
		const stale = dataset([gid(1)], {
			validity: { validUntil: "2020-01-01T00:00:00.000Z", staleAfterDays: 30 },
		});
		loadFitmentDataset.mockResolvedValue({ dataset: stale });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "unanswerable", verdict: "STALE" });
		// The shopper sees the whole listing plus an explanation, never an empty one.
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("survives a provider that throws — a listing sells things", async () => {
		loadFitmentDataset.mockRejectedValue(new Error("provider exploded"));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(await resolveVehicleListingFilter(true)).toEqual({ state: "unavailable" });
		spy.mockRestore();
	});
});

describe("the empty result — the one that returned the whole catalogue", () => {
	it("reports empty rather than an id list", async () => {
		// A dataset with rows for a DIFFERENT generation: answerable, nothing verified.
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "empty" });
	});

	it("asks Saleor for an id that cannot exist, never for an empty list", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const ids = vehicleFilterIds(await resolveVehicleListingFilter(true));
		// Live: `ids: []` answers totalCount 9606. This id answers 0.
		expect(ids).toEqual([NO_PRODUCTS_SENTINEL_ID]);
		expect(buildFilterVariables({ vehicleProductIds: ids })).toEqual({ ids: [NO_PRODUCTS_SENTINEL_ID] });
	});

	it("refuses to turn an empty array into a filter, whoever passes it", () => {
		// Defence in depth: nothing produces `[]`, and if something ever does, the
		// listing must be unfiltered rather than filtered-by-nothing.
		expect(buildFilterVariables({ vehicleProductIds: [] })).toBeUndefined();
	});
});

describe("what must never reach the listing query", () => {
	it("recognises a Saleor product global id, and only that", () => {
		expect(isSaleorProductId(gid(481))).toBe(true);
		// The fixture provider's own ids — deliberately not real, which is what stops a
		// demo dataset borrowing a real product's photograph and price.
		expect(isSaleorProductId("demo-product-aero-flush")).toBe(false);
		expect(isSaleorProductId("")).toBe(false);
		// Base64 of something that is not a product.
		expect(isSaleorProductId(Buffer.from("Category:1", "utf8").toString("base64"))).toBe(false);
		// Decodes to the right shape but is not the canonical encoding.
		expect(isSaleorProductId("UHJvZHVjdDo0ODE")).toBe(false);
	});

	it("drops a malformed id rather than letting Saleor fail the whole listing", async () => {
		// Live: a bad entry in `filter: { ids }` answers "Invalid ID specified." for the
		// WHOLE query, and /{market}/products throws on a failed listing — correctly,
		// since that page cannot be missing. One bad row from CFM would take it down.
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1), "not-an-id"]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		const filter = await resolveVehicleListingFilter(true);
		expect(filter).toMatchObject({ state: "active", productIds: [gid(1)] });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("reports empty when every candidate id is malformed", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(["nope", "also-nope"]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(await resolveVehicleListingFilter(true)).toMatchObject({ state: "empty" });
		spy.mockRestore();
	});

	it("never narrows a listing of real products with a DEMO dataset", async () => {
		// A demo dataset carries its own catalogue and names nothing real, so it cannot
		// verify a real product for anybody. Sending its ids would be sending junk.
		const demo = dataset([gid(1)]);
		demo.demoCatalogue = [
			{
				saleorProductId: gid(1),
				saleorVariantId: `${gid(1)}-v`,
				name: "Demo set",
				price: { amount: 1, currency: "EUR" },
			},
		];
		loadFitmentDataset.mockResolvedValue({ dataset: demo });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(await resolveVehicleListingFilter(true)).toMatchObject({ state: "empty", isDemo: true });
	});
});

describe("the candidate set is never truncated", () => {
	it("passes more than a Saleor page of ids straight through", async () => {
		const many = Array.from({ length: 250 }, (_, i) => gid(i + 1));
		loadFitmentDataset.mockResolvedValue({ dataset: dataset(many) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const ids = vehicleFilterIds(await resolveVehicleListingFilter(true));
		// `first: 100` caps the page; live, 250 ids answer totalCount 250.
		expect(ids).toHaveLength(250);
		expect(buildFilterVariables({ vehicleProductIds: ids })?.ids).toHaveLength(250);
	});

	it("de-duplicates a product verified through several application rows", async () => {
		const d = dataset([gid(1)]);
		d.applications.push({ ...d.applications[0]!, applicationId: "a-dup" });
		loadFitmentDataset.mockResolvedValue({ dataset: d });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect(vehicleFilterIds(await resolveVehicleListingFilter(true))).toEqual([gid(1)]);
	});
});

describe("the URL contract", () => {
	it("only activates on the exact value", () => {
		expect(isVehicleFilterRequested("1")).toBe(true);
		expect(isVehicleFilterRequested(["1", "0"])).toBe(true);
		expect(isVehicleFilterRequested("true")).toBe(false);
		expect(isVehicleFilterRequested(undefined)).toBe(false);
	});

	it("drops the cursor when the filter changes, and keeps the shopper's own choices", () => {
		const params = { sort: "price_asc", price: "50-100", cursor: "abc", direction: "next" };
		expect(vehicleFilterHref("/products", params, true)).toBe(
			"/products?sort=price_asc&price=50-100&vehicle=1",
		);
		// "All vehicles" is an explicit `0`, not the absence of the parameter: on a shelf the
		// absence now means "for my car", and a link that says it turns the car filter off must not
		// leave it on.
		expect(vehicleFilterHref("/products", { ...params, vehicle: "1" }, false)).toBe(
			"/products?sort=price_asc&price=50-100&vehicle=0",
		);
	});

	it("says all vehicles explicitly even when nothing else is set", () => {
		expect(vehicleFilterHref("/categories/boxy", { vehicle: "1" }, false)).toBe("/categories/boxy?vehicle=0");
	});

	it("keeps the maker when the car or the mode changes", () => {
		// Changing the car on the Thule shelf must not drop the maker the shopper narrowed to.
		const params = { brand: "thule", sort: "price_asc", vehicle: "0", cursor: "x" };
		expect(vehicleFilterHref("/stresne-nosice", params, true)).toBe(
			"/stresne-nosice?brand=thule&sort=price_asc&vehicle=1",
		);
	});

	it("tells the three requests apart", () => {
		expect(vehicleFilterRequestOf("1")).toBe("vehicle");
		expect(vehicleFilterRequestOf("0")).toBe("all");
		expect(vehicleFilterRequestOf(["0", "1"])).toBe("all");
		expect(vehicleFilterRequestOf(undefined)).toBe("default");
		// Anything else is not a request at all — a typo must not read as "off".
		expect(vehicleFilterRequestOf("true")).toBe("default");
		expect(vehicleFilterRequestOf("")).toBe("default");
	});
});

/**
 * The opening of the Thule shelf (2026-10-01): ~9 150 vehicle-specific sets land on one listing,
 * and for a shopper with a saved car an alphabetical list of them is of no use.
 *
 * The rules, each one a way the default could lie:
 *
 *   - on a SHELF with a saved car the car's own list is what the shopper sees, unasked;
 *   - `?vehicle=0` is the shopper's word and nothing overrides it;
 *   - a default that would end in nothing (no verified set, or an answer we cannot give) leaves
 *     the shelf whole and says why — an empty page the shopper never asked for is a dead end;
 *   - the SAME answer to an explicit `?vehicle=1` keeps its own panel;
 *   - `/products` and collections never narrow by default.
 */
describe("narrowing by default, on a roof-rack shelf", () => {
	const SHELF = { categorySlug: "stresne-nosice" };

	it("shows the car's own list when nobody said otherwise", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1), gid(2)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter("default", SHELF);
		expect(filter).toMatchObject({ state: "active", productIds: [gid(1), gid(2)] });
		expect(vehicleFilterIds(filter)).toEqual([gid(1), gid(2)]);
	});

	it("never overrides the shopper's explicit all-vehicles choice", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter("all", SHELF);
		expect(filter).toMatchObject({ state: "offered", reason: "all" });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("narrows the Thule and Nordrive shelves as it narrows the main one", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		for (const categorySlug of ["thule-stresne-nosice", "nordrive-stresne-nosice"]) {
			expect(await resolveVehicleListingFilter("default", { categorySlug })).toMatchObject({
				state: "active",
				productIds: [gid(1)],
			});
		}
	});

	it("leaves the accessory and spare-part buckets alone", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		// A set's id never names a product in these, so narrowing them to roof-rack ids would empty
		// them under a claim nobody earned.
		for (const categorySlug of ["prislusenstvo-k-stresnym-boxom", "nahradne-diely-k-nosicom-bicyklov"]) {
			expect((await resolveVehicleListingFilter("default", { categorySlug })).state).toBe("out-of-scope");
		}
	});

	it("keeps the shelf whole when the car has no verified set — no dead end nobody asked for", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter("default", SHELF);
		expect(filter).toMatchObject({ state: "offered", reason: "none-fit" });
		expect(vehicleFilterIds(filter)).toBeUndefined();

		// The same answer to an EXPLICIT request is the panel, as it always was.
		expect(await resolveVehicleListingFilter("vehicle", SHELF)).toMatchObject({ state: "empty" });
	});

	it("keeps the shelf whole when the dataset cannot answer, and says so", async () => {
		const stale = dataset([gid(1)], {
			validity: { validUntil: "2020-01-01T00:00:00.000Z", staleAfterDays: 30 },
		});
		loadFitmentDataset.mockResolvedValue({ dataset: stale });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter("default", SHELF);
		expect(filter).toMatchObject({ state: "unanswerable", verdict: "STALE" });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("asks for a car when there is none, narrowing nothing", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(null));

		const filter = await resolveVehicleListingFilter("default", SHELF);
		expect(filter).toMatchObject({ state: "no-vehicle", requested: false });
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("never narrows /products or a collection by default", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		// No scope: the whole catalogue, where narrowing is true — but only when asked.
		expect(await resolveVehicleListingFilter("default", {})).toMatchObject({
			state: "offered",
			reason: "all",
		});
		expect(await resolveVehicleListingFilter("vehicle", {})).toMatchObject({ state: "active" });
	});

	it("still treats the old boolean the way it always did", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect((await resolveVehicleListingFilter(true, SHELF)).state).toBe("active");
		// `false` is "not asked" — which on a shelf is the default, now, and narrows.
		expect((await resolveVehicleListingFilter(false, SHELF)).state).toBe("active");
	});
});

/**
 * Only the catalogue knows whether a verified set is on sale.
 *
 * After the dataset switch and before the activation the 9 140 new sets are verified in the
 * dataset and hidden in Saleor: the id list is full and the listing query returns nothing. That
 * is neither "nothing fits" nor "show everything".
 */
describe("when every verified set is hidden in the shop", () => {
	const active: VehicleListingFilter = {
		state: "active",
		vehicleLabel: "Make Model Gen · 2022",
		productIds: [gid(1)],
		isDemo: false,
	};

	it("says the sets are not on sale, instead of drawing an empty grid under 'overené pre …'", () => {
		expect(settleVehicleFilter(active, { totalCount: 0 }, {})).toEqual({
			state: "not-on-sale",
			vehicleLabel: "Make Model Gen · 2022",
			isDemo: false,
		});
	});

	it("leaves a listing that returned something alone", () => {
		expect(settleVehicleFilter(active, { totalCount: 3 }, {})).toBe(active);
	});

	it("does not blame the shop when a price band or a maker may have emptied the list", () => {
		for (const params of [{ price: "50-100" }, { brand: "thule" }, { volume: "300-400" }]) {
			expect(settleVehicleFilter(active, { totalCount: 0 }, params)).toBe(active);
		}
		// A blank parameter is not a filter.
		expect(settleVehicleFilter(active, { totalCount: 0 }, { price: "" }).state).toBe("not-on-sale");
	});

	it("only ever settles an active filter", () => {
		const offered: VehicleListingFilter = { state: "offered", vehicleLabel: null, reason: "all" };
		expect(settleVehicleFilter(offered, { totalCount: 0 }, {})).toBe(offered);
		const empty: VehicleListingFilter = { state: "empty", vehicleLabel: null, isDemo: false };
		expect(settleVehicleFilter(empty, { totalCount: 0 }, {})).toBe(empty);
	});

	it("does not pass the new state to Saleor as a filter", () => {
		const settled = settleVehicleFilter(active, { totalCount: 0 }, {});
		expect(vehicleFilterIds(settled)).toBeUndefined();
	});
});

/**
 * The scope defect, reproduced on production 2026-09-07 before a line was changed.
 *
 * With a saved ŠKODA Octavia Combi NX (2024), `?vehicle=1` emptied FIVE listings that
 * the fitment programme has never assessed, and headed each one with a claim:
 *
 *   /sk/stresne-boxy?vehicle=1      101 → 0   "Zobrazujeme iba produkty overené pre …"
 *   /sk/nosice-bicyklov?vehicle=1   188 → 0   "Zobrazujeme iba produkty overené pre …"
 *   /sk/nosice-lyzi?vehicle=1        26 → 0   "Zobrazujeme iba produkty overené pre …"
 *   /sk/stresne-stany?vehicle=1       9 → 0   "Zobrazujeme iba produkty overené pre …"
 *   /sk/autochladnicky?vehicle=1      7 → 0   "Zobrazujeme iba produkty overené pre …"
 *
 * The control narrowed correctly: /sk/stresne-nosice 9 163 → 9.
 *
 * The cause is that the filter resolves `CONFIGURATOR_PRODUCT_KIND` — `roof-rack-set` —
 * whatever listing it runs on, so a roof box listing was intersected with a set of roof
 * RACK ids. The intersection is empty by construction, and because the ids themselves
 * are non-empty the state is `active`, not `empty`: the shopper gets the confident
 * headline with NO "this does not mean nothing fits" line under it. Measured — the
 * explainer was absent on all five pages.
 *
 * A car fridge is the clearest case. It does not touch the roof, so there is no sense in
 * which it could be "verified for" a car, and no sense in which its absence is news.
 *
 * The rule these tests fix: the programme covers ONE product kind, so a listing whose
 * kind it does not cover must not be narrowed and must not be described as verified.
 */
describe("the listing's own scope — a filter must not answer for a category it never assessed", () => {
	it("does not narrow a category the programme does not cover", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1), gid(2)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true, { categorySlug: "stresne-boxy" });

		// Not `active`: those ids are roof racks and would empty this listing.
		expect(filter.state).toBe("out-of-scope");
		// Not `empty` either — that state still claims the listing was narrowed.
		expect(vehicleFilterIds(filter)).toBeUndefined();
	});

	it("still narrows the category the programme does cover", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1), gid(2)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		const filter = await resolveVehicleListingFilter(true, { categorySlug: "stresne-nosice" });
		expect(filter).toMatchObject({ state: "active", productIds: [gid(1), gid(2)] });
	});

	it("does not even offer the control on a category it cannot answer for", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		// An offer to "show only what is verified for your car" that can only lead to an
		// empty listing is the invitation to the dead end, not a feature.
		const filter = await resolveVehicleListingFilter(false, { categorySlug: "autochladnicky" });
		expect(filter.state).toBe("out-of-scope");
	});

	it("leaves an unscoped listing alone — the whole catalogue does hold roof racks", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: dataset([gid(1)]) });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		// `/{market}/products` lists everything, so verified sets really are in it and
		// the claim is true there. No scope means no reason to withhold.
		const filter = await resolveVehicleListingFilter(true, {});
		expect(filter).toMatchObject({ state: "active", productIds: [gid(1)] });
	});

	it("honours the dataset's declared coverage, not a hardcoded kind", async () => {
		// A dataset that covers roof BOXES instead. Nothing about the storefront changed,
		// so the roof rack listing must now be the one left alone.
		const boxes = dataset([gid(1)], {
			coverage: {
				scope: { programId: "test-boxes", productKinds: ["roof-box"] },
				completeForMakeIds: [],
			},
		});
		loadFitmentDataset.mockResolvedValue({ dataset: boxes });
		readGarage.mockResolvedValue(garageWith(SELECTION));

		expect((await resolveVehicleListingFilter(true, { categorySlug: "stresne-nosice" })).state).toBe(
			"out-of-scope",
		);
	});
});
