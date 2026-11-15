import { beforeEach, describe, expect, it } from "vitest";

import { KARGO_BASE_SLUG } from "@/config/kargo-slugs";
import { buildProductJsonLd } from "@/lib/seo/json-ld";
import { productJsonLdOptions } from "@/lib/seo/product-jsonld-options";
import { getGalleryImages } from "@/ui/components/pdp/gallery-images";
import { DESCRIPTION_MAX, type FeedProduct, type FeedVariant, TITLE_MAX, clip, feedItemsFor } from "./item";

/**
 * A feed item is what the product page says, in another format. The first block holds the two to that:
 * for the same product, the item and the page's structured data state the same price, availability, URL
 * and GTIN. The rest is what only a feed has: what is left out, the bundle, the weight, the texts.
 */

const MANUFACTURER = "cfm:attribute:manufacturer";
const EAN = "4006381333931";
const BARS_EAN = "7313020079820";

const variant = (over: Partial<FeedVariant> = {}): FeedVariant => ({
	id: "UHJvZHVjdFZhcmlhbnQ6MQ==",
	name: "639901",
	ean: null,
	quantityAvailable: 50,
	trackInventory: false,
	metafield: "sale_to_order",
	pricing: {
		price: { gross: { amount: 899, currency: "EUR" } },
		priceUndiscounted: { gross: { amount: 899, currency: "EUR" } },
	},
	...over,
});

const product = (over: Partial<FeedProduct> = {}): FeedProduct => ({
	id: "UHJvZHVjdDox",
	name: "Strešný box Thule Motion 3 XXL",
	slug: "stresny-box-thule-motion-3-xxl-639901",
	description: JSON.stringify({
		blocks: [{ type: "paragraph", data: { text: "Box pre <b>celú rodinu</b> &amp; lyže." } }],
	}),
	seoDescription: "Krátky popis",
	isAvailableForPurchase: true,
	category: { id: "Q2F0ZWdvcnk6MQ==", slug: "stresne-boxy", name: "Strešné boxy" },
	attributes: [{ attribute: { externalReference: MANUFACTURER }, values: [{ name: "Thule" }] }],
	media: [
		{ id: "m1", url: "https://media.maky.store/a.jpg", type: "IMAGE", sortOrder: 0 },
		{ id: "m2", url: "https://media.maky.store/b.jpg", type: "IMAGE", sortOrder: 1 },
	],
	variants: [variant()],
	pricing: {
		priceRange: {
			start: { gross: { amount: 899, currency: "EUR" } },
			stop: { gross: { amount: 899, currency: "EUR" } },
		},
	},
	...over,
});

const only = (p: FeedProduct, channel = "sk-eur") => {
	const outcome = feedItemsFor(p, channel);
	expect(outcome.skipped).toBeNull();
	expect(outcome.items).toHaveLength(1);
	return outcome.items[0]!;
};

/** The page's structured data for the same product, as the page builds it. */
const pageOffer = (p: FeedProduct, channel = "sk-eur") => {
	const jsonLd = buildProductJsonLd(
		productJsonLdOptions(p, channel, getGalleryImages(p, p.variants?.[0] ?? null)),
	) as unknown as {
		gtin13?: string;
		brand?: { name: string };
		offers: { url: string; price: number; priceCurrency: string; availability: string };
	};
	return jsonLd;
};

const SCHEMA_OF = {
	in_stock: "https://schema.org/InStock",
	out_of_stock: "https://schema.org/OutOfStock",
	backorder: "https://schema.org/BackOrder",
} as const;

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
});

describe("a feed item says what the product page says", () => {
	const cases: [string, FeedProduct][] = [
		["made to order", product()],
		[
			"tracked stock on the shelf",
			product({ variants: [variant({ trackInventory: true, quantityAvailable: 3 })] }),
		],
		[
			"tracked stock, none left",
			product({ variants: [variant({ trackInventory: true, quantityAvailable: 0 })] }),
		],
		["no availability mode", product({ variants: [variant({ metafield: null })] })],
		["a product with an EAN", product({ variants: [variant({ ean: EAN })] })],
	];

	it.each(cases)("%s: price, availability, URL, brand and GTIN agree", (_label, p) => {
		const item = only(p);
		const page = pageOffer(p);

		expect(item.link).toBe(page.offers.url);
		expect(item.price).toEqual({ amount: page.offers.price, currency: page.offers.priceCurrency });
		expect(SCHEMA_OF[item.availability]).toBe(page.offers.availability);
		expect(item.brand).toBe(page.brand?.name);
		expect(item.gtin).toBe(page.gtin13);
	});

	it("uses the market's own URL and currency abroad", () => {
		const item = only(
			product({
				slug: "dachbox-thule-motion-3-xxl-639901",
				variants: [variant({ pricing: { price: { gross: { amount: 22990, currency: "CZK" } } } })],
			}),
			"cz-czk",
		);
		expect(item.link).toBe("https://maky.store/cz/dachbox-thule-motion-3-xxl-639901");
		expect(item.price).toEqual({ amount: 22990, currency: "CZK" });
	});
});

