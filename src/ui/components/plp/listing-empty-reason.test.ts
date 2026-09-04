import { describe, expect, it } from "vitest";
import { listingEmptyReason } from "./listing-empty-reason";

describe("listingEmptyReason", () => {
	it("calls a genuinely empty category empty", () => {
		// /sk/categories/stresne-nosice today: the flagship category, first tile,
		// first word of the H1, and publicly holding nothing.
		expect(listingEmptyReason({ totalCount: 0, localeDropped: 0, hasActiveFilters: false })).toBe("empty");
	});

	it("does not blame filters nobody applied", () => {
		expect(listingEmptyReason({ totalCount: 0, localeDropped: 0, hasActiveFilters: false })).not.toBe(
			"filtered-out",
		);
	});

	it("blames the filters when filters are actually active", () => {
		expect(listingEmptyReason({ totalCount: 12, localeDropped: 0, hasActiveFilters: true })).toBe(
			"filtered-out",
		);
	});

	it("still blames the filters when a server-side filter zeroed totalCount", () => {
		// The trap: totalCount comes off the FILTERED connection, so a price
		// filter matching nothing reports 0 for a category holding 101 products.
		// Checking emptiness first would call that category empty.
		expect(listingEmptyReason({ totalCount: 0, localeDropped: 0, hasActiveFilters: true })).toBe(
			"filtered-out",
		);
	});

	it("distinguishes 'we have stock, just not in your language'", () => {
		expect(listingEmptyReason({ totalCount: 40, localeDropped: 12, hasActiveFilters: false })).toBe(
			"untranslated",
		);
	});

	it("does not claim untranslated when there was nothing to translate", () => {
		expect(listingEmptyReason({ totalCount: 0, localeDropped: 0, hasActiveFilters: false })).toBe("empty");
	});

	it("falls back to empty for a cursor past the end of a stocked listing", () => {
		expect(listingEmptyReason({ totalCount: 40, localeDropped: 0, hasActiveFilters: false })).toBe("empty");
	});
});
