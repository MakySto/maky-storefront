import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executePublicGraphQL, loadCatalogView } = vi.hoisted(() => ({
	executePublicGraphQL: vi.fn(),
	loadCatalogView: vi.fn(),
}));

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));
/**
 * Only the LOADER is mocked. `catalogServesMarket` stays real, because the
 * language gate is one of the things under test here and a hand-written copy of it
 * in this file could agree with a stale version of the rule it mirrors.
 */
vi.mock("@/lib/catalog-content/resolve", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/catalog-content/resolve")>()),
	loadCatalogView,
}));

import { SitemapCategoriesDocument, SitemapProductsDocument } from "@/gql/graphql";
import sitemap from "./sitemap";
import { REVERSE_MAP } from "@/lib/channel-map";

/**
 * The sitemap must enumerate the WHOLE catalogue or fail.
 *
 * It used to stop after twenty pages. That was a backstop sized against 458
 * products, and it aged into a truncation the moment CFM rendered 9 192 Slovak
 * descriptions: 9 192 at 100 a page is 92 pages, so every build would have
 * thrown at product 2 000 — or, before the throw was added, quietly published a
 * sitemap missing 78% of the shop, which Google reads as "those URLs are gone".
 *
 * So the two properties under test are the two halves of the same promise:
 * paginate to the end of the connection, and turn a connection that cannot end
 * into a loud error rather than an infinite loop or a short list.
 *
 * Saleor is mocked, deliberately and entirely. A 92-page walk against a live API
 * would be a slow, flaky test of somebody else's uptime; what is being asserted
 * here is this file's loop, and the loop only needs a connection that behaves
 * like a connection.
 */

const BASE = "https://maky.store";
const CATALOGUE_SIZE = 9_192;
const PAGE_SIZE = 100;
const EXPECTED_PAGES = Math.ceil(CATALOGUE_SIZE / PAGE_SIZE); // 92

/** Product entries are the ones this file gives priority 0.6 — see marketEntries. */
const PRODUCT_PRIORITY = 0.6;

type Variables = { channel: string; first: number; after?: string | null };

/**
 * Cursors here are `offset:<n>` so the fixture can answer any `after` without
 * keeping walk state. Saleor's are opaque base64, but the only property the loop
 * relies on is that a cursor identifies a position, which this preserves.
 */
function offsetOf(after: string | null | undefined): number {
	return after ? Number(after.slice("offset:".length)) : 0;
}

function productPage(after: string | null | undefined, size = CATALOGUE_SIZE) {
	const start = offsetOf(after);
	const end = Math.min(start + PAGE_SIZE, size);

	return {
		ok: true as const,
		data: {
			products: {
				edges: Array.from({ length: end - start }, (_, i) => ({
					node: { slug: `produkt-${start + i + 1}`, updatedAt: "2026-09-01T08:00:00+00:00" },
				})),
				pageInfo: { hasNextPage: end < size, endCursor: `offset:${end}` },
			},
		},
	};
}

/** One stocked category and one empty one — the empty one must not be listed. */
const categoriesResult = {
	ok: true as const,
	data: {
		categories: {
			edges: [
				{ node: { slug: "nosice-bicyklov", products: { totalCount: 1_204 } } },
				{ node: { slug: "prazdna-kategoria", products: { totalCount: 0 } } },
			],
			pageInfo: { hasNextPage: false, endCursor: "offset:2" },
		},
	},
};

/** Serve products from `pages`, categories from the fixture above. */
function serve(
	pages: (after: string | null | undefined) => unknown,
	categories: (after: string | null | undefined) => unknown = () => categoriesResult,
) {
	executePublicGraphQL.mockImplementation((document: unknown, options: { variables: Variables }) => {
		if (document === SitemapProductsDocument) return Promise.resolve(pages(options.variables.after));
		if (document === SitemapCategoriesDocument) return Promise.resolve(categories(options.variables.after));
		throw new Error("the sitemap asked for a document this test does not serve");
	});
}

function productUrls(entries: Awaited<ReturnType<typeof sitemap>>): string[] {
	return entries.filter((entry) => entry.priority === PRODUCT_PRIORITY).map((entry) => entry.url);
}

