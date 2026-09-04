import { describe, expect, it } from "vitest";

import { getGalleryImages, type GalleryMedia } from "./gallery-images";

const image = (id: number): GalleryMedia => ({
	id: `TWVkaWE6${id}`,
	url: `https://cdn.example/${id}.jpg`,
	alt: `Obrázok ${id}`,
	type: "IMAGE",
});

describe("getGalleryImages", () => {
	it("returns the full product gallery for a single-variant product", () => {
		// The CFM catalog shape: one sale-to-order variant, with only the primary
		// image assigned to it. The gallery must still be all 11 images.
		const media = Array.from({ length: 11 }, (_, index) => image(index));
		const variant = { media: [media[0]] };

		const gallery = getGalleryImages({ media, variants: [variant] }, variant);

		expect(gallery).toHaveLength(11);
		expect(gallery[0].url).toBe(media[0].url);
	});

	it("preserves Saleor's media order and takes ALT from Saleor", () => {
		const media = [image(1), image(2), image(3)];

		const gallery = getGalleryImages({ media, variants: [{}] }, null);

		expect(gallery.map((row) => row.url)).toEqual(media.map((row) => row.url));
		expect(gallery.map((row) => row.alt)).toEqual(["Obrázok 1", "Obrázok 2", "Obrázok 3"]);
	});

	it("never duplicates a thumbnail alongside the gallery", () => {
		const media = [image(1), image(2)];

		const gallery = getGalleryImages(
			{ media, thumbnail: { url: media[0].url, alt: "thumb" }, variants: [{}] },
			null,
		);

		expect(gallery).toHaveLength(2);
		expect(new Set(gallery.map((row) => row.url)).size).toBe(2);
	});

	it("stays usable with a single image", () => {
		const gallery = getGalleryImages({ media: [image(1)], variants: [{}] }, null);
		expect(gallery).toHaveLength(1);
	});

	it("still lets a multi-variant product show its own variant images", () => {
		const media = [image(1), image(2), image(3)];
		const variant = { media: [media[2]] };

		const gallery = getGalleryImages({ media, variants: [variant, {}] }, variant);

		expect(gallery).toEqual([{ id: media[2].id, url: media[2].url, alt: media[2].alt }]);
	});

	it("drops non-image media", () => {
		const media = [image(1), { url: "https://youtu.be/x", alt: null, type: "VIDEO" }];

		expect(getGalleryImages({ media, variants: [{}] }, null)).toHaveLength(1);
	});

	it("falls back to the thumbnail when there is no media at all", () => {
		const gallery = getGalleryImages(
			{ media: [], thumbnail: { url: "https://cdn.example/t.jpg", alt: "t" }, variants: [{}] },
			null,
		);

		expect(gallery).toEqual([{ url: "https://cdn.example/t.jpg", alt: "t" }]);
	});

	it("returns nothing when the product has no imagery", () => {
		expect(getGalleryImages({ media: [], variants: [{}] }, null)).toEqual([]);
	});
});

describe("stable media identity", () => {
	it("carries Saleor's media id through to the gallery", () => {
		// The carousel keys on this instead of url+index, and it is the key the
		// localized-ALT contract with CFM is specified against. Saleor's `url` is
		// a size-parameterised rendition, not an identity.
		const media = [image(1), image(2), image(3)];

		const gallery = getGalleryImages({ media, variants: [{}] }, null);

		expect(gallery.map((row) => row.id)).toEqual(["TWVkaWE61", "TWVkaWE62", "TWVkaWE63"]);
	});

	it("leaves the thumbnail fallback without a media id", () => {
		// The thumbnail is a rendition, not a media row — inventing an id for it
		// would put a key in the contract that CFM can never match.
		const gallery = getGalleryImages(
			{ media: [], thumbnail: { url: "https://cdn.example/t.jpg", alt: "t" }, variants: [{}] },
			null,
		);

		expect(gallery[0].id).toBeUndefined();
	});
});
