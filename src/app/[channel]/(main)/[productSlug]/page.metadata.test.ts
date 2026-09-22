import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A product page's share image: the product's own photo, never the grey "no image" GIF — and
 * the generic card, not nothing, when the GIF is all the product has.
 *
 * `og:image` was `getGalleryImages(product)[0] || product.thumbnail.url`. The gallery now
 * leaves the placeholder out, and that `||` would have put it straight back for the 80
 * Slovak products whose media AND thumbnail are both the GIF. Saleor is replaced at the
 * transport; the slug lookup, the exact-locale boundary and the metadata are real.
 */

const PLACEHOLDER =
	"https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff_thumbnail_4.gif";
const PHOTO = "https://cdn.maky.store/products/autochladnicka-40l.jpg";

let product: Record<string, unknown>;

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async () => ({ ok: true, data: { product } }),
}));
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: () => {},
}));

const media = (url: string, id = "m1") => ({ id, url, alt: "", type: "IMAGE", sortOrder: 0 });

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	product = {
		id: "UHJvZHVjdDox",
		name: "Autochladnička 40 l",
		slug: "autochladnicka-40-l",
		seoTitle: null,
		seoDescription: "Autochladnička na 12 V.",
		description: null,
		translation: null,
		isAvailableForPurchase: true,
		attributes: [],
		category: null,
		pricing: { priceRange: { start: { gross: { amount: 147, currency: "EUR" } }, stop: null } },
		media: [media(PLACEHOLDER)],
		thumbnail: { url: PLACEHOLDER, alt: null },
		variants: [],
	};
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const imagesOf = async () => {
	const { generateMetadata } = await import("./page");
	const meta = await generateMetadata({
		params: Promise.resolve({ channel: "sk-eur", productSlug: "autochladnicka-40-l" }),
	});
	return (meta.openGraph as { images: { url: string; width?: number; height?: number }[] }).images;
};

describe("PDP og:image", () => {
	it("placeholder only: the generic 1200×630 card, never the GIF", async () => {
		expect(await imagesOf()).toEqual([
			{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "MAKY.STORE" },
		]);
	});

	it("placeholder beside a real photo: the photo, with no dimensions claimed", async () => {
		product.media = [media(PLACEHOLDER, "m1"), media(PHOTO, "m2")];
		expect(await imagesOf()).toEqual([{ url: PHOTO, alt: "Autochladnička 40 l" }]);
	});

	it("a real thumbnail still backs a product with no media", async () => {
		product.media = [];
		product.thumbnail = { url: PHOTO, alt: null };
		expect((await imagesOf())[0]!.url).toBe(PHOTO);
	});
});
