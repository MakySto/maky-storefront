import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/graphql", () => ({ executePublicGraphQL: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/cms/client", () => ({ fetchCmsPage: vi.fn() }));

const { resolveScenery } = await import("./scenery");
const { HERO_SCENERY, TILE_SCENERY, BANNER_SCENERY, ADVICE_SCENERY, sceneryProductIds } = await import(
	"@/config/storefront-imagery"
);

/**
 * The scenery configuration resolved against the stored files Saleor answered with. Pure: the
 * GraphQL call is not made here, only the mapping from (product, media) to a photo.
 */
const key = (photo: { productId: string; mediaId: string }) => `${photo.productId}/${photo.mediaId}`;

describe("scenery", () => {
	it("resolves every configured photo that Saleor still has, with its crop", () => {
		const urls = new Map<string, string>([
			[key(HERO_SCENERY.photo), "https://cdn.example/hero.jpg"],
			[key(ADVICE_SCENERY), "https://cdn.example/advice.jpg"],
			[key(TILE_SCENERY["stresne-boxy"]!), "https://cdn.example/boxes.jpg"],
			[key(BANNER_SCENERY["nosice-bicyklov"]!), "https://cdn.example/bikes.jpg"],
		]);
		const scenery = resolveScenery(urls);

		expect(scenery.hero).toEqual({
			url: "https://cdn.example/hero.jpg",
			position: HERO_SCENERY.photo.position,
			mobilePosition: HERO_SCENERY.photo.mobilePosition,
			source: "saleor",
		});
		expect(scenery.advice?.url).toBe("https://cdn.example/advice.jpg");
		expect(scenery.tiles["stresne-boxy"]?.url).toBe("https://cdn.example/boxes.jpg");
		// A photo without a phone crop uses its desktop one.
		expect(scenery.tiles["stresne-boxy"]?.mobilePosition).toBe(TILE_SCENERY["stresne-boxy"]!.position);
		expect(scenery.banners["nosice-bicyklov"]?.url).toBe("https://cdn.example/bikes.jpg");
	});

	it("leaves a placement out when its photo is gone from the gallery — never another photo", () => {
		const scenery = resolveScenery(new Map());
		expect(scenery.hero).toBeNull();
		expect(scenery.advice).toBeNull();
		expect(scenery.tiles).toEqual({});
		expect(scenery.banners).toEqual({});
	});

	it("asks Saleor for each product once", () => {
		const ids = sceneryProductIds();
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(HERO_SCENERY.photo.productId);
	});
});
