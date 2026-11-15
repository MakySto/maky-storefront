import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildItemListJsonLd } from "./item-list";

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
});
afterEach(() => {
	delete process.env.NEXT_PUBLIC_STOREFRONT_URL;
});

describe("ItemList structured data", () => {
	it("names the products in the page's order, with absolute addresses", () => {
		expect(
			buildItemListJsonLd([
				{ name: "Reťaz A", href: "/sk/retaz-a" },
				{ name: "Reťaz B", href: "https://maky.store/sk/retaz-b" },
			]),
		).toEqual({
			"@context": "https://schema.org",
			"@type": "ItemList",
			numberOfItems: 2,
			itemListElement: [
				{ "@type": "ListItem", position: 1, name: "Reťaz A", url: "https://maky.store/sk/retaz-a" },
				{ "@type": "ListItem", position: 2, name: "Reťaz B", url: "https://maky.store/sk/retaz-b" },
			],
		});
	});

	it("says nothing for a list of one or none", () => {
		expect(buildItemListJsonLd([{ name: "Reťaz A", href: "/sk/retaz-a" }])).toBeNull();
		expect(buildItemListJsonLd([])).toBeNull();
	});
});
