import { describe, expect, it } from "vitest";

import { CATALOG_REDIRECTS } from "./redirects";
import { PRODUCT_REDIRECTS, productRedirectTarget, setProductRedirectsForTests } from "./product-redirects";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("the shipped product redirect table", () => {
	it("holds only single usable slugs, none pointing at itself", () => {
		for (const [market, slugs] of Object.entries(PRODUCT_REDIRECTS.exact)) {
			for (const [from, to] of Object.entries(slugs)) {
				expect(from, `${market} ${from}`).toMatch(SLUG);
				expect(to, `${market} ${from}`).toMatch(SLUG);
				expect(to, `${market} ${from}`).not.toBe(from);
			}
		}
	});

	it("sends nobody through a second hop: no target is itself retired", () => {
		for (const [market, slugs] of Object.entries(PRODUCT_REDIRECTS.exact)) {
			for (const [from, to] of Object.entries(slugs)) {
				expect(slugs[to], `${market} ${from} -> ${to}`).toBeUndefined();
			}
		}
	});

	it("does not overlap the vehicle-page table: a product slug is never a catalogue path", () => {
		for (const slugs of Object.values(PRODUCT_REDIRECTS.exact)) {
			for (const from of Object.keys(slugs)) {
				for (const paths of Object.values(CATALOG_REDIRECTS.exact)) {
					expect(paths[`/${from}`]).toBeUndefined();
				}
			}
		}
	});
});

describe("productRedirectTarget", () => {
	it("answers per market and returns null for what is not retired", () => {
		setProductRedirectsForTests({ sk: { old: "new" } });
		expect(productRedirectTarget("sk", "old")).toBe("new");
		expect(productRedirectTarget("sk", "new")).toBeNull();
		expect(productRedirectTarget("cz", "old")).toBeNull();
		setProductRedirectsForTests(null);
		expect(productRedirectTarget("sk", "old")).toBeNull();
	});
});
