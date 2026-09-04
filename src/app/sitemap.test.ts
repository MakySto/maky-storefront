import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));

import { SitemapCategoriesDocument, SitemapProductsDocument } from "@/gql/graphql";
import sitemap from "./sitemap";

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
		},
	},
};

/** Serve products from `pages`, categories from the fixture above. */
function serve(pages: (after: string | null | undefined) => unknown) {
	executePublicGraphQL.mockImplementation((document: unknown, options: { variables: Variables }) => {
		if (document === SitemapProductsDocument) return Promise.resolve(pages(options.variables.after));
		if (document === SitemapCategoriesDocument) return Promise.resolve(categoriesResult);
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
		expect(urls).toContain(`${BASE}/sk/categories/nosice-bicyklov`);
		expect(urls, "an empty category is thin content, not a canonical URL").not.toContain(
			`${BASE}/sk/categories/prazdna-kategoria`,
		);
		expect(urls).toContain(`${BASE}/sk/kontakt`);
	});
});

describe("a connection that cannot end", () => {
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
