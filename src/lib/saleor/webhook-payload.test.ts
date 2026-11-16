import { describe, expect, it } from "vitest";
import { parseWebhookPayload } from "./webhook-payload";

/**
 * The parser understood four shapes and dropped everything else into
 * `unknown`, which refreshed only `/{channel}/products`. A corrected Slovak
 * title and a new photograph — the two events a catalogue import produces most
 * — therefore left the product's own page stale for up to an hour.
 */
describe("parseWebhookPayload", () => {
	it("reads a product event", () => {
		expect(
			parseWebhookPayload({ product: { slug: "n60012", category: { slug: "stresne-boxy" } } }),
		).toMatchObject({ kind: "product", slug: "n60012", categorySlug: "stresne-boxy" });
	});

	it("reads a variant event through its product", () => {
		expect(parseWebhookPayload({ productVariant: { product: { slug: "n60012" } } })).toMatchObject({
			kind: "product",
			slug: "n60012",
		});
	});

	it("reads a TRANSLATION_UPDATED event — previously unknown", () => {
		expect(parseWebhookPayload({ translation: { product: { slug: "n60012" } } })).toMatchObject({
			kind: "product",
			slug: "n60012",
		});
	});

	it("reads a translated CATEGORY event — previously unknown", () => {
		expect(parseWebhookPayload({ translation: { category: { slug: "stresne-boxy" } } })).toMatchObject({
			kind: "category",
			slug: "stresne-boxy",
		});
	});

	it("reads a PRODUCT_MEDIA event that names its product", () => {
		expect(parseWebhookPayload({ productMedia: { product: { slug: "n60012" } } })).toMatchObject({
			kind: "product",
			slug: "n60012",
		});
	});

	it("flags a media event that carries only an id, instead of calling it unknown", () => {
		// Nothing can name the detail page, but the listing and the sitemap still
		// have to move — and the operator needs to know the subscription is thin.
		expect(parseWebhookPayload({ productMedia: { id: "UHJvZHVjdE1lZGlhOjIy", productId: "x" } })).toEqual({
			kind: "product",
			unnamedProduct: true,
			channel: undefined,
		});
	});

	it("picks up the previous slug so a rename purges both URLs", () => {
		expect(parseWebhookPayload({ product: { slug: "novy-slug", previousSlug: "stary-slug" } })).toMatchObject(
			{ slug: "novy-slug", previousSlug: "stary-slug" },
		);
	});

	it("accepts oldSlug as well, at either level", () => {
		expect(parseWebhookPayload({ oldSlug: "stary", product: { slug: "novy" } })).toMatchObject({
			previousSlug: "stary",
		});
	});

	it("reads a channel given as an object or a bare string", () => {
		expect(parseWebhookPayload({ product: { slug: "a", channel: { slug: "sk-eur" } } }).channel).toBe(
			"sk-eur",
		);
		expect(parseWebhookPayload({ product: { slug: "a", channel: "sk-eur" } }).channel).toBe("sk-eur");
	});

	it("leaves channel undefined when the event names none", () => {
		// This is the signal to fan out over every channel: a product event is not
		// channel-specific, and the cache key contains the channel.
		expect(parseWebhookPayload({ product: { slug: "a" } }).channel).toBeUndefined();
	});

	it.each([null, undefined, "a string", 42, []])("survives %s", (payload) => {
		expect(parseWebhookPayload(payload).kind).toBe("unknown");
	});

	it("carries the event type the subscription selected, for the log", () => {
		expect(
			parseWebhookPayload({
				__typename: "ProductVariantOutOfStock",
				productVariant: { product: { slug: "n1" } },
			}),
		).toMatchObject({ kind: "product", slug: "n1", eventType: "ProductVariantOutOfStock" });
		expect(parseWebhookPayload({ __typename: "CategoryUpdated", category: { slug: "c" } })).toMatchObject({
			kind: "category",
			eventType: "CategoryUpdated",
		});
		expect(parseWebhookPayload({ product: { slug: "n1" } })).not.toHaveProperty("eventType");
	});

	describe("the shapes of the Saleor subscription (docs/storefront-4.5, plan 16. 11.)", () => {
		const category = {
			id: "Q2F0ZWdvcnk6NjE=",
			slug: "stresne-nosice",
			parent: { id: "Q2F0ZWdvcnk6Ng==", slug: "auto-moto" },
		};
		const product = {
			id: "UHJvZHVjdDox",
			slug: "n60012",
			updatedAt: "2026-11-16T09:12:03+00:00",
			category,
			collections: [{ id: "Q29sbGVjdGlvbjox", slug: "thule" }],
			channelListings: [{ channel: { slug: "sk-eur" } }],
		};

		it("reads a product with its category, the category's parent and its collections", () => {
			expect(parseWebhookPayload({ __typename: "ProductUpdated", issuedAt: "x", product })).toEqual({
				kind: "product",
				slug: "n60012",
				categorySlug: "stresne-nosice",
				parentCategorySlug: "auto-moto",
				collectionSlugs: ["thule"],
				eventType: "ProductUpdated",
			});
		});

		it("reads a variant through its product, and a discounted price event with its exact channel", () => {
			expect(
				parseWebhookPayload({
					__typename: "ProductVariantUpdated",
					productVariant: { id: "v", sku: "s", product },
				}),
			).toMatchObject({
				kind: "product",
				slug: "n60012",
			});
			const discounted = parseWebhookPayload({
				__typename: "ProductVariantDiscountedPriceUpdated",
				channel: { slug: "cz-czk" },
				discountedVariant: { id: "v", sku: "s", product },
			});
			expect(discounted).toMatchObject({ kind: "product", slug: "n60012", channel: "cz-czk" });
		});

		it("reads a category with its parent", () => {
			expect(parseWebhookPayload({ __typename: "CategoryUpdated", category })).toMatchObject({
				kind: "category",
				slug: "stresne-nosice",
				parentCategorySlug: "auto-moto",
			});
		});

		it("reads menus and menu items as navigation, attributes and values as attributes", () => {
			expect(parseWebhookPayload({ __typename: "MenuUpdated", menu: { id: "m", slug: "navbar" } }).kind).toBe(
				"menu",
			);
			expect(
				parseWebhookPayload({
					__typename: "MenuItemCreated",
					menuItem: { id: "i", menu: { id: "m", slug: "footer" } },
				}).kind,
			).toBe("menu");
			expect(
				parseWebhookPayload({ __typename: "AttributeUpdated", attribute: { id: "a", slug: "brand" } }).kind,
			).toBe("attribute");
			expect(
				parseWebhookPayload({
					__typename: "AttributeValueCreated",
					attributeValue: { id: "v", slug: "thule" },
				}).kind,
			).toBe("attribute");
		});

		it("names a translated product, category or collection by its BASE slug, not the translated one", () => {
			expect(
				parseWebhookPayload({
					__typename: "TranslationUpdated",
					translation: {
						__typename: "ProductTranslation",
						language: { code: "DE" },
						slug: "dachtraeger-xl",
						translatableContent: { productId: "UHJvZHVjdDox", slug: "n60012" },
					},
				}),
			).toMatchObject({ kind: "product", slug: "n60012" });
			expect(
				parseWebhookPayload({
					translation: {
						__typename: "CategoryTranslation",
						slug: "dachtraeger",
						translatableContent: { categoryId: "c", slug: "stresne-nosice" },
					},
				}),
			).toMatchObject({ kind: "category", slug: "stresne-nosice" });
			expect(
				parseWebhookPayload({
					translation: {
						__typename: "CollectionTranslation",
						translatableContent: { collectionId: "c", slug: "thule" },
					},
				}),
			).toMatchObject({ kind: "collection", slug: "thule" });
		});

		it("places a menu item translation under navigation and a variant translation nowhere", () => {
			expect(
				parseWebhookPayload({
					translation: { __typename: "MenuItemTranslation", translatableContent: { menuItemId: "i" } },
				}).kind,
			).toBe("menu");
			expect(
				parseWebhookPayload({
					translation: {
						__typename: "ProductVariantTranslation",
						translatableContent: { productVariantId: "v" },
					},
				}).kind,
			).toBe("unknown");
		});
	});
});
