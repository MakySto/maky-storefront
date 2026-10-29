import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/ui/components/wishlist/wishlist-button", () => ({ WishlistButton: () => null }));
// The one-click add is a client form with its own translation context; what matters here is that the
// card hands it the right market and variant.
vi.mock("@/ui/components/plp/listing-add-to-cart", () => ({
	ListingAddToCart: ({ channel, variantId }: { channel: string; variantId: string }) =>
		createElement("button", { "data-add": `${channel}:${variantId}` }, "Do košíka"),
}));

import type { FitmentOffer } from "@/lib/fitment/offers";
import { OfferCard, type OfferCardLabels } from "./offer-card";

const labels: OfferCardLabels = {
	viewSet: "Zobraziť zostavu",
	completeSet: "Kompletná zostava",
	noPhoto: "Bez fotografie",
	roof: (roof) => `Strecha: ${roof}`,
	years: (years) => `Roky: ${years}`,
	price: { unavailable: "Cena nie je k dispozícii" },
	availability: {
		inStock: "Skladom",
		onOrder: "Na objednávku",
		outOfStock: "Nedostupné",
		notPurchasable: "Momentálne nedostupné",
	},
};

const offer: FitmentOffer = {
	saleorProductId: "p1",
	saleorVariantId: "v1",
	externalReference: "cfm:product:1",
	productKind: "roof-rack-set",
	name: "Nordrive Silenzio Silver",
	slug: "nordrive-silenzio-silver",
	thumbnailUrl: "https://example.test/a.jpg",
	thumbnailAlt: null,
	hoverImageUrl: "https://example.test/b.jpg",
	brand: "Nordrive",
	categoryName: "Strešné nosiče",
	price: { amount: 189.9, currency: "EUR" },
	availability: "on-demand",
	completeSetIncludes: null,
	facets: null,
	isPurchasable: true,
	isDemo: false,
};

const render = (over: Partial<FitmentOffer> = {}, props: Record<string, unknown> = {}) =>
	renderToStaticMarkup(
		createElement(OfferCard, {
			offer: { ...offer, ...over },
			href: "/sk/nordrive-silenzio-silver",
			fit: null,
			specs: [],
			includes: null,
			complete: false,
			labels,
			locale: "sk-SK",
			...props,
		}),
	);

