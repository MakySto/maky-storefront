import { describe, expect, it } from "vitest";
import { reviewSummaryFor } from "./summary";

describe("review summary", () => {
	it("shows a rating only when the catalogue carries one", () => {
		expect(reviewSummaryFor({ rating: null })).toBeNull();
		expect(reviewSummaryFor({})).toBeNull();
		expect(reviewSummaryFor({ rating: 0 })).toBeNull();
		expect(reviewSummaryFor({ rating: Number.NaN })).toBeNull();
		expect(reviewSummaryFor({ rating: 4.3 })).toEqual({ average: 4.3, count: null });
		expect(reviewSummaryFor({ rating: 7 })).toEqual({ average: 5, count: null });
	});
});
