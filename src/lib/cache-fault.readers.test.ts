import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every cached reader hands a fault out of its `"use cache"` function as a VALUE kept for
 * seconds, and the exported reader throws it again on the caller's side (`@/lib/cache-fault`).
 *
 * Under vitest `"use cache"` is inert, so what is pinned here is the contract the pages depend on
 * and the lifetime the entry asks for: with the upstream down every reader still throws (or
 * resolves, where it always did) with the original message, and the entry it was filling was
 * shortened to the fault lifetime LAST — after whatever lifetime the reader asked for. With the
 * upstream up it is not shortened. That nothing is thrown out of the cache function itself is the
 * guard test's reading of the source (`cache-fault.guard.test.ts`).
 */

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
	cacheLife: vi.fn(),
	executePublicGraphQL: vi.fn(),
	executeRawGraphQL: vi.fn(),
	fetchCmsPage: vi.fn(),
	fetchStockedCategorySlugs: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife, cacheTag: vi.fn() }));
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: mocks.executePublicGraphQL,
	executeRawGraphQL: mocks.executeRawGraphQL,
}));
vi.mock("@/lib/cms/client", () => ({ fetchCmsPage: mocks.fetchCmsPage }));
vi.mock("@/lib/seo/catalogue-walk", () => ({
	fetchStockedCategorySlugs: mocks.fetchStockedCategorySlugs,
	sitemapTag: (channel: string) => `sitemap:${channel}`,
}));
vi.mock("@/lib/market-state", () => ({ liveMarkets: () => ["sk", "cz"] }));

import { getBrands, stockedBrandSlugs } from "@/lib/brands/catalog";
import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import { getAdviceGuide } from "@/lib/cms/advice-guide";
import { getCmsBrands } from "@/lib/cms/brands";
import { getCmsScenery } from "@/lib/cms/scenery";
import { getHeroShowcase, getHomeCategoryImages } from "@/lib/homepage/showcase";
import { getScenery } from "@/lib/homepage/scenery";
import { getCategoryFacets } from "@/lib/listing/category-facets";
import { getCategoryNavigation } from "@/lib/listing/category-navigation";
import { getCategoryPriceBands } from "@/lib/listing/category-prices";
import { getProductTypeGroups } from "@/lib/listing/product-groups";
import { __forgetAssortments, getMarketAssortment } from "@/lib/market-assortment";
import { getProductOutcome } from "@/lib/saleor/product-outcome";
import { getProductMarketPresence } from "@/lib/saleor/product-presence";

const SK = "sk-eur";
const DOWN = { ok: false, error: { type: "network", message: "deadline exceeded", isRetryable: true } };

/** What the entry asked for in one `cacheLife` call: one of Next's profiles by name, or the fault lifetime. */
type Lifetime = string | typeof FAULT_CACHE_LIFE;

/** The lifetimes the entry asked for, in order. */
const lifetimes = () => mocks.cacheLife.mock.calls.map(([profile]) => profile as Lifetime);

/** Short for the fault lifetime in the tables below. */
const FAULT = FAULT_CACHE_LIFE;

beforeEach(() => {
	vi.clearAllMocks();
	__forgetAssortments();
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});

	// An obvious fake CMS: nothing here reaches a network.
	vi.stubEnv("PAYLOAD_CMS_URL", "https://cms.invalid");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_ID", "test-client-id");
	vi.stubEnv("PAYLOAD_CF_ACCESS_CLIENT_SECRET", "test-client-secret");
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("down", { status: 503, headers: { "content-type": "text/plain" } })),
	);

	mocks.executePublicGraphQL.mockResolvedValue(DOWN);
	mocks.executeRawGraphQL.mockResolvedValue(DOWN);
	mocks.fetchCmsPage.mockResolvedValue({ status: "error", reason: "HTTP 503" });
	mocks.fetchStockedCategorySlugs.mockRejectedValue(new Error("deadline exceeded"));
});