describe("availability", () => {
	it("dates a made-to-order item with the longest wait the badge names: 10 working days in the EU", () => {
		const item = only(product());
		expect(item.availability).toBe("backorder");
		expect(item.backorderWorkingDays).toBe(10);
	});

	it("14 working days in the United States and Canada", () => {
		expect(only(product(), "us-usd").backorderWorkingDays).toBe(14);
		expect(only(product(), "ca-cad").backorderWorkingDays).toBe(14);
	});

	it("gives no wait to an item that is on the shelf or sold out", () => {
		const shelf = only(product({ variants: [variant({ trackInventory: true, quantityAvailable: 3 })] }));
		expect(shelf.availability).toBe("in_stock");
		expect(shelf.backorderWorkingDays).toBeUndefined();

		const gone = only(product({ variants: [variant({ quantityAvailable: 0 })] }));
		expect(gone.availability).toBe("out_of_stock");
		expect(gone.backorderWorkingDays).toBeUndefined();
	});
});

describe("what is left out of the feed", () => {
	it("a product the market shows and does not sell", () => {
		expect(feedItemsFor(product({ isAvailableForPurchase: false }), "us-usd")).toEqual({
			items: [],
			skipped: "not-purchasable",
		});
	});

	it("a product with a quote button in place of the price", () => {
		const kargo = product({
			isAvailableForPurchase: false,
			category: { id: "x", slug: KARGO_BASE_SLUG, name: "Kargo" },
		});
		expect(feedItemsFor(kargo, "us-usd").skipped).toBe("not-purchasable");
	});

	it("a product without a price", () => {
		expect(feedItemsFor(product({ variants: [variant({ pricing: null })] }), "sk-eur").skipped).toBe(
			"no-price",
		);
		expect(feedItemsFor(product({ variants: [] }), "sk-eur").skipped).toBe("no-price");
	});

	it("a product whose only picture is the 'no image' placeholder", () => {
		const p = product({
			media: [{ url: "https://media.maky.store/c32bc543a46f5bf4.gif", type: "IMAGE" }],
			thumbnail: { url: "https://media.maky.store/thumbnails/c32bc543a46f5bf4.webp" },
		});
		expect(feedItemsFor(p, "sk-eur").skipped).toBe("no-image");
	});

	it("a product without a manufacturer, which Google requires", () => {
		expect(feedItemsFor(product({ attributes: [] }), "sk-eur").skipped).toBe("no-brand");
		expect(
			feedItemsFor(
				product({
					attributes: [{ attribute: { externalReference: MANUFACTURER }, values: [{ name: "  " }] }],
				}),
				"sk-eur",
			).skipped,
		).toBe("no-brand");
	});

	it("never takes the category for the brand", () => {
		const p = product({
			attributes: [{ attribute: { externalReference: "cfm:attribute:colour" }, values: [{ name: "Black" }] }],
		});
		expect(feedItemsFor(p, "sk-eur").skipped).toBe("no-brand");
	});
});

describe("identifiers", () => {
	it("uses the variant id, never the visible code and never the internal SKU", () => {
		const item = only(product());
		expect(item.id).toBe("UHJvZHVjdFZhcmlhbnQ6MQ==");
		expect(JSON.stringify(item)).not.toContain("CFMP-");
	});

	it("refuses a number that is not a GTIN", () => {
		expect(only(product({ variants: [variant({ ean: "1234567890123" })] })).gtin).toBeUndefined();
		// Restricted circulation: valid check digit, not a GTIN a search engine takes.
		expect(only(product({ variants: [variant({ ean: "2000000000008" })] })).gtin).toBeUndefined();
	});

	it("marks a set as a bundle and gives it the EAN of its bars, the main part", () => {
		const parts = JSON.stringify([
			{ code: "710410", role: "feet", ean: EAN, qty: 1 },
			{ code: "711300", role: "bars", ean: BARS_EAN, qty: 1 },
		]);
		const item = only(product({ variants: [variant({ componentEans: parts })] }));
		expect(item.isBundle).toBe(true);
		expect(item.gtin).toBe(BARS_EAN);
	});

	it("a set whose bars have no EAN is a bundle without a GTIN, not a bundle with the feet's", () => {
		const parts = JSON.stringify([{ code: "710410", role: "feet", ean: EAN, qty: 1 }]);
		const item = only(product({ variants: [variant({ componentEans: parts })] }));
		expect(item.isBundle).toBe(true);
		expect(item.gtin).toBeUndefined();
	});

	it("an ordinary product is not a bundle", () => {
		expect(only(product()).isBundle).toBeUndefined();
	});
});