function productPageCalls(): number {
	return executePublicGraphQL.mock.calls.filter((call) => call[0] === SitemapProductsDocument).length;
}

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = BASE;
	// `sk` is the default live market; an inherited override would change the
	// number of markets walked and with it every count below.
	delete process.env.MAKY_LIVE_MARKETS;
	executePublicGraphQL.mockReset();
	// Default: no catalogue snapshot, which is what a deployment without
	// MAKY_CATALOG_CONTENT_PATH serves. The vehicle-page tests opt in.
	loadCatalogView.mockReset();
	loadCatalogView.mockResolvedValue({ ready: false, reason: "no snapshot", status: catalogStatus(null) });
});

afterEach(() => {
	delete process.env.NEXT_PUBLIC_STOREFRONT_URL;
});

describe("the whole catalogue, or an error", () => {
	it("emits all 9 192 product URLs with nothing truncated", async () => {
		serve((after) => productPage(after));

		const urls = productUrls(await sitemap());

		expect(urls).toHaveLength(CATALOGUE_SIZE);
		expect(new Set(urls).size, "no slug listed twice").toBe(CATALOGUE_SIZE);
		expect(urls[0]).toBe(`${BASE}/sk/produkt-1`);
		expect(urls.at(-1)).toBe(`${BASE}/sk/produkt-${CATALOGUE_SIZE}`);
		expect(productPageCalls(), "walked the connection to its end").toBe(EXPECTED_PAGES);
	});

	it("keeps going past the twenty-page ceiling that used to cap it", async () => {
		serve((after) => productPage(after));

		const urls = new Set(productUrls(await sitemap()));

		// Page 21 and beyond: the first product the old MAX_PAGES = 20 could never
		// have reached, and the last one in the catalogue.
		expect(urls.has(`${BASE}/sk/produkt-2001`)).toBe(true);
		expect(urls.has(`${BASE}/sk/produkt-9192`)).toBe(true);
	});

	it("still lists the market, its stocked categories and the Slovak legal pages", async () => {
		serve((after) => productPage(after));

		const urls = (await sitemap()).map((entry) => entry.url);

		expect(urls).toContain(`${BASE}/sk`);
		expect(urls).toContain(`${BASE}/sk/products`);
		// A catalogue category is root-level; a non-catalogue one keeps /categories/.
		expect(urls).toContain(`${BASE}/sk/nosice-bicyklov`);
		expect(urls, "an empty category is thin content, not a canonical URL").not.toContain(
			`${BASE}/sk/prazdna-kategoria`,
		);
		expect(urls, "the retired /categories/ shape is a 308, never a canonical URL").not.toContain(
			`${BASE}/sk/categories/nosice-bicyklov`,
		);
		expect(urls).toContain(`${BASE}/sk/kontakt`);
	});
});

describe("a connection that cannot end", async () => {
	it("throws when the cursor stops advancing", async () => {
		// The API pins `endCursor` at the page it just served. Without a guard this
		// asks for the same page forever and the array grows until the process dies.
		serve((after) => {
			const page = productPage(after);
			return {
				...page,
				data: {
					products: { ...page.data.products, pageInfo: { hasNextPage: true, endCursor: "offset:100" } },
				},
			};
		});

		await expect(sitemap()).rejects.toThrow(/cursor did not advance past offset:100/);
	});

	it("throws when the cursor repeats a position it already served", async () => {
		// A two-cycle: a → b → a. Each step advances, so an `after !== endCursor`
		// check alone would loop; only the set of cursors already followed sees it.
		const cycle = ["offset:100", "offset:200", "offset:100"];
		let step = 0;
		serve((after) => {
			const page = productPage(after);
			const endCursor = cycle[Math.min(step++, cycle.length - 1)];
			return {
				...page,
				data: { products: { ...page.data.products, pageInfo: { hasNextPage: true, endCursor } } },
			};
		});

		await expect(sitemap()).rejects.toThrow(/cursor offset:100 repeated/);
	});

	it("throws when hasNextPage is claimed with no cursor to follow", async () => {
		serve((after) => {
			const page = productPage(after);
			return {
				...page,
				data: { products: { ...page.data.products, pageInfo: { hasNextPage: true, endCursor: null } } },
			};
		});

		await expect(sitemap()).rejects.toThrow(/hasNextPage with no cursor/);
	});

	it("throws rather than serving what it collected when a page mid-walk fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		serve((after) =>
			offsetOf(after) >= 300
				? { ok: false as const, error: { type: "network", message: "ECONNRESET", isRetryable: true } }
				: productPage(after),
		);

		await expect(sitemap()).rejects.toThrow(/product page 4 did not resolve/);
		vi.restoreAllMocks();
	});
});

