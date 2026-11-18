import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executePublicGraphQL, loadCatalogView, stockedBrandSlugs, getShelfCodes, cmsRouteAvailable } =
	vi.hoisted(() => ({
		executePublicGraphQL: vi.fn(),
		cmsRouteAvailable: vi.fn(),
		loadCatalogView: vi.fn(),
		stockedBrandSlugs: vi.fn(),
		getShelfCodes: vi.fn(),
	}));

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));
vi.mock("@/lib/brands/catalog", () => ({ stockedBrandSlugs }));
vi.mock("@/lib/listing/shelf-codes", () => ({ getShelfCodes }));
vi.mock("@/lib/cms/availability", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/cms/availability")>()),
	cmsRouteAvailable,
}));
vi.mock("@/lib/catalog-content/resolve", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/catalog-content/resolve")>()),
	loadCatalogView,
}));

import {
	SitemapCategoriesDocument,
	SitemapProductCountDocument,
	SitemapProductsDocument,
} from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { resetLiveCategoriesForTests } from "@/lib/live-categories";
import { renderSitemapIndex, sitemapShardEntries, sitemapShards } from "./sitemap";
import { resetSitemapSnapshotsForTests } from "./sitemap-snapshot";

/**
 * What a COLD `/sitemap.xml` asks Saleor and Payload for, across every market.
 *
 * 2026-11-18: after 2 161 more sets the index took 52 s on a cold process and the deploy's 25 s check
 * failed three times. The index only has to NAME the shards, yet it used to build the whole `pages`
 * shard of every market to count it: per market the category list (with a product probe per category),
 * the makers' counts (a COUNT per maker), the snow-chain shelf's codes and the CMS routes. That is
 * what grew with the catalogue and with the markets, and it is what this pins to zero.
 *
 * The queries are counted, not timed: how long they take is Saleor's business and varies with its
 * load, how many there are is ours.
 */

const MARKETS = Object.keys(CHANNEL_MAP);
const CATALOGUE_SIZE = 11_000;

function install() {
	executePublicGraphQL.mockImplementation((document: unknown) => {
		if (document === SitemapProductCountDocument)
			return Promise.resolve({ ok: true, data: { products: { totalCount: CATALOGUE_SIZE } } });
		if (document === SitemapProductsDocument)
			return Promise.resolve({
				ok: true,
				data: {
					products: {
						// A product every market can render, so the first-page look finds one and the plan stands on the count.
						edges: [
							{
								node: {
									name: "Nosič",
									slug: "produkt-1",
									updatedAt: null,
									translation: {
										name: "Träger",
										slug: "produkt-1",
										description: '{"blocks":[]}',
										seoTitle: "Träger",
										seoDescription: "Träger kaufen",
									},
									category: { slug: "nosice-bicyklov", translation: { name: "Träger" } },
									attributes: [],
									variants: [{ selectionAttributes: [], nonSelectionAttributes: [] }],
								},
							},
						],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			});
		if (document === SitemapCategoriesDocument)
			return Promise.resolve({
				ok: true,
				data: {
					categories: {
						edges: [{ node: { slug: "nosice-bicyklov", products: { edges: [{ node: { id: "p1" } }] } } }],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			});
		throw new Error("the index asked for a document this test does not serve");
	});
}

function callsOf(document: unknown): number {
	return executePublicGraphQL.mock.calls.filter((call) => call[0] === document).length;
}

beforeEach(() => {
	resetSitemapSnapshotsForTests();
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
	process.env.MAKY_LIVE_MARKETS = MARKETS.join(",");
	process.env.MAKY_INDEXABLE_MARKETS = MARKETS.join(",");
	executePublicGraphQL.mockReset();
	loadCatalogView.mockReset();
	loadCatalogView.mockResolvedValue({ ready: false, reason: "no snapshot" });
	stockedBrandSlugs.mockReset();
	stockedBrandSlugs.mockResolvedValue(new Set(["thule"]));
	getShelfCodes.mockReset();
	getShelfCodes.mockResolvedValue([]);
	cmsRouteAvailable.mockReset();
	cmsRouteAvailable.mockResolvedValue(true);
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "");
});

afterEach(() => {
	delete process.env.NEXT_PUBLIC_STOREFRONT_URL;
	delete process.env.MAKY_LIVE_MARKETS;
	delete process.env.MAKY_INDEXABLE_MARKETS;
	vi.unstubAllEnvs();
	resetLiveCategoriesForTests();
	resetSitemapSnapshotsForTests();
});

describe("the cold sitemap index", () => {
	it("reads no categories, makers, shelf codes or CMS routes to name its shards", async () => {
		install();
		const shards = await sitemapShards();

		console.info(
			`[index-cost] markets=${MARKETS.length} categoryQueries=${callsOf(SitemapCategoriesDocument)} ` +
				`makerLists=${stockedBrandSlugs.mock.calls.length} shelfReads=${getShelfCodes.mock.calls.length} cmsReads=${cmsRouteAvailable.mock.calls.length} ` +
				`productCounts=${callsOf(SitemapProductCountDocument)} firstPages=${callsOf(
					SitemapProductsDocument,
				)} ` +
				`total=${
					executePublicGraphQL.mock.calls.length +
					stockedBrandSlugs.mock.calls.length +
					getShelfCodes.mock.calls.length +
					cmsRouteAvailable.mock.calls.length
				}`,
		);

		expect(callsOf(SitemapCategoriesDocument)).toBe(0);
		expect(stockedBrandSlugs).not.toHaveBeenCalled();
		expect(getShelfCodes).not.toHaveBeenCalled();
		expect(cmsRouteAvailable).not.toHaveBeenCalled();
		// What is left is one cheap count per market, and one first page for each market abroad.
		expect(callsOf(SitemapProductCountDocument)).toBe(MARKETS.length);
		expect(callsOf(SitemapProductsDocument)).toBe(MARKETS.length - 1);
		// And every market is still named: its pages and its products.
		for (const market of MARKETS) {
			expect(shards.map((shard) => shard.id)).toContain(`${market}-pages-1`);
			expect(shards.map((shard) => shard.id)).toContain(`${market}-products-1`);
		}
	});

	it("names a pages shard that the shard itself then answers", async () => {
		install();
		const shards = await sitemapShards();
		expect(renderSitemapIndex(shards)).toContain("/sitemaps/sk-pages-1.xml");
		// The index skipped the work; the shard does it, once, when somebody asks for the shard.
		const entries = await sitemapShardEntries("sk-pages-1");
		expect(entries?.map((entry) => entry.url)).toContain("https://maky.store/sk");
		expect(callsOf(SitemapCategoriesDocument)).toBe(1);
	});

	it("does not ask Saleor again for a second index while the first one's reads are kept", async () => {
		install();
		await sitemapShards();
		const first = executePublicGraphQL.mock.calls.length;
		await sitemapShards();
		// The count and the first page are data-cache reads in the app; here the mock has no cache, so
		// the claim is only that the second index adds no kind of read the first did not make.
		expect(executePublicGraphQL.mock.calls.length).toBeLessThanOrEqual(first * 2);
		expect(callsOf(SitemapCategoriesDocument)).toBe(0);
	});
});
