import { describe, expect, it } from "vitest";

import { clampQuantity, QUANTITY_FALLBACK_MAX } from "./quantity-limits";

/**
 * The regression: add-to-cart from the configurator could not work at all.
 *
 * The ceiling came from a constant defined in a `"use client"` module and read by a
 * `"use server"` one, so on the server it was not 99. `Math.min(1, notANumber)` is `NaN`,
 * `JSON.stringify` writes that as `null`, and Saleor answers
 * `Variable "$quantity" of required type "Int!" was not provided` — measured to be the
 * SAME string it returns for a genuinely absent key. So the error pointed away from the
 * cause, and nothing in the chain ever mentioned the value that had gone wrong.
 *
 * The PDP passes a real `maxQuantity` and never reached the fallback; the configurator has
 * no quantity control and reached it every single time.
 */
describe("clampQuantity always returns a positive integer", () => {
	it("uses the fallback ceiling when no max is given", () => {
		expect(clampQuantity(1)).toBe(1);
		expect(clampQuantity(500)).toBe(QUANTITY_FALLBACK_MAX);
	});

	it("survives a ceiling that is not a number at all", () => {
		// The exact shape of the bug: whatever crosses a module boundary wrongly, the
		// result must still be sendable.
		for (const bad of [undefined, null, Number.NaN, "99" as unknown as number, {} as unknown as number]) {
			const q = clampQuantity(1, bad as number | null | undefined);
			expect(Number.isInteger(q)).toBe(true);
			expect(q).toBeGreaterThanOrEqual(1);
		}
	});

	it("never returns NaN for a nonsense request", () => {
		for (const bad of [Number.NaN, Infinity, -Infinity, undefined as unknown as number]) {
			expect(clampQuantity(bad)).toBe(1);
		}
	});

	it("respects a real stock ceiling", () => {
		expect(clampQuantity(10, 3)).toBe(3);
		expect(clampQuantity(2, 3)).toBe(2);
	});

	it("floors a fractional request and refuses zero or negative", () => {
		expect(clampQuantity(2.9)).toBe(2);
		expect(clampQuantity(0)).toBe(1);
		expect(clampQuantity(-5)).toBe(1);
	});

	it("serialises to a real JSON number, which is what actually failed", () => {
		expect(JSON.parse(JSON.stringify({ quantity: clampQuantity(1) }))).toEqual({ quantity: 1 });
		expect(JSON.stringify({ quantity: Math.min(1, undefined as unknown as number) })).toBe(
			'{"quantity":null}',
		);
	});
});
