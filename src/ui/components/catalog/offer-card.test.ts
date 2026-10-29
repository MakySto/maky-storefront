import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/ui/components/wishlist/wishlist-button", () => ({ WishlistButton: () => null }));

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
	productKind: "roof-rack-bundle",
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
});
