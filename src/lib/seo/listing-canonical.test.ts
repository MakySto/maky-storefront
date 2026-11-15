import { describe, expect, it } from "vitest";

import { forwardPageCursor, listingCanonical } from "./listing-canonical";

const BASE = "https://maky.store/sk/snehove-retaze";

describe("listingCanonical", () => {
	it("is the bare address for the first page", () => {
		expect(listingCanonical(BASE, {})).toBe(BASE);
	});

	it("is the page's own address for a page reached by next", () => {
		expect(listingCanonical(BASE, { cursor: "WyJEQUMiXQ==", direction: "next" })).toBe(
			`${BASE}?cursor=WyJEQUMiXQ%3D%3D&direction=next`,
		);
	});

	it("is exactly the address the pagination link carries", () => {
		// `Pagination` builds its links with URLSearchParams, cursor first, then direction.
		const cursor = "a+b/c=d e";
		const link = new URLSearchParams();
		link.set("cursor", cursor);
		link.set("direction", "next");
		expect(listingCanonical(BASE, { cursor, direction: "next" })).toBe(`${BASE}?${link.toString()}`);
	});

	it("reads a cursor without a direction as next, the way the listing does", () => {
		expect(listingCanonical(BASE, { cursor: "abc" })).toBe(`${BASE}?cursor=abc&direction=next`);
	});

	it("carries nothing else into the canonical", () => {
		expect(listingCanonical(BASE, { cursor: "abc", direction: "next", utm_source: "newsletter" })).toBe(
			`${BASE}?cursor=abc&direction=next`,
		);
	});

	it("points a page walked backwards at the bare address: a next page already shows it", () => {
		expect(listingCanonical(BASE, { cursor: "abc", direction: "prev" })).toBe(BASE);
	});

	it.each(["sort", "price", "colors", "sizes", "vehicle", "tyres", "tyreSize", "brand", "volume"])(
		"points a list narrowed or re-ordered by %s at the bare address, on any page",
		(key) => {
			expect(listingCanonical(BASE, { [key]: "x" })).toBe(BASE);
			expect(listingCanonical(BASE, { cursor: "abc", direction: "next", [key]: "x" })).toBe(BASE);
		},
	);

	it("is the selection's own page when it has one, on any page of the list and in any order", () => {
		const own = `${BASE}/205-60-r16`;
		expect(listingCanonical(BASE, { tyres: "1", tyreSize: "205/60 R16" }, own)).toBe(own);
		expect(listingCanonical(BASE, { tyreSize: "205/60 R16", sort: "price-asc" }, own)).toBe(own);
		expect(listingCanonical(BASE, { tyreSize: "205/60 R16", cursor: "abc", direction: "next" }, own)).toBe(
			own,
		);
	});

	it("is unchanged when the selection has no page of its own", () => {
		expect(listingCanonical(BASE, { tyreSize: "205/60 R99" }, null)).toBe(BASE);
		expect(listingCanonical(BASE, { cursor: "abc", direction: "next" }, null)).toBe(
			`${BASE}?cursor=abc&direction=next`,
		);
	});

	it("does not take a repeated or empty cursor for a page", () => {
		expect(forwardPageCursor({ cursor: ["a", "b"] })).toBeNull();
		expect(forwardPageCursor({ cursor: "" })).toBeNull();
		expect(forwardPageCursor({ cursor: "abc" })).toBe("abc");
	});
});
