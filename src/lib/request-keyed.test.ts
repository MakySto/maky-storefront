import { describe, expect, it } from "vitest";

import {
	CART_SEGMENT_BY_MARKET,
	CHANNEL_MAP,
	COUNTRY_TO_MARKET,
	REVERSE_MAP,
	cartSegment,
} from "./channel-map";
import { MARKET_LANGUAGE_CODE } from "@/config/market-language";

/**
 * Every one of these tables is indexed with something a visitor chooses — a market slug out
 * of a URL path, a country code out of a Cloudflare header, a channel out of a cookie.
 *
 * As plain object literals they answered a key that was not in them with an inherited member
 * of `Object`, which is truthy: `CHANNEL_MAP["__proto__"]` was `Object.prototype`, and
 * `COUNTRY_TO_MARKET["constructor"]` was a function. Every caller happened to have a second
 * check that rejected it, so nothing was exploitable — but "not in the table" meaning
 * anything other than `undefined` is a trap set for the next person to touch this code.
 */
const INHERITED = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf"];

describe("tables indexed by a value from the request", () => {
	const tables = {
		CHANNEL_MAP,
		COUNTRY_TO_MARKET,
		CART_SEGMENT_BY_MARKET,
		REVERSE_MAP,
		MARKET_LANGUAGE_CODE,
	} as const;

	for (const [name, table] of Object.entries(tables)) {
		it.each(INHERITED)(`${name} answers %j with undefined, not an inherited member`, (key) => {
			expect((table as Record<string, unknown>)[key]).toBeUndefined();
		});

		it(`${name} still answers its real keys`, () => {
			const keys = Object.keys(table);
			expect(keys.length).toBeGreaterThan(0);
			for (const key of keys) {
				expect((table as Record<string, unknown>)[key]).toBeDefined();
			}
		});
	}

	it("cartSegment falls back to the canonical segment for a made-up market", () => {
		// It reads REVERSE_MAP first, so `__proto__` used to make `market` an object and the
		// second lookup coerced it to "[object Object]" before the `|| "cart"` caught it.
		expect(cartSegment("__proto__")).toBe("cart");
		expect(cartSegment("constructor")).toBe("cart");
		expect(cartSegment("es")).toBe("carrito");
		expect(cartSegment("es-eur")).toBe("carrito");
	});
});
