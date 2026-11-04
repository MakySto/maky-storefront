import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
		const messages: Record<string, string> = {
			"fitment.cardRoof": "Strecha: {roof}",
			"fitment.cardYears": "Roky: {years}",
			"common.viewDetail": "Zobraziť",
		};
		const template = messages[`${namespace}.${key}`] ?? `${namespace}.${key}`;
		return template.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? "");
	},
}));
vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

import { ProductCard, type ProductCardData } from "./product-card";

/**
 * The listing card says which roof and which years a set is made for — two facts its title buries
 * at its end — and says them as facts about the SET, with or without a car chosen.
 */
const product: ProductCardData = {
	id: "product-1",
	name: "Strešný nosič Thule WingBar Evo silver BMW X5 E70 2011-2013 klasické lyžiny",
	slug: "thule-x5",
	variantId: "variant-1",
	quantityAvailable: 50,
	price: 329.9,
	currency: "EUR",
	image: "",
	href: "/thule-x5",
	channel: "sk-eur",
	isPurchasable: true,
};

describe("ProductCard — what the set is for", () => {
	it("prints the roof and the years from the application", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, {
				product: { ...product, fit: { roof: "Pozdĺžniky nad strechou", years: "2011 – 2013" } },
			}),
		);
		expect(html).toContain('data-testid="card-fit"');
		expect(html).toContain("Strecha: Pozdĺžniky nad strechou");
		expect(html).toContain("Roky: 2011 – 2013");
	});

	it("never says the set FITS — a statement about the set, not about anybody's car", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, {
				product: { ...product, fit: { roof: "Holá strecha", years: "od 2024" } },
			}),
		);
		const line = html.match(/data-testid="card-fit"[^>]*>(.*?)<\/p>/s)?.[1] ?? "";
		expect(line).not.toMatch(/pasuj|overen|kompatibil|fits|verified/i);
	});

	it("prints the years alone when the application names no roof", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, { product: { ...product, fit: { roof: null, years: "2020" } } }),
		);
		expect(html).toContain("Roky: 2020");
		expect(html).not.toContain("Strecha:");
	});

	it("adds nothing to a product the programme has no row for", () => {
		for (const fit of [undefined, null]) {
			const html = renderToStaticMarkup(createElement(ProductCard, { product: { ...product, fit } }));
			expect(html).not.toContain('data-testid="card-fit"');
			expect(html).not.toContain("Roky:");
		}
	});
});

describe("ProductCard — the line over a set's name on a phone", () => {
	const set: ProductCardData = {
		...product,
		name: "Strešný nosič Nordrive Helio Black BMW Rad 5 Touring G31 (2017–2024) — Integrované lyžiny",
		brand: "Nordrive",
		category: { id: "c1", name: "Nordrive strešné nosiče", slug: "nordrive-stresne-nosice" },
		fit: { roof: "Integrované pozdĺžniky", years: "2017 – 2024" },
		setTitle: { model: "Nordrive Helio Black", vehicle: "BMW Rad 5 Touring G31" },
	};

	it("says who made a set taken apart and the shelf, on a phone only", () => {
		const html = renderToStaticMarkup(createElement(ProductCard, { product: set }));
		const line = html.match(/<p class="[^"]*sm:hidden[^"]*">(.*?)<\/p>/s)?.[1] ?? "";
		expect(line.replace(/<[^>]+>/g, "")).toBe("Nordrive · Strešné nosiče");
		// the order a phone reader goes down: the line, the name, the car, the roof
		const at = (marker: string) => html.indexOf(marker);
		expect(at("sm:hidden")).toBeLessThan(at("<h2"));
		expect(at("<h2")).toBeLessThan(at('data-testid="card-vehicle"'));
	});

	it("keeps the quiet line, for every width, over a name that is printed whole", () => {
		const html = renderToStaticMarkup(
			createElement(ProductCard, {
				product: { ...set, fit: null, setTitle: null, name: "Strešný box Thule Motion XT L", brand: "Thule" },
			}),
		);
		expect(html).not.toContain("sm:hidden");
	});
});
