import { describe, expect, it } from "vitest";
import { WISHLIST_MAX, parseStoredWishlist, toggledWishlist } from "./ids";

const id = (n: number) => Buffer.from(`Product:${n}`).toString("base64");

describe("wishlist store", () => {
	it("reads back what it stored, and nothing else", () => {
		expect(parseStoredWishlist(JSON.stringify([id(1), id(2)]))).toEqual([id(1), id(2)]);
		expect(parseStoredWishlist(null)).toEqual([]);
		expect(parseStoredWishlist("not json")).toEqual([]);
		expect(parseStoredWishlist(JSON.stringify({ ids: [id(1)] }))).toEqual([]);
		expect(parseStoredWishlist(JSON.stringify([id(1), 42, "<script>", id(1)]))).toEqual([id(1)]);
	});

	it("adds newest first, removes on a second click, and never grows past the limit", () => {
		const once = toggledWishlist([id(1)], id(2));
		expect(once).toEqual([id(2), id(1)]);
		expect(toggledWishlist(once, id(2))).toEqual([id(1)]);

		const full = Array.from({ length: WISHLIST_MAX }, (_, i) => id(i + 1));
		const added = toggledWishlist(full, id(999));
		expect(added).toHaveLength(WISHLIST_MAX);
		expect(added[0]).toBe(id(999));
		expect(parseStoredWishlist(JSON.stringify([...full, id(999)]))).toHaveLength(WISHLIST_MAX);
	});
});
