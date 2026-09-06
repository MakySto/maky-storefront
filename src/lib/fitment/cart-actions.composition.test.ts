import { beforeEach, describe, expect, it, vi } from "vitest";

import { type FitmentDataset, type FitmentProductRef, type VehicleSelection } from "./contract";

/**
 * The real branch of the add action, with every collaborator replaced.
 *
 * `cart-actions.test.ts` proves the interlocks that stop BEFORE the cart is touched. This
 * file proves what happens after them: that the action hands exactly one unit of exactly
 * the verified variant to the shared cart action, and that it reports the shared action's
 * three answers as three answers — above all that "we do not know" survives the
 * translation and is not turned into either a success or a refusal.
 *
 * Every identity below is synthetic. Nothing here names a real product, and the dataset
 * is a test harness rather than fitment data: it exists to drive the code path, not to
 * state that anything fits anything.
 */

const { loadFitmentDataset, readActiveSelection, verifyPurchasable, addVariantToCart } = vi.hoisted(() => ({
	loadFitmentDataset: vi.fn(),
	readActiveSelection: vi.fn(),
	verifyPurchasable: vi.fn(),
	addVariantToCart: vi.fn(),
}));

vi.mock("./provider", () => ({ loadFitmentDataset }));
vi.mock("@/lib/garage/state", () => ({ readActiveSelection }));
vi.mock("./offers", async (importOriginal) => ({
	...(await importOriginal<typeof import("./offers")>()),
	verifyPurchasable,
}));
vi.mock("@/ui/components/plp/actions", () => ({ addVariantToCart }));

import { addConfiguredSetToCart } from "./cart-actions";

const SET: FitmentProductRef = {
	externalReference: "test:product:set-a",
	saleorProductId: "test-product-set-a",
	saleorVariantId: "test-variant-set-a",
	productKind: "roof-rack-set",
};

const PROVISIONAL_SET: FitmentProductRef = {
	externalReference: "test:product:set-b",
	saleorProductId: "test-product-set-b",
	saleorVariantId: "test-variant-set-b",
	productKind: "roof-rack-set",
};

/** Verified for the vehicle, but not a roof-rack set. The offer list would never show it. */
const VERIFIED_BOX: FitmentProductRef = {
	externalReference: "test:product:box-c",
	saleorProductId: "test-product-box-c",
	saleorVariantId: "test-variant-box-c",
	productKind: "roof-box",
};

const VEHICLE: VehicleSelection = { makeId: "make-1", modelId: "model-1", generationId: "gen-1", year: 2020 };

/** Non-demo: no `demoCatalogue`. Not stale: a very long `staleAfterDays`. */
const DATASET: FitmentDataset = {
	schemaVersion: "2.0.0",
	datasetVersion: "test-harness",
	datasetHash: "test-harness",
	generatedAt: "2026-01-01T00:00:00.000Z",
	source: { system: "test-harness" },
	saleorInstance: "saleor.example.invalid",
	validity: { validUntil: null, staleAfterDays: 36_500 },
	coverage: { scope: { programId: "test-program", productKinds: ["roof-rack-set"] }, completeForMakeIds: [] },
	makes: [{ id: "make-1", name: "Make" }],
	models: [{ id: "model-1", makeId: "make-1", name: "Model" }],
	generations: [
		{
			id: "gen-1",
			modelId: "model-1",
			name: "I",
			productionYearFrom: 2015,
			productionYearTo: null,
			qualifiers: {},
		},
	],
	applications: [
		{
			applicationId: "app-verified",
			generationId: "gen-1",
			yearFrom: 2015,
			yearTo: null,
			qualifiers: {},
			conditions: [],
			verificationStatus: "verified",
			products: [SET, VERIFIED_BOX],
		},
		{
			applicationId: "app-provisional",
			generationId: "gen-1",
			yearFrom: 2015,
			yearTo: null,
			qualifiers: {},
			conditions: [],
			verificationStatus: "provisional",
			products: [PROVISIONAL_SET],
		},
	],
};

const input = (ref: FitmentProductRef, variantId = ref.saleorVariantId) => ({
	channel: "sk-eur",
	saleorProductId: ref.saleorProductId,
	saleorVariantId: variantId,
});

const purchasable = {
	ok: true as const,
	availability: "on-demand" as const,
	price: { amount: 1, currency: "EUR" },
};

beforeEach(() => {
	vi.clearAllMocks();
	loadFitmentDataset.mockResolvedValue({ dataset: DATASET, status: {} });
	readActiveSelection.mockResolvedValue(VEHICLE);
	verifyPurchasable.mockResolvedValue(purchasable);
	addVariantToCart.mockResolvedValue({ status: "added" });
});

describe("the hand-off to the shared cart action", () => {
	it("adds exactly one unit of exactly the verified variant, in this channel", async () => {
		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({ ok: true });

		expect(addVariantToCart).toHaveBeenCalledTimes(1);
		expect(addVariantToCart).toHaveBeenCalledWith({
			channel: "sk-eur",
			variantId: SET.saleorVariantId,
			quantity: 1,
		});
	});

	it("verifies purchasability against the fitment row's identity, not the request's", async () => {
		await addConfiguredSetToCart(input(SET));

		expect(verifyPurchasable).toHaveBeenCalledWith(
			SET.saleorProductId,
			SET.saleorVariantId,
			"sk-eur",
			expect.any(String),
			SET.externalReference,
		);
	});

	it("reports an unconfirmed add as 'check your cart' — not success, not refusal", async () => {
		addVariantToCart.mockResolvedValue({ status: "unconfirmed", message: "response lost" });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "lookup-failed",
		});
		// And it was sent exactly once. A retry here is how one click becomes two lines.
		expect(addVariantToCart).toHaveBeenCalledTimes(1);
	});

	it("reports Saleor's 'unavailable' as the set not being on offer", async () => {
		addVariantToCart.mockResolvedValue({ status: "rejected", reason: "unavailable", message: "sold out" });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-available",
		});
	});

	it("reports any other refusal as the cart declining", async () => {
		addVariantToCart.mockResolvedValue({ status: "rejected", reason: "checkout", message: "no checkout" });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "cart-rejected",
		});
	});
});