/**
 * The category walk used to be a bare `first: 100` with no `pageInfo` selected
 * at all, so it could not detect its own truncation — the exact failure S1
 * removed from the product walk and left here. Thirty categories exist today,
 * so it was latent; a bare cap is only ever latent until the catalogue grows.
 */
describe("categories are walked to the end too", async () => {
	it("follows the category cursor past the first page", async () => {
		const CATEGORY_COUNT = 250;
		serve(
			(after) => productPage(after, 0),
			(after) => {
				const start = offsetOf(after);
				const end = Math.min(start + PAGE_SIZE, CATEGORY_COUNT);
				return {
					ok: true as const,
					data: {
						categories: {
							edges: Array.from({ length: end - start }, (_, i) => ({
								node: { slug: `kategoria-${start + i + 1}`, products: { totalCount: 3 } },
							})),
							pageInfo: { hasNextPage: end < CATEGORY_COUNT, endCursor: `offset:${end}` },
						},
					},
				};
			},
		);

		const entries = await sitemap();
		// `kategoria-N` is not in src/config/categories.ts, so these keep the
		// `/categories/` shape — which is the point of the split, and worth pinning:
		// only a catalogue category gets a root URL, and the sitemap says the same
		// thing the breadcrumbs and the proxy do, because all three call categoryUrl().
		const categoryUrls = entries.filter((entry) => entry.url.startsWith(`${BASE}/sk/categories/kategoria-`));

		expect(categoryUrls).toHaveLength(CATEGORY_COUNT);
		expect(categoryUrls.at(-1)?.url).toBe(`${BASE}/sk/categories/kategoria-250`);
	});

	it("throws rather than truncating when a category page fails mid-walk", async () => {
		serve(
			(after) => productPage(after, 0),
			(after) =>
				offsetOf(after) === 0
					? {
							ok: true as const,
							data: {
								categories: {
									edges: [{ node: { slug: "nosice-bicyklov", products: { totalCount: 4 } } }],
									pageInfo: { hasNextPage: true, endCursor: "offset:100" },
								},
							},
						}
					: { ok: false as const, error: { type: "network", message: "socket hang up" } },
		);

		await expect(sitemap()).rejects.toThrow(/category page 2 did not resolve/);
	});

	it("throws when the category cursor cycles back to a position it already served", async () => {
		// The cursor has to CYCLE, not stall: a cursor that repeats the one it was
		// just given trips the "did not advance" guard first. This alternates
		// 100 → 200 → 100, which advances every step and still never terminates.
		const cycle: Record<string, string> = {
			"": "offset:100",
			"offset:100": "offset:200",
			"offset:200": "offset:100",
		};
		serve(
			(after) => productPage(after, 0),
			(after) => ({
				ok: true as const,
				data: {
					categories: {
						edges: [{ node: { slug: "nosice-bicyklov", products: { totalCount: 4 } } }],
						pageInfo: { hasNextPage: true, endCursor: cycle[after ?? ""] },
					},
				},
			}),
		);

		await expect(sitemap()).rejects.toThrow(/cursor offset:100 repeated/);
	});
});

/**
 * The static entries are derived, not listed.
 *
 * `SK_ONLY_PATHS` was a hand-written table guarded by `market === "sk"`, with a comment
 * saying those routes "call notFound() for any other channel". Seven of the eight had
 * since gained approved copy in all twelve markets, so the table and the application
 * disagreed — silently, because only `sk` is live and nothing else was ever generated.
 * It would have surfaced as eleven sitemaps missing their legal pages on the first
 * foreign launch.
 */
