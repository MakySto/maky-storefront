import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { addConfiguredSetToCart } = vi.hoisted(() => ({
	addConfiguredSetToCart: vi.fn(),
}));

vi.mock("@/lib/fitment/cart-actions", () => ({ addConfiguredSetToCart }));
vi.mock("next/navigation", () => ({
	useParams: () => ({ channel: "us-usd" }),
	useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", () => ({
	useTranslations: (namespace: string) => (key: string) => {
		const messages: Record<string, string> = {
			"cart.addUnavailable": "This product is not available to order right now.",
			"common.onDemand": "Made to order",
			"common.outOfStock": "Out of stock",
			"configurator.addAgain": "Add again",
			"configurator.addToCart": "Add to cart",
			"configurator.cardVerifiedFit": "Verified for your vehicle",
			"configurator.viewProduct": "View product",
		};
		return messages[`${namespace}.${key}`] ?? `${namespace}.${key}`;
	},
}));

import { ConfiguratorResults, type ResultCard } from "./configurator-results";

const catalogOnlyCard: ResultCard = {
	offer: {
		saleorProductId: "product-1",
		saleorVariantId: "variant-1",
		externalReference: "catalog-1",
		productKind: "roof-rack-set",
		name: "Catalog roof rack",
		slug: "catalog-roof-rack",
		thumbnailUrl: null,
		thumbnailAlt: null,
		categoryName: "Roof racks",
		price: { amount: 189.99, currency: "USD" },
		availability: "on-demand",
		completeSetIncludes: null,
		facets: null,
		isPurchasable: false,
		isDemo: false,
	},
	conditions: [],
	unresolvedConditions: 0,
	verdict: "VERIFIED_FIT",
	supplier: null,
};

describe("ConfiguratorResults catalog-only offer", () => {
	it("keeps the offer and price visible but exposes no purchase or on-demand promise", () => {
		const html = renderToStaticMarkup(
			createElement(ConfiguratorResults, {
				channel: "us-usd",
				locale: "en-US",
				cards: [catalogOnlyCard],
			}),
		);

		expect(html).toContain("Catalog roof rack");
		expect(html).toContain("$189.99");
		expect(html).toContain("This product is not available to order right now.");
		expect(html).toContain("View product");
		expect(html).toMatch(
			/<button[^>]*disabled=""[^>]*>[^<]*This product is not available to order right now\.<\/button>/,
		);
		expect(html).not.toContain("Made to order");
		expect(html).not.toContain(">Add to cart<");
		expect(html).not.toContain(">Add again<");
		expect(addConfiguredSetToCart).not.toHaveBeenCalled();
	});
});