describe("nothing reaches the cart unless every gate passes", () => {
	it("refuses when there is no active vehicle", async () => {
		readActiveSelection.mockResolvedValue(null);

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "vehicle-changed",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("refuses a set whose only row is provisional", async () => {
		await expect(addConfiguredSetToCart(input(PROVISIONAL_SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("refuses a variant the verified row does not name, even for a verified product", async () => {
		await expect(addConfiguredSetToCart(input(SET, "test-variant-other"))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("refuses a verified product of the wrong kind, even when called directly", async () => {
		await expect(addConfiguredSetToCart(input(VERIFIED_BOX))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("refuses a product the dataset has no row for", async () => {
		await expect(
			addConfiguredSetToCart({
				channel: "sk-eur",
				saleorProductId: "test-product-unknown",
				saleorVariantId: "v",
			}),
		).resolves.toEqual({ ok: false, reason: "not-verified" });
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it.each([
		["not-published", "not-available"],
		["variant-missing", "not-available"],
		["identity-mismatch", "not-available"],
		// Nothing was sent, so this is NOT "check your cart" — it is "try again".
		["lookup-failed", "catalogue-unavailable"],
	] as const)("stops when the catalogue check says %s", async (catalogueReason, expected) => {
		verifyPurchasable.mockResolvedValue({ ok: false, reason: catalogueReason });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({ ok: false, reason: expected });
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("stops on a hard stock-out before sending anything", async () => {
		verifyPurchasable.mockResolvedValue({ ...purchasable, availability: "out-of-stock" });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({ ok: false, reason: "out-of-stock" });
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("refuses when the provider has no dataset", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: null, status: {} });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "provider-unavailable",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});
});

/**
 * The verdicts that are not VERIFIED_FIT.
 *
 * Only one of the eight lets a set into the cart, and the interesting property is that
 * the other seven are refused for two DIFFERENT reasons: a provider that could not answer
 * is `provider-unavailable` ("try again"), while a dataset that answered something short
 * of a verified fit is `not-verified` ("we cannot confirm this one"). A shopper told to
 * try again when the answer will never change is being sent in a circle; a shopper told
 * "we cannot confirm this" during a five-second outage is being told something false.
 *
 * Each case below reaches its verdict through the real resolver, from a dataset shaped to
 * produce it — not by stubbing a verdict, which would prove only that the mapping table
 * is internally consistent with itself.
 */
describe("every verdict that is not a verified fit", () => {
	it("STALE — an expired dataset may not authorise a purchase", async () => {
		loadFitmentDataset.mockResolvedValue({
			dataset: {
				...DATASET,
				// Generated long ago, and `staleAfterDays` has run out. The rows still
				// say "verified"; the dataset is no longer entitled to say so.
				generatedAt: "2020-01-01T00:00:00.000Z",
				validity: { validUntil: null, staleAfterDays: 30 },
			},
			status: {},
		});

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("STALE by an explicit expiry date, not only by age", async () => {
		loadFitmentDataset.mockResolvedValue({
			dataset: {
				...DATASET,
				validity: { validUntil: "2020-01-01T00:00:00.000Z", staleAfterDays: 36_500 },
			},
			status: {},
		});

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
	});

	it("AMBIGUOUS — a source that both affirms and denies has not been resolved upstream", async () => {
		loadFitmentDataset.mockResolvedValue({
			dataset: {
				...DATASET,
				applications: [
					...DATASET.applications,
					{
						applicationId: "app-negative",
						generationId: "gen-1",
						yearFrom: 2015,
						yearTo: null,
						qualifiers: {},
						conditions: [],
						verificationStatus: "verified" as const,
						negative: true,
						products: [SET],
					},
				],
			},
			status: {},
		});

		// Picking the affirming half would be presenting a coin flip as a fact.
		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("NO_FIT — an explicit negative row stops the sale", async () => {
		loadFitmentDataset.mockResolvedValue({
			dataset: {
				...DATASET,
				applications: [
					{
						applicationId: "app-negative-only",
						generationId: "gen-1",
						yearFrom: 2015,
						yearTo: null,
						qualifiers: {},
						conditions: [],
						verificationStatus: "verified" as const,
						negative: true,
						products: [SET],
					},
				],
			},
			status: {},
		});

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
		expect(addVariantToCart).not.toHaveBeenCalled();
	});

	it("UNKNOWN from an absent row under partial coverage is a refusal, never a NO_FIT claim", async () => {
		// The dataset simply says nothing about this vehicle's year.
		loadFitmentDataset.mockResolvedValue({
			dataset: {
				...DATASET,
				applications: DATASET.applications.map((a) => ({ ...a, yearFrom: 2030, yearTo: null })),
			},
			status: {},
		});

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "not-verified",
		});
	});

	it("PROVIDER_UNAVAILABLE is 'try again', and is the ONLY verdict that is", async () => {
		loadFitmentDataset.mockResolvedValue({ dataset: null, status: {} });

		await expect(addConfiguredSetToCart(input(SET))).resolves.toEqual({
			ok: false,
			reason: "provider-unavailable",
		});
	});
});