describe("sitemap — static paths follow route-policy", async () => {
	// The real function, not a copy of it. A CMS route now also has to be PUBLISHED, so
	// the availability read is stubbed: `published` holds the markets whose CMS document
	// exists, and each case sets it.
	const published = new Set<string>();

	async function derived(market: string, cmsMarkets: readonly string[] = ["sk"]): Promise<string[]> {
		published.clear();
		for (const m of cmsMarkets) published.add(m);
		vi.resetModules();
		vi.doMock("@/lib/cms/availability", () => ({
			cmsRouteAvailable: async (channel: string) => published.has(REVERSE_MAP[channel] ?? ""),
		}));
		const { staticPathsFor } = await import("./sitemap");
		return [...(await staticPathsFor(market))];
	}

	// Exactly what the removed constant listed, so today's SK sitemap is unchanged.
	const OLD_SK_ONLY_PATHS = [
		"/obchodne-podmienky",
		"/reklamacie-a-vratenie",
		"/odstupenie-od-zmluvy",
		"/ochrana-osobnych-udajov",
		"/cookies",
		"/doprava-a-platba",
		"/kontakt",
		"/o-nas",
		"/poradna",
	];

	it("still produces every path the hand-written SK table produced", async () => {
		const sk = await derived("sk");
		for (const path of OLD_SK_ONLY_PATHS) {
			expect(sk, `sk lost ${path}`).toContain(path);
		}
	});

	it("adds the printable model form, which the old table omitted", async () => {
		// It is indexable, it exists in every market with approved copy, and it was
		// missing from the sitemap entirely.
		expect(await derived("sk")).toContain("/odstupenie-od-zmluvy/vzorovy-formular");
	});

	it("gives the other markets their seven legal pages", async () => {
		for (const market of ["cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			const paths = await derived(market);
			for (const path of [
				"/kontakt",
				"/doprava-a-platba",
				"/reklamacie-a-vratenie",
				"/odstupenie-od-zmluvy",
				"/obchodne-podmienky",
				"/ochrana-osobnych-udajov",
				"/cookies",
			]) {
				expect(paths, `${market} is missing ${path}`).toContain(path);
			}
		}
	});

	it("keeps the CMS pages to the markets route-policy actually lists", async () => {
		expect(await derived("sk")).toContain("/o-nas");
		for (const market of ["cz", "de", "us", "ca"]) {
			expect(await derived(market), `${market} must not advertise an unpublished /o-nas`).not.toContain(
				"/o-nas",
			);
			expect(await derived(market)).not.toContain("/poradna");
		}
	});

	it("never advertises a private or non-indexable route", async () => {
		for (const market of ["sk", "de", "us"]) {
			const paths = await derived(market);
			for (const forbidden of ["/search", "/cart", "/account", "/login", "/garage", "/konfigurator"]) {
				expect(paths, `${market} advertises ${forbidden}`).not.toContain(forbidden);
			}
		}
	});
});

/**
 * The sitemap follows publication, not only route support.
 *
 * `staticPathsFor` read `route-policy` alone, so a CMS page that had been unpublished —
 * or published with no body for the market — stayed in the sitemap while the navigation
 * correctly dropped it. The two disagreed, and the sitemap was the one inviting a
 * crawler to a 404.
 */
describe("sitemap — CMS entries follow the CMS", () => {
	const published = new Set<string>();

	async function pathsFor(market: string, cmsMarkets: readonly string[]): Promise<string[]> {
		published.clear();
		for (const m of cmsMarkets) published.add(m);
		vi.resetModules();
		vi.doMock("@/lib/cms/availability", () => ({
			cmsRouteAvailable: async (channel: string) => published.has(REVERSE_MAP[channel] ?? ""),
		}));
		const { staticPathsFor } = await import("./sitemap");
		return [...(await staticPathsFor(market))];
	}

	it("lists /o-nas while it is published", async () => {
		expect(await pathsFor("sk", ["sk"])).toContain("/o-nas");
	});

	it("drops /o-nas once it is unpublished, even though the route still exists", async () => {
		const paths = await pathsFor("sk", []);
		expect(paths).not.toContain("/o-nas");
		expect(paths).not.toContain("/poradna");
		// …and the static legal pages are untouched: they are not CMS routes.
		expect(paths).toContain("/kontakt");
		expect(paths).toContain("/obchodne-podmienky");
	});

	it("never asks the CMS about a market that does not support the route", async () => {
		// `de` has no CMS route in policy, so availability must not even be consulted —
		// and the German sitemap must not gain /o-nas just because sk published one.
		expect(await pathsFor("de", ["sk", "de"])).not.toContain("/o-nas");
	});
});

/**
 * The CFM vehicle pages.
 *
 * The gate that matters is not "is it indexable" — `indexable: true` is set on all 1 475
 * pages CFM delivered, the one it deliberately held back included. The gate is `state`,
 * plus editorial text. These fixtures are shaped after the real delivery so that the
 * distinction is actually exercised rather than described.
 */
function catalogStatus(language: string | null) {
	return {
		mode: language ? ("file" as const) : ("disabled" as const),
		unavailableReason: null,
		language,
		generatedAt: "2026-09-12T13:06:29.526422+00:00",
		pageCount: 0,
		sha256: null,
	};
}

type FixturePage = {
	urlPath: string;
	state: "draft" | "published";
	indexable: boolean;
	hasEditorialText: boolean;
};

function catalogView(language: string, pages: readonly FixturePage[]) {
	const byUrlPath = new Map(
		pages.map((p) => [
			p.urlPath,
			{
				vehicleId: `veh:${p.urlPath}`,
				kind: "generation" as const,
				name: p.urlPath,
				urlPath: p.urlPath,
				parentId: null,
				page: { publicId: `pg:${p.urlPath}`, kind: "vehicle_generation" as const, ...p },
			},
		]),
	);
	return { ready: true as const, tree: { byUrlPath }, status: catalogStatus(language) };
}

/** The real delivery in miniature: published+text, published+no text, and the held-back draft. */
const DELIVERY: readonly FixturePage[] = [
	{ urlPath: "/stresne-nosice/bmw", state: "published", indexable: true, hasEditorialText: true },
	{
		urlPath: "/stresne-nosice/skoda/octavia-combi",
		state: "published",
		indexable: true,
		hasEditorialText: true,
	},
	{ urlPath: "/stresne-nosice/thin", state: "published", indexable: true, hasEditorialText: false },
	{ urlPath: "/stresne-nosice/lynk-co/01", state: "draft", indexable: true, hasEditorialText: false },
	{ urlPath: "/stresne-nosice/noindex", state: "published", indexable: false, hasEditorialText: true },
];

describe("the vehicle pages", () => {
	const vehicleUrls = (entries: Awaited<ReturnType<typeof sitemap>>) =>
		entries.map((e) => e.url).filter((u) => u.includes("/stresne-nosice/"));

	it("lists only pages that are published, indexable AND have text", async () => {
		serve((after) => productPage(after, 0));
		loadCatalogView.mockResolvedValue(catalogView("sk", DELIVERY));

		expect(vehicleUrls(await sitemap())).toEqual([
			`${BASE}/sk/stresne-nosice/bmw`,
			`${BASE}/sk/stresne-nosice/skoda/octavia-combi`,
		]);
	});

	/**
	 * The trap CFM named explicitly. `indexable` is true on the draft page too, so a
	 * sitemap that filtered on it would advertise a page with no Slovak text that the
	 * route itself refuses to serve.
	 */
	it("never advertises the page CFM held back, though it is flagged indexable", async () => {
		serve((after) => productPage(after, 0));
		loadCatalogView.mockResolvedValue(catalogView("sk", DELIVERY));

		const urls = await sitemap();
		expect(urls.map((e) => e.url)).not.toContain(`${BASE}/sk/stresne-nosice/lynk-co/01`);
	});

	/**
	 * CFM published nine translations and said their existence is not permission to
	 * index them. A Slovak snapshot must not furnish a German market with URLs.
	 */
	it("does not serve one market's snapshot to another market's language", async () => {
		process.env.MAKY_LIVE_MARKETS = "sk,de";
		serve((after) => productPage(after, 0));
		loadCatalogView.mockResolvedValue(catalogView("sk", DELIVERY));

		const urls = vehicleUrls(await sitemap());
		expect(urls.every((u) => u.startsWith(`${BASE}/sk/`))).toBe(true);
		expect(urls.some((u) => u.startsWith(`${BASE}/de/`))).toBe(false);
	});

	/** A switched-off feature is not a truncated catalogue: the rest of the sitemap stands. */
	it("yields nothing, and breaks nothing, when no snapshot is configured", async () => {
		serve((after) => productPage(after, 3));
		loadCatalogView.mockResolvedValue({ ready: false, reason: "off", status: catalogStatus(null) });

		const entries = await sitemap();
		expect(vehicleUrls(entries)).toEqual([]);
		expect(entries.some((e) => e.url === `${BASE}/sk`)).toBe(true);
		expect(entries.filter((e) => e.priority === PRODUCT_PRIORITY)).toHaveLength(3);
	});
});
