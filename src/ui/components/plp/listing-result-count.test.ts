import { describe, expect, it } from "vitest";
import { listingResultCount } from "./listing-result-count";

const base = { totalCount: 101, renderedCount: 12, localeDropped: 0, hasClientSideFilters: false };

describe("listingResultCount", () => {
	it("reports the catalogue total, not the page size", () => {
		// Live before the fix: /sk/categories/stresne-boxy said "12 produktov"
		// while holding 101, and /sk/products said "12 produktov" out of 414.
		expect(listingResultCount(base)).toBe(101);
	});

	it("reports what is on screen once browser-side filters are applied", () => {
		// Colour/size filtering runs against the current page only, so upstream's
		// total counts rows the visitor cannot see.
		expect(listingResultCount({ ...base, hasClientSideFilters: true, renderedCount: 3 })).toBe(3);
	});

	it("reports what is on screen when locale eligibility dropped rows", () => {
		expect(listingResultCount({ ...base, localeDropped: 4, renderedCount: 8 })).toBe(8);
	});

	it("still uses the upstream total for a server-side filter", () => {
		// Price and category filter upstream, so totalCount already describes the
		// filtered set — 8 really is the answer, not the page size.
		expect(listingResultCount({ ...base, totalCount: 8, renderedCount: 8 })).toBe(8);
	});

	it("says zero rather than borrowing an unfiltered total", () => {
		expect(listingResultCount({ ...base, totalCount: 0, renderedCount: 0 })).toBe(0);
	});
});
