import { describe, expect, it } from "vitest";

import {
	LEGACY_PRODUCT_SLUG_REDIRECTS,
	previousProductSlug,
	resolveLegacyProductSlug,
} from "./product-redirects";
import { legacyProductPath, productHref, productPath } from "./product-url";

describe("productPath", () => {
	it("puts the product slug at the market root, not under /products", () => {
		expect(productPath("stresny-box-thule-motion-3-xxl-titan-glossy-639901")).toBe(
			"/stresny-box-thule-motion-3-xxl-titan-glossy-639901",
		);
	});

	it("keeps the variant as a query parameter", () => {
		expect(productPath("nieco-598b", "UHJvZHVjdFZhcmlhbnQ6MQ==")).toBe(
			"/nieco-598b?variant=UHJvZHVjdFZhcmlhbnQ6MQ%3D%3D",
		);
	});
});

describe("productHref", () => {
	it("renders the required Slovak canonical URL", () => {
		expect(productHref("sk-eur", "stresny-box-thule-motion-3-xxl-titan-glossy-639901")).toBe(
			"/sk/stresny-box-thule-motion-3-xxl-titan-glossy-639901",
		);
	});

	it("accepts the friendly market slug as well as the Saleor channel slug", () => {
		expect(productHref("sk", "hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5-60505")).toBe(
			"/sk/hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5-60505",
		);
	});

	it("never emits the raw Saleor channel slug in the path", () => {
		expect(productHref("sk-eur", "x-1")).not.toContain("sk-eur");
	});
});

describe("legacy redirects", () => {
	it("maps every migrated pilot slug to its SKU-last replacement", () => {
		expect(Object.keys(LEGACY_PRODUCT_SLUG_REDIRECTS)).toHaveLength(10);
		expect(resolveLegacyProductSlug("639901-stresny-box-thule-motion-3-xxl-titan-glossy")).toBe(
			"stresny-box-thule-motion-3-xxl-titan-glossy-639901",
		);
		expect(
			resolveLegacyProductSlug("60505-hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5"),
		).toBe("hlinikova-prepravna-klietka-pre-zvierata-lampa-premium-typ-5-60505");
	});

	it("drops the Saleor -1 collision artifact", () => {
		const target = resolveLegacyProductSlug("npb2115ccr-stresny-box-northline-tirol-black-on-black-tef-1");
		expect(target).toBe("stresny-box-northline-tirol-black-on-black-tef-npb2115ccr");
		expect(target.endsWith("-1")).toBe(false);
	});

	it("every mapping target is SKU-last and never points back at /products", () => {
		for (const [from, to] of Object.entries(LEGACY_PRODUCT_SLUG_REDIRECTS)) {
			expect(to).not.toBe(from);
			expect(to).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(productPath(to).startsWith("/products/")).toBe(false);
		}
	});

	it("passes an unmapped slug through unchanged", () => {
		expect(resolveLegacyProductSlug("nikdy-nemigrovany-produkt-abc")).toBe("nikdy-nemigrovany-produkt-abc");
	});

	it("targets are unique, so no two old URLs land on the same page", () => {
		const targets = Object.values(LEGACY_PRODUCT_SLUG_REDIRECTS);
		expect(new Set(targets).size).toBe(targets.length);
	});
});

describe("legacyProductPath", () => {
	it("still describes the retired shape for redirect bookkeeping", () => {
		expect(legacyProductPath("639901-stresny-box")).toBe("/products/639901-stresny-box");
	});
});

describe("previousProductSlug (migration shim)", () => {
	it("maps a new slug back to the slug Saleor still holds pre-flip", () => {
		expect(previousProductSlug("stresny-box-thule-motion-3-xxl-titan-glossy-639901")).toBe(
			"639901-stresny-box-thule-motion-3-xxl-titan-glossy",
		);
	});

	it("is undefined for anything not part of the migration", () => {
		expect(previousProductSlug("uplne-novy-produkt-xyz")).toBeUndefined();
	});

	it("round-trips every mapped slug in both directions", () => {
		for (const [oldSlug, newSlug] of Object.entries(LEGACY_PRODUCT_SLUG_REDIRECTS)) {
			expect(resolveLegacyProductSlug(oldSlug)).toBe(newSlug);
			expect(previousProductSlug(newSlug)).toBe(oldSlug);
		}
	});
});
