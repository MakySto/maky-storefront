import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KARGO_BASE_SLUG, KARGO_CATEGORY_SLUGS, KARGO_PREVIOUS_SLUG } from "./kargo-slugs";

describe("the Kargo slugs module", () => {
	// `fitment-shelves.ts` and `quote-only.ts` read these while their module loads; they sit in an import cycle with
	// `category-routes.ts`, and the production build (not the test runner) failed with "Cannot access … before
	// initialization" when the constants lived there. A module with no imports cannot be part of a cycle.
	it("imports nothing", () => {
		const source = readFileSync(join(__dirname, "kargo-slugs.ts"), "utf8");
		expect(source).not.toMatch(/^\s*(import|export\s+.*\sfrom)\s/m);
	});

	it("holds the new and the previous slug", () => {
		expect(KARGO_CATEGORY_SLUGS).toEqual([KARGO_BASE_SLUG, KARGO_PREVIOUS_SLUG]);
		expect(KARGO_BASE_SLUG).not.toBe(KARGO_PREVIOUS_SLUG);
	});
});
