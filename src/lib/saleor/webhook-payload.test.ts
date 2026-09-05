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
});
