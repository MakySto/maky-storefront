import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPlaceholderProductImage, publishableProductImage } from "./product-image";

/** Real URL of the grey "no image" GIF, as Saleor served it on 2026-09-22. */
const PLACEHOLDER_THUMBNAIL =
	"https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff_thumbnail_4.gif";

describe("isPlaceholderProductImage", () => {
	it("recognises the placeholder's thumbnail", () => {
		expect(isPlaceholderProductImage(PLACEHOLDER_THUMBNAIL)).toBe(true);
	});

	it("recognises any rendition that carries the content hash, in any case", () => {
		expect(
			isPlaceholderProductImage(
				"https://cdn.maky.store/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff.gif",
			),
		).toBe(true);
		expect(
			isPlaceholderProductImage(
				"https://cdn.maky.store/thumbnails/products/C32BC543A46F5BF4EFF3BECB79DFFC196D598106AE2608C85B48516_thumbnail_1024.webp",
			),
		).toBe(true);
	});

	it("recognises the warning pictogram shared by 51 galleries", () => {
		// G3 Arjes 280's gallery on 2026-09-24: the GIF, then this, then the photos.
		expect(
			isPlaceholderProductImage(
				"https://cdn.maky.store/thumbnails/products/74d87407e70262632946f6615847ed4d07583994a14aec829117ada_cf28b9af_thumbnail_4.png",
			),
		).toBe(true);
	});

	it("leaves real product photos alone — small ones included", () => {
		for (const url of [
			"https://cdn.maky.store/products/nordrive-snap-alu-bars_1a2b3c.jpg",
			"https://cdn.maky.store/thumbnails/products/thule-motion-3-xxl_thumbnail_1024.webp",
			"https://cdn.maky.store/thumbnails/products/menabo-mania-100x100_thumbnail_4.gif",
			"https://api.maky.store/thumbnail/UHJvZHVjdE1lZGlhOjEyMw==/1024/webp/",
		]) {
			expect(isPlaceholderProductImage(url), url).toBe(false);
		}
	});

	it("reads the path, not a query string that happens to mention the hash", () => {
		expect(isPlaceholderProductImage("https://cdn.maky.store/products/real.jpg?ref=c32bc543a46f5bf4")).toBe(
			false,
		);
	});

	it("is false for nothing, and for the storefront's own relative placeholder", () => {
		for (const url of [undefined, null, "", "/placeholder.svg"]) {
			expect(isPlaceholderProductImage(url)).toBe(false);
		}
	});
});

describe("publishableProductImage", () => {
	it("passes a real image through and refuses the placeholder and nothing alike", () => {
		const real = "https://cdn.maky.store/products/nordrive-snap-alu-bars_1a2b3c.jpg";
		expect(publishableProductImage(real)).toBe(real);
		expect(publishableProductImage(PLACEHOLDER_THUMBNAIL)).toBeNull();
		expect(publishableProductImage(undefined)).toBeNull();
		expect(publishableProductImage("")).toBeNull();
	});
});

describe("one module knows the hash", () => {
	it("no other source file spells it out", () => {
		// A second copy of the predicate would be a second place to forget.
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const full = path.join(dir, entry);
				if (statSync(full).isDirectory()) {
					if (entry === "gql" || entry === "generated") continue;
					walk(full);
				} else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
					if (readFileSync(full, "utf8").includes("c32bc543a46f5bf4")) offenders.push(full);
				}
			}
		};
		walk(path.join(process.cwd(), "src"));
		expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual(["src/lib/product-image.ts"]);
	});
});
