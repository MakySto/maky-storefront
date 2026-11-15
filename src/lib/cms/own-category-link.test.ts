import { afterEach, describe, expect, it } from "vitest";
import { LIVE_CATEGORY_SLUGS_KEY } from "@/config/categories";
import { clearLearnedCategories, publishLearnedCategories } from "@/config/category-routes";
import { canonicalOwnCategoryHref } from "./own-category-link";

const SITE = "https://maky.store";
const href = (url: string) => canonicalOwnCategoryHref(url, SITE);

const live = globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> };

afterEach(() => {
	clearLearnedCategories();
	delete live[LIVE_CATEGORY_SLUGS_KEY];
});

/**
 * Owner, 2026-11-15: no category address with `/categories/` anywhere. The advice guide's button was written in the CMS
 * as `https://maky.store/sk/categories/stresne-nosice`, because a CMS link has to be absolute.
 */
describe("a CMS link to a category of the shop", () => {
	it("written in the retired form is shown at the category's address", () => {
		expect(href("https://maky.store/sk/categories/stresne-nosice")).toBe(
			"https://maky.store/sk/stresne-nosice",
		);
		expect(href("https://maky.store/sk/categories/prislusenstvo-k-stresnym-boxom")).toBe(
			"https://maky.store/sk/prislusenstvo-k-stresnym-boxom",
		);
	});

	it("is shown in the spelling of its market, whether the link names the base slug or the translated one", () => {
		expect(href("https://maky.store/de/categories/stresne-nosice")).toBe("https://maky.store/de/dachtraeger");
		expect(href("https://maky.store/de/categories/dachtraeger")).toBe("https://maky.store/de/dachtraeger");
		expect(href("https://maky.store/at/categories/schneeketten")).toBe("https://maky.store/at/schneeketten");
		expect(href("https://maky.store/cz/categories/stresne-nosice")).toBe(
			"https://maky.store/cz/stresni-nosice",
		);
	});

	it("keeps its query and its fragment", () => {
		expect(href("https://maky.store/sk/categories/stresne-nosice?brand=thule#produkty")).toBe(
			"https://maky.store/sk/stresne-nosice?brand=thule#produkty",
		);
	});

	it("follows what the server has read from Saleor: a category it has not read yet keeps the address that works", () => {
		const unknown = "https://maky.store/sk/categories/a-future-category";
		expect(href(unknown)).toBe(unknown);

		// `categoryRootServes` is the proxy's own condition for the redirect, and this link follows it.
		live[LIVE_CATEGORY_SLUGS_KEY] = new Set(["a-future-category"]);
		expect(href(unknown)).toBe("https://maky.store/sk/a-future-category");
	});

	it("finds a category by the slug Saleor hands a page, when that slug is only an alias of the category", () => {
		publishLearnedCategories([
			{
				baseSlug: "opravne-sady",
				saleorId: "Category:opravne-sady",
				segments: {},
				aliases: { de: ["reparatursaetze"] },
			},
		]);
		expect(href("https://maky.store/de/categories/reparatursaetze")).toBe(
			"https://maky.store/de/opravne-sady",
		);
	});
});

describe("any other link", () => {
	it.each([
		["another site", "https://example.com/sk/categories/stresne-nosice"],
		["a page of the shop", "https://maky.store/sk/poradna"],
		["a category already at its address", "https://maky.store/sk/stresne-nosice"],
		["something below the category", "https://maky.store/sk/categories/stresne-nosice/skoda"],
		["a path that is not a market's", "https://maky.store/xx/categories/stresne-nosice"],
		["the listing without a slug", "https://maky.store/sk/categories"],
		["an address that is not a web address", "mailto:info@maky.store"],
		["text that is not an address at all", "not a url"],
	])("is returned as it came: %s", (_name, url) => {
		expect(href(url)).toBe(url);
	});
});
