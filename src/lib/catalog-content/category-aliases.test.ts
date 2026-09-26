import { describe, expect, it } from "vitest";
import { canonicalCatalogPath } from "./category-aliases";

/**
 * Links the storefront builds point AT the market's page, never through the 301 to it.
 * `/de/dachtraeger/opel` linked its twenty models a second time as `/de/stresne-nosice/opel/…`
 * (CFM copy writes the Slovak path in every language) — 4 418 self-inflicted 301s on 2026-09-25.
 */
describe("canonicalCatalogPath", () => {
	it("spells a Slovak catalogue path the market's way", () => {
		expect(canonicalCatalogPath("de", "/stresne-nosice/opel/corsa")).toBe("/dachtraeger/opel/corsa");
		expect(canonicalCatalogPath("cz", "/stresne-nosice/skoda/octavia")).toBe("/stresni-nosice/skoda/octavia");
		expect(canonicalCatalogPath("us", "/stresne-nosice/bmw")).toBe("/roof-racks/bmw");
	});

	it("keeps a market prefix, a query and a fragment", () => {
		expect(canonicalCatalogPath("de", "/de/stresne-nosice/opel?x=1#top")).toBe(
			"/de/dachtraeger/opel?x=1#top",
		);
	});

	it("leaves Slovakia, canonical paths and everything outside the catalogue alone", () => {
		expect(canonicalCatalogPath("sk", "/stresne-nosice/opel/corsa")).toBe("/stresne-nosice/opel/corsa");
		expect(canonicalCatalogPath("de", "/dachtraeger/opel/corsa")).toBe("/dachtraeger/opel/corsa");
		expect(canonicalCatalogPath("de", "/kontakt")).toBe("/kontakt");
		expect(canonicalCatalogPath("de", "/stresne-boxy")).toBe("/stresne-boxy");
	});

	it("leaves a page the market still publishes under the Slovak root where it is", () => {
		// borrowed-routes.json: CFM's Czech catalogue keeps this one under /stresne-nosice.
		expect(canonicalCatalogPath("cz", "/stresne-nosice/subaru/legacy-kombi/bh")).toBe(
			"/stresne-nosice/subaru/legacy-kombi/bh",
		);
	});
});
