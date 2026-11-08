import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { formatPrice } from "@/config/locale";

/**
 * The homepage's Saleor photos: the hero's lifestyle shot with its market label, and the
 * category tiles. The transport is mocked at its answer; the exact-locale check, the price
 * format and the URL builder are the real ones, so a label can only ever say what a product
 * card in the same market would say.
 */

type Answer = { ok: true; data: unknown } | { ok: false; error: { type: string; message: string } };
let answers: Record<string, Answer> = {};
const sent: { operation: string; variables: Record<string, unknown>; retry?: boolean }[] = [];
const tags: string[] = [];

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (
		document: { toString(): string },
		options: { variables: Record<string, unknown>; retry?: boolean },
	) => {
		const operation = /query (\w+)/.exec(document.toString())?.[1] ?? "?";
		sent.push({ operation, variables: options.variables, retry: options.retry });
		return answers[operation];
	},
}));

vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: (...added: string[]) => tags.push(...added),
}));

const { getHeroShowcase, getHomeCategoryImages } = await import("./showcase");
const { HERO_SCENERY } = await import("@/config/storefront-imagery");

const SK = CHANNEL_MAP.sk.saleorSlug;
const DE = CHANNEL_MAP.de.saleorSlug;

function heroProduct(overrides: Record<string, unknown> = {}) {
	return {
		id: HERO_SCENERY.photo.productId,
		isAvailableForPurchase: true,
		name: "Strešný box Thule Motion 3 - XL - Titan Glossy",
		slug: "stresny-box-thule-motion-3-xl-titan-glossy-639801",
		translation: null,
		created: "2026-01-01T00:00:00Z",
		rating: null,
		attributes: [],
		category: null,
		pricing: { priceRange: { start: { gross: { amount: 899, currency: "EUR" } } } },
		thumbnail: { url: "https://cdn.example/cut-out.webp", alt: null },
		...overrides,
	};
}

beforeEach(() => {
	answers = {};
	sent.length = 0;
	tags.length = 0;
});

describe("hero showcase", () => {
	it("names the product on the photo with this market's name, price, link and photo", async () => {
		answers.HomeHeroProduct = { ok: true, data: { product: heroProduct() } };
		const showcase = await getHeroShowcase(SK);

		expect(showcase?.product).toEqual({
			name: "Strešný box Thule Motion 3 - XL - Titan Glossy",
			href: "/sk/stresny-box-thule-motion-3-xl-titan-glossy-639801",
			price: formatPrice(899, "EUR", "sk-SK"),
			image: "https://cdn.example/cut-out.webp",
			category: null,
		});
		// One attempt, and the product's own event expires the entry.
		expect(sent[0]).toMatchObject({ operation: "HomeHeroProduct", retry: false });
		expect(tags).toContain(`product:${SK}:sk-SK:stresny-box-thule-motion-3-xl-titan-glossy-639801`);
	});

	it("names nothing in a market where the product is not translated", async () => {
		answers.HomeHeroProduct = { ok: true, data: { product: heroProduct() } };
		const showcase = await getHeroShowcase(DE);

		expect(showcase?.product).toBeNull();
	});

	it("uses the market's own name and URL where the product is translated", async () => {
		answers.HomeHeroProduct = {
			ok: true,
			data: {
				product: heroProduct({
					translation: {
						// All five fields, as exact-locale demands; one missing and the label is dropped
						// (the previous test's untranslated case).
						name: "Dachbox Thule Motion 3 - XL - Titan Glossy",
						slug: "dachbox-thule-motion-3-xl-titan-glossy-639801",
						description: '{"blocks":[{"type":"paragraph","data":{"text":"Dachbox"}}]}',
						seoTitle: "Dachbox Thule Motion 3 XL",
						seoDescription: "Dachbox Thule Motion 3 XL in Titan Glossy.",
					},
				}),
			},
		};
		const showcase = await getHeroShowcase(DE);

		expect(showcase?.product?.name).toBe("Dachbox Thule Motion 3 - XL - Titan Glossy");
		expect(showcase?.product?.href).toBe("/de/dachbox-thule-motion-3-xl-titan-glossy-639801");
	});

	it("names nothing when the product is not sold here", async () => {
		answers.HomeHeroProduct = { ok: true, data: { product: null } };
		expect(await getHeroShowcase(SK)).toBeNull();
	});

	it("throws on a fault rather than answering it, so the fault is never cached", async () => {
		answers.HomeHeroProduct = { ok: false, error: { type: "http", message: "HTTP 503" } };
		await expect(getHeroShowcase(SK)).rejects.toThrow(/hero product unavailable/);
	});
});

describe("category tile photos", () => {
	it("maps each category to its photo, skips one without, and tags every tile's category", async () => {
		answers.HomeCategoryImages = {
			ok: true,
			data: {
				categories: {
					edges: [
						{
							node: {
								id: "1",
								slug: "stresne-nosice",
								backgroundImage: { url: "https://cdn.example/racks.webp" },
							},
						},
						{ node: { id: "2", slug: "stresne-boxy", backgroundImage: null } },
					],
				},
			},
		};
		const images = await getHomeCategoryImages(SK);

		expect(images).toEqual({ "stresne-nosice": "https://cdn.example/racks.webp" });
		expect(sent[0]).toMatchObject({ operation: "HomeCategoryImages", retry: false });
		for (const slug of [
			"stresne-nosice",
			"stresne-boxy",
			"nosice-bicyklov",
			"nosice-lyzi",
			"stresne-stany",
			"snehove-retaze",
			"autochladnicky",
		]) {
			expect(tags).toContain(`category:${SK}:sk-SK:${slug}`);
		}
	});

	it("shows a category without a picture of its own by its first product's photo, and never a placeholder", async () => {
		const edge = (url: string | null) => ({ node: { thumbnail: url ? { url } : null } });
		answers.HomeCategoryImages = {
			ok: true,
			data: {
				categories: {
					edges: [
						{
							node: {
								id: "1",
								slug: "snehove-retaze",
								backgroundImage: null,
								products: { edges: [edge("https://cdn.example/chain.webp")] },
							},
						},
						{
							node: {
								id: "2",
								slug: "stresne-nosice",
								backgroundImage: { url: "https://cdn.example/racks.webp" },
								products: { edges: [edge("https://cdn.example/other.webp")] },
							},
						},
						{
							node: {
								id: "3",
								slug: "autochladnicky",
								backgroundImage: null,
								products: {
									edges: [
										edge("https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4_1_thumbnail_4.gif"),
									],
								},
							},
						},
						{ node: { id: "4", slug: "stresne-boxy", backgroundImage: null, products: { edges: [] } } },
					],
				},
			},
		};
		const images = await getHomeCategoryImages(SK);

		expect(images).toEqual({
			"snehove-retaze": "https://cdn.example/chain.webp",
			// Its own picture wins over a product's.
			"stresne-nosice": "https://cdn.example/racks.webp",
		});
		// Taken from the Slovak channel, where the shelves' products are listed.
		expect(sent[0]?.variables).toMatchObject({ channel: SK });
		expect(tags).toContain(`category:${SK}:sk-SK:snehove-retaze`);
	});

	it("throws on a fault rather than caching an empty set of photos", async () => {
		answers.HomeCategoryImages = { ok: false, error: { type: "network", message: "timeout" } };
		await expect(getHomeCategoryImages(SK)).rejects.toThrow(/category images unavailable/);
	});
});
