import { describe, expect, it } from "vitest";

import { OTHER_CATEGORY_SLUGS, STOREFRONT_CATEGORIES } from "@/config/categories";
import { readCategorySource } from "../../scripts/checks/category-source.mjs";

/**
 * `pnpm check:nav` and `pnpm check:published` are plain node and cannot import the TypeScript, so they
 * read the two literals in `src/config/categories.ts` as text. A reader that quietly finds nothing — or
 * the wrong thing after someone reshapes the literal — would turn both checks into no-ops that still
 * exit 0, which is worse than no check. This pins the reader against the module itself.
 */
describe("scripts/checks/category-source.mjs", () => {
	it("reads the catalogue exactly as the module holds it", () => {
		const { catalogue } = readCategorySource();
		expect(catalogue).toEqual(
			STOREFRONT_CATEGORIES.map(({ slug, key, surfaces }) => ({ slug, key, surfaces: [...surfaces] })),
		);
	});

	it("reads the slug of every other category Saleor holds", () => {
		const { other } = readCategorySource();
		expect(other.length).toBeGreaterThan(0);
		expect(other).toEqual([...OTHER_CATEGORY_SLUGS]);
	});
});