describe("OfferCard", () => {
	it("shows maker, name, price and a way on to the set", () => {
		const html = render();
		expect(html).toContain("Nordrive");
		expect(html).toContain("Nordrive Silenzio Silver");
		expect(html).toMatch(/189,90/);
		expect(html).toContain("Zobraziť zostavu");
		expect(html).toContain('href="/sk/nordrive-silenzio-silver"');
	});

	it("never calls an on-demand set 'Skladom'", () => {
		const html = render({ availability: "on-demand" });
		expect(html).toContain("Na objednávku");
		expect(html).not.toContain("Skladom");
	});

	it("says 'Skladom' only for a set the catalogue holds", () => {
		expect(render({ availability: "in-stock" })).toContain("Skladom");
	});

	it("withholds availability when the catalogue says nothing, and for a set that cannot be bought", () => {
		const unknown = render({ availability: "unknown" as FitmentOffer["availability"] });
		expect(unknown).not.toContain("Skladom");
		expect(unknown).not.toContain("Na objednávku");
		const blocked = render({ isPurchasable: false, availability: "in-stock" });
		expect(blocked).toContain("Momentálne nedostupné");
		expect(blocked).not.toContain("Skladom");
	});

	it("does not borrow another price when it has none", () => {
		const html = render({ price: null });
		expect(html).toContain("Cena nie je k dispozícii");
		expect(html).not.toMatch(/\d+,\d{2}\s*€/);
	});

	it("prints the fit as a statement of the set, never a green promise", () => {
		const html = render({}, { fit: { roof: "Integrované pozdĺžniky", years: "2018 – 2021" } });
		expect(html).toContain("Strecha: Integrované pozdĺžniky · Roky: 2018 – 2021");
		expect(html).not.toMatch(/kompatibiln|overen/i);
	});

	it("wears the complete-set badge only when told it is complete", () => {
		expect(render()).not.toContain("Kompletná zostava");
		expect(render({}, { complete: true })).toContain("Kompletná zostava");
	});

	it("says there is no photograph instead of showing a broken one", () => {
		const html = render({ thumbnailUrl: null, hoverImageUrl: null });
		expect(html).toContain("Bez fotografie");
		expect(html).not.toContain("<img");
	});

	it("keeps a demo set off the favourites", () => {
		expect(render({ isDemo: true })).not.toContain("wishlist");
	});

	it("says the car and the years once, under a short name, when the name can be taken apart", () => {
		const html = render(
			{ name: "Strešný nosič Nordrive Silenzio Silver Dacia Bigster (2025–) — Klasické lyžiny" },
			{
				title: { model: "Nordrive Silenzio Silver", vehicle: "Dacia Bigster" },
				fit: { roof: "Klasické lyžiny", years: "od 2025" },
			},
		);
		expect(html).toContain(">Nordrive Silenzio Silver<");
		expect(html).toContain("Dacia Bigster");
		expect(html).toContain("od 2025");
		expect(html).toContain("Klasické lyžiny");
		// the long name, and the second statement of the same facts, are gone from the text (the
		// photograph's alt text keeps the catalogue's full name for assistive technology)
		const heading = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)![1]!.replace(/<[^>]+>/g, "");
		expect(heading).toBe("Nordrive Silenzio Silver");
		expect(html).not.toContain("Strecha:");
		// the maker is not printed over the name again on a wide screen (the line is phone-only, below)
		expect(html.match(/<p[^>]*data-testid="offer-kicker"[^>]*class="[^"]*sm:hidden/)).toBeNull();
	});

	describe("the line over the name on a phone", () => {
		it("says who made the set and the shelf it sits on, without repeating the maker in the shelf", () => {
			const html = render(
				{ brand: "Nordrive", categoryName: "Nordrive strešné nosiče" },
				{ title: { model: "Nordrive Quadra Black", vehicle: "BMW Rad 5 Touring G31" } },
			);
			const kicker = html.match(/<p[^>]*data-testid="offer-kicker"[^>]*>([\s\S]*?)<\/p>/);
			expect(kicker).not.toBeNull();
			expect(kicker![0]).toContain("sm:hidden");
			expect(kicker![1]!.replace(/<[^>]+>/g, "")).toBe("Nordrive · Strešné nosiče");
		});

		it("comes first in the facts, before the name, the car, the roof", () => {
			const html = render(
				{ brand: "Nordrive", categoryName: "Strešné nosiče" },
				{
					title: { model: "Nordrive Quadra Black", vehicle: "BMW Rad 5 Touring G31" },
					fit: { roof: "Integrované pozdĺžniky", years: "2017 – 2024" },
				},
			);
			const at = (marker: string) => html.indexOf(marker);
			expect(at('data-testid="offer-kicker"')).toBeGreaterThan(-1);
			expect(at('data-testid="offer-kicker"')).toBeLessThan(at("<h3"));
			expect(at("<h3")).toBeLessThan(at('data-testid="offer-vehicle"'));
			expect(at('data-testid="offer-vehicle"')).toBeLessThan(at('data-testid="offer-roof"'));
		});

		it("is not there for a set with neither a maker nor a shelf", () => {
			expect(render({ brand: null, categoryName: null })).not.toContain("offer-kicker");
		});
	});

	it("keeps the whole name and the fit line when the name cannot be taken apart", () => {
		const html = render({}, { fit: { roof: "Integrované pozdĺžniky", years: "2018 – 2021" } });
		expect(html).toContain("Nordrive Silenzio Silver");
		expect(html).toContain("Strecha: Integrované pozdĺžniky · Roky: 2018 – 2021");
	});

	describe("the action", () => {
		it("opens the set's page when the card may not add to the cart itself", () => {
			const html = render({}, { directAdd: null });
			expect(html).toContain("Zobraziť zostavu");
			expect(html).not.toContain("data-add");
		});

		it("adds to the cart in the page's market where nothing is left to choose", () => {
			const html = render({ availability: "in-stock" }, { directAdd: { channel: "sk-eur" } });
			expect(html).toContain('data-add="sk-eur:v1"');
			expect(html).not.toContain("Zobraziť zostavu");
		});

		it("adds an on-demand set too — the catalogue sells it to order", () => {
			expect(render({ availability: "on-demand" }, { directAdd: { channel: "sk-eur" } })).toContain(
				"data-add",
			);
		});

		it.each([
			["sold out", { availability: "out-of-stock" as const }],
			["not purchasable here", { isPurchasable: false }],
			["a demo set", { isDemo: true }],
		])("never adds %s: it opens the set's page", (_label, over) => {
			const html = render(over, { directAdd: { channel: "sk-eur" } });
			expect(html).not.toContain("data-add");
			expect(html).toContain("Zobraziť zostavu");
		});
	});
});
