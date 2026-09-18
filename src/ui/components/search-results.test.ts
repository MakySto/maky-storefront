import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const MESSAGES: Record<string, string> = {
	"cart.addUnavailable": "Tento produkt momentálne nie je dostupný na objednanie.",
	"product.noImageAvailable": "Bez obrázka",
};
vi.mock("next-intl/server", () => ({
	getTranslations: async (namespace: string) => (key: string) =>
		MESSAGES[`${namespace}.${key}`] ?? `${namespace}.${key}`,
}));

import type { SearchProduct } from "@/lib/search";
import { SearchResultCard } from "./search-results";

const hit = (overrides: Partial<SearchProduct>): SearchProduct => ({
	id: "p1",
	name: "Střešní nosič Nordrive",
	slug: "stresni-nosic-nordrive-cfmp-b-nor-1",
	price: 3490,
	currency: "CZK",
	isPurchasable: true,
	...overrides,
});

async function render(product: SearchProduct, channel: string) {
	return renderToStaticMarkup(await SearchResultCard({ product, channel }));
}

describe("a search hit", () => {
	it("links to the market's own product URL and prints the channel price in that market's format", async () => {
		const html = await render(hit({}), "cz-czk");

		expect(html).toContain('href="/cz/stresni-nosic-nordrive-cfmp-b-nor-1"');
		expect(html).toContain("3 490,00 Kč");
		expect(html).not.toContain("dostupný na objednanie");
	});

	it("stays in the results but says it cannot be ordered when the channel does not sell it", async () => {
		const html = await render(hit({ isPurchasable: false }), "cz-czk");

		expect(html).toContain('href="/cz/stresni-nosic-nordrive-cfmp-b-nor-1"');
		expect(html).toContain("Tento produkt momentálne nie je dostupný na objednanie.");
	});

	it("formats a Slovak price exactly as before", async () => {
		const html = await render(hit({ price: 149.9, currency: "EUR", slug: "stresny-nosic" }), "sk-eur");

		expect(html).toContain("149,90 €");
		expect(html).toContain('href="/sk/stresny-nosic"');
	});
});