describe("price", () => {
	it("states the price before a discount as the price and the current one as the sale price", () => {
		const item = only(
			product({
				variants: [
					variant({
						pricing: {
							price: { gross: { amount: 799, currency: "EUR" } },
							priceUndiscounted: { gross: { amount: 899, currency: "EUR" } },
						},
					}),
				],
			}),
		);
		expect(item.price).toEqual({ amount: 899, currency: "EUR" });
		expect(item.salePrice).toEqual({ amount: 799, currency: "EUR" });
	});

	it("has no sale price without a discount", () => {
		expect(only(product()).salePrice).toBeUndefined();
	});
});

describe("texts, pictures and weight", () => {
	it("reads the description as plain text, entities and markup resolved", () => {
		expect(only(product()).description).toBe("Box pre celú rodinu & lyže.");
	});

	it("falls back to the short description, then the name", () => {
		expect(only(product({ description: null })).description).toBe("Krátky popis");
		expect(only(product({ description: null, seoDescription: null })).description).toBe(
			"Strešný box Thule Motion 3 XXL",
		);
	});

	it("keeps the texts inside Google's limits", () => {
		const long = "slovo ".repeat(2000);
		const item = only(
			product({
				name: "N".repeat(400),
				description: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: long } }] }),
			}),
		);
		expect(item.title.length).toBeLessThanOrEqual(TITLE_MAX);
		expect(item.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
		expect(item.description.endsWith("slovo")).toBe(true);
	});

	it("clips at a word, or hard when there is none near the end", () => {
		expect(clip("one two three four", 15)).toBe("one two three");
		expect(clip("abcdefghij", 5)).toBe("abcde");
		expect(clip("short", 50)).toBe("short");
	});

	it("gives the first picture as the main one and the rest as additional", () => {
		const item = only(product());
		expect(item.imageLink).toBe("https://media.maky.store/a.jpg");
		expect(item.additionalImageLinks).toEqual(["https://media.maky.store/b.jpg"]);
	});

	it("names the category as the product type", () => {
		expect(only(product()).productType).toBe("Strešné boxy");
	});

	it("states the weight in a unit Google reads, and nothing for none", () => {
		expect(
			only(product({ variants: [variant({ weight: { value: 26.5, unit: "KG" } })] })).shippingWeight,
		).toEqual({
			value: 26.5,
			unit: "kg",
		});
		expect(
			only(product({ variants: [variant({ weight: { value: 0.03, unit: "TONNE" } })] })).shippingWeight,
		).toEqual({
			value: 30,
			unit: "kg",
		});
		expect(
			only(product({ variants: [variant({ weight: { value: 0, unit: "KG" } })] })).shippingWeight,
		).toBeUndefined();
		expect(only(product()).shippingWeight).toBeUndefined();
	});
});

describe("a product with a real choice of variants", () => {
	const twoVariants = product({
		variants: [
			variant({ id: "v1", name: "M-100" }),
			variant({
				id: "v2",
				name: "L-200",
				pricing: { price: { gross: { amount: 999, currency: "EUR" } } },
			}),
		],
	});

	it("is one item per variant, grouped by the product, each at its own URL and price", () => {
		const { items } = feedItemsFor(twoVariants, "sk-eur");
		expect(items.map((item) => item.id)).toEqual(["v1", "v2"]);
		expect(new Set(items.map((item) => item.itemGroupId))).toEqual(new Set(["UHJvZHVjdDox"]));
		expect(items[1]!.link).toBe("https://maky.store/sk/stresny-box-thule-motion-3-xxl-639901?variant=v2");
		expect(items[1]!.price.amount).toBe(999);
		expect(items[1]!.title).toBe("Strešný box Thule Motion 3 XXL, L-200");
	});
});
