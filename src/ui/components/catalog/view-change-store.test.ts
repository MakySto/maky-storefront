import { describe, expect, it, vi } from "vitest";

import { holdViewChange, isViewChangeUnderWay, subscribeToViewChanges } from "./view-change-store";

/**
 * A vehicle page takes one view change at a time (owner's live review, 2026-11-27: a maker chosen and
 * the order changed while the page was still loading left the address without the maker). The
 * controls wait for each other through this count.
 */
describe("the view changes of a vehicle page that are under way", () => {
	it("is busy from the first change that starts to the last that ends, in any order", () => {
		expect(isViewChangeUnderWay()).toBe(false);
		const maker = holdViewChange();
		const roof = holdViewChange();
		expect(isViewChangeUnderWay()).toBe(true);
		maker();
		expect(isViewChangeUnderWay()).toBe(true);
		roof();
		expect(isViewChangeUnderWay()).toBe(false);
	});

	it("ends a change once, however often its end is called", () => {
		const first = holdViewChange();
		const second = holdViewChange();
		first();
		first();
		expect(isViewChangeUnderWay()).toBe(true);
		second();
		expect(isViewChangeUnderWay()).toBe(false);
	});

	it("tells every control when a change starts and when it ends, and stops telling one that left", () => {
		const select = vi.fn();
		const chip = vi.fn();
		const leaveSelect = subscribeToViewChanges(select);
		subscribeToViewChanges(chip);

		const change = holdViewChange();
		expect(select).toHaveBeenCalledTimes(1);
		expect(chip).toHaveBeenCalledTimes(1);

		leaveSelect();
		change();
		expect(select).toHaveBeenCalledTimes(1);
		expect(chip).toHaveBeenCalledTimes(2);
	});
});
