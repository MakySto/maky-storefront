import { describe, expect, it } from "vitest";

import { isRetryableSaleorThumbnail, withImageRetryToken } from "./resilient-product-image";

describe("Saleor thumbnail retry", () => {
	it("targets only the live Saleor on-demand thumbnail endpoint", () => {
		expect(isRetryableSaleorThumbnail("https://api.maky.store/thumbnail/media-id/512/")).toBe(true);
		expect(isRetryableSaleorThumbnail("https://cdn.maky.store/thumbnails/products/example.webp")).toBe(false);
		expect(isRetryableSaleorThumbnail("https://api.maky.store/graphql/")).toBe(false);
		expect(isRetryableSaleorThumbnail("/placeholder.svg")).toBe(false);
	});

	it("adds a cache-busting token while preserving existing query parameters", () => {
		expect(withImageRetryToken("https://api.maky.store/thumbnail/media-id/512/", 0)).toBe(
			"https://api.maky.store/thumbnail/media-id/512/",
		);
		expect(withImageRetryToken("https://api.maky.store/thumbnail/media-id/512/?format=webp", 1)).toBe(
			"https://api.maky.store/thumbnail/media-id/512/?format=webp&_maky_image_retry=1",
		);
	});

	it("does not rewrite non-Saleor image URLs", () => {
		const src = "https://cdn.maky.store/thumbnails/products/example.webp";
		expect(withImageRetryToken(src, 1)).toBe(src);
	});
});
