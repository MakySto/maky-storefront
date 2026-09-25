import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ fetchCmsPage: vi.fn() }));

const { sceneryFromBlocks } = await import("./scenery");
const { mergeScenery } = await import("@/lib/homepage/scenery");

/**
 * The owner's scenery page in Payload, read from its blocks: each photo is placed by its anchor
 * ID. The blocks here have the parsed shape the CMS parser hands over (`blocks.ts`).
 */

const media = (url: string, focal: { focalX: number; focalY: number } = { focalX: 50, focalY: 50 }) => ({
	id: url,
	url,
	alt: "",
	width: 2400,
	height: 1200,
	mimeType: "image/jpeg",
	sizes: {},
	...focal,
});
const common = { id: null, blockName: null, markets: null };

describe("CMS scenery", () => {
	it("places each photo by its anchor ID, the first one winning", () => {
		const scenery = sceneryFromBlocks([
			{
				...common,
				blockType: "image",
				anchorId: "home-hero",
				media: media("https://m/hero.jpg"),
				caption: null,
			},
			{
				...common,
				blockType: "image",
				anchorId: "home-hero",
				media: media("https://m/second.jpg"),
				caption: null,
			},
			{
				...common,
				blockType: "hero",
				anchorId: "banner-stresne-boxy",
				heading: "Strešné boxy",
				subheading: null,
				// The editor marked the box on the roof, top right of the picture.
				media: media("https://m/boxes.jpg", { focalX: 72.5, focalY: 20 }),
				links: [],
			},
			{
				...common,
				blockType: "image",
				anchorId: "tile-stresne-nosice",
				media: media("https://m/racks.jpg"),
				caption: null,
			},
			{
				...common,
				blockType: "image",
				anchorId: "Advice",
				media: media("https://m/advice.jpg"),
				caption: null,
			},
		]);
		expect(scenery).toEqual({
			hero: { url: "https://m/hero.jpg", position: "50% 50%" },
			advice: { url: "https://m/advice.jpg", position: "50% 50%" },
			tiles: { "stresne-nosice": { url: "https://m/racks.jpg", position: "50% 50%" } },
			// The focal point travels with the photo (pages contract v3 §2).
			banners: { "stresne-boxy": { url: "https://m/boxes.jpg", position: "72.5% 20%" } },
		});
	});

	it("ignores a block without a placement, without a photo, or with a malformed slug", () => {
		const scenery = sceneryFromBlocks([
			{ ...common, blockType: "image", anchorId: null, media: media("https://m/a.jpg"), caption: null },
			{
				...common,
				blockType: "hero",
				anchorId: "home-hero",
				heading: "x",
				subheading: null,
				media: null,
				links: [],
			},
			{
				...common,
				blockType: "image",
				anchorId: "tile-Strešné boxy",
				media: media("https://m/b.jpg"),
				caption: null,
			},
		]);
		expect(scenery).toEqual({ hero: null, advice: null, tiles: {}, banners: {} });
	});

	it("a published photo replaces the Saleor one for its placement only, and never claims a product", () => {
		const saleorImage = (url: string) => ({
			url,
			position: "40% 60%",
			mobilePosition: "40% 60%",
			source: "saleor" as const,
		});
		const merged = mergeScenery(
			{
				hero: saleorImage("https://cdn/hero.jpg"),
				advice: saleorImage("https://cdn/advice.jpg"),
				tiles: { "stresne-boxy": saleorImage("https://cdn/boxes.jpg") },
				banners: {},
			},
			{
				hero: { url: "https://m/hero.jpg", position: "30% 65%" },
				advice: null,
				tiles: { "stresne-nosice": { url: "https://m/racks.jpg", position: "50% 50%" } },
				banners: {},
			},
		);
		// The editor's focal point, on every screen — never a hard-coded centre.
		expect(merged?.hero).toEqual({
			url: "https://m/hero.jpg",
			position: "30% 65%",
			mobilePosition: "30% 65%",
			source: "cms",
		});
		expect(merged?.advice?.source).toBe("saleor");
		expect(Object.keys(merged?.tiles ?? {}).sort()).toEqual(["stresne-boxy", "stresne-nosice"]);
		expect(mergeScenery(null, null)).toBeNull();
	});
});