describe("a reader whose upstream is down", () => {
	/**
	 * The lifetimes the entry asked for, in order: what the reader wanted, then the fault's. The
	 * fault's has to come LAST — Next keeps the shortest of each field over all the calls, so a
	 * reader that wanted `hours` is kept for seconds — and a reader whose own profile is `minutes`
	 * asks for it first and for the fault's after.
	 */
	const THROWING: ReadonlyArray<readonly [string, () => Promise<unknown>, RegExp, readonly Lifetime[]]> = [
		[
			"CMS scenery photos",
			() => getCmsScenery(SK),
			/\[Scenery\] CMS unavailable: HTTP 503/,
			["hours", FAULT],
		],
		["advice guide", () => getAdviceGuide(SK), /\[Advice\] CMS unavailable: HTTP 503/, ["hours", FAULT]],
		["CMS brand entries", () => getCmsBrands(SK), /\[Brands\] CMS answered HTTP 503/, ["hours", FAULT]],
		[
			"Saleor scenery photos",
			() => getScenery(),
			/\[Scenery\] photos unavailable: deadline exceeded/,
			["hours", FAULT],
		],
		[
			"Saleor makers",
			() => stockedBrandSlugs(SK),
			/\[Brands\] makers unavailable: deadline exceeded/,
			["hours", FAULT],
		],
		[
			"homepage category photos",
			() => getHomeCategoryImages(SK),
			/category images unavailable: deadline exceeded/,
			["minutes", FAULT],
		],
		[
			"homepage hero product",
			() => getHeroShowcase(SK),
			/hero product unavailable: deadline exceeded/,
			["minutes", FAULT],
		],
		[
			"product types",
			() => getProductTypeGroups(),
			/\[Listing\] product types unavailable: deadline exceeded/,
			["hours", FAULT],
		],
		[
			"price bands",
			() => getCategoryPriceBands("stresne-nosice", SK),
			/\[Listing\] prices unavailable for stresne-nosice: deadline exceeded/,
			["minutes", FAULT],
		],
		[
			"category facets",
			() => getCategoryFacets("stresne-nosice", SK),
			/\[Listing\] facets unavailable for stresne-nosice: deadline exceeded/,
			["minutes", FAULT],
		],
		[
			// Its own profile, then the product types it asks for first (itself a fault, brief), then its own fault.
			"category navigation",
			() => getCategoryNavigation("stresne-nosice", SK),
			/\[Listing\] category navigation unavailable for stresne-nosice: deadline exceeded/,
			["minutes", "hours", FAULT, FAULT],
		],
	];

	it.each(THROWING)(
		"%s: throws the original message to its caller, and the entry is kept for seconds only",
		async (_name, read, message, asked) => {
			await expect(read()).rejects.toThrow(message);
			expect(lifetimes()).toEqual(asked);
		},
	);

	it("brand strip: the Saleor makers' fault reaches the page, the CMS entries' does not", async () => {
		await expect(getBrands(SK)).rejects.toThrow(/\[Brands\] makers unavailable/);
	});

	it("brand counts are a fault of their own, with the same lifetime", async () => {
		mocks.executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: { attribute: { choices: { edges: [{ node: { slug: "thule", name: "Thule" } }] } } },
		});
		await expect(stockedBrandSlugs(SK)).rejects.toThrow(/\[Brands\] counts unavailable: deadline exceeded/);
		expect(lifetimes()).toEqual(["hours", FAULT]);
	});

	it("market assortment: the header still gets its answer — every category linked — and the entry is brief", async () => {
		await expect(getMarketAssortment(SK)).resolves.toEqual({ state: "unknown" });
		expect(lifetimes()).toEqual(["hours", FAULT]);
	});

	it("product page: the fault is the outcome, with Saleor's own message, and the entry is brief", async () => {
		const outcome = await getProductOutcome("stresny-nosic-x", SK);
		expect(outcome).toMatchObject({
			status: "upstream-error",
			type: "network",
			retryable: true,
			message: "deadline exceeded",
		});
		// The product profile (`minutes`), then the fault's.
		expect(lifetimes()).toEqual(["minutes", FAULT]);
	});

	it("market presence: the same, for the hreflang cluster", async () => {
		const outcome = await getProductMarketPresence("UHJvZHVjdDox", "stresny-nosic-x");
		expect(outcome).toMatchObject({ status: "upstream-error", message: "deadline exceeded" });
		expect(lifetimes()).toEqual(["minutes", FAULT]);
	});
});

describe("a reader whose upstream answers", () => {
	it("keeps the lifetime it asked for: no shortening", async () => {
		mocks.fetchCmsPage.mockResolvedValue({ status: "not-found" });
		await expect(getCmsScenery(SK)).resolves.toBeNull();
		await expect(getAdviceGuide(SK)).resolves.toBeNull();
		expect(lifetimes()).toEqual(["hours", "hours"]);
	});

	it("market assortment: known, kept for the sitemap profile", async () => {
		mocks.fetchStockedCategorySlugs.mockResolvedValue(["stresne-nosice"]);
		const assortment = await getMarketAssortment(SK);
		expect(assortment.state).toBe("known");
		expect(lifetimes()).toEqual(["hours"]);
	});

	it("product types: an authoritative `null` is an answer, not a fault", async () => {
		mocks.executePublicGraphQL.mockResolvedValue({ ok: true, data: { productTypes: null } });
		await expect(getProductTypeGroups()).resolves.toBeNull();
		expect(lifetimes()).toEqual(["hours"]);
	});

	it("product page: `not-found` is authoritative and is not shortened", async () => {
		mocks.executePublicGraphQL.mockResolvedValue({ ok: true, data: { product: null } });
		const outcome = await getProductOutcome("no-such-product", SK);
		expect(outcome).toEqual({ status: "not-found" });
		// Only the product profile's own `minutes`: nothing came after it.
		expect(lifetimes()).toEqual(["minutes"]);
	});
});
