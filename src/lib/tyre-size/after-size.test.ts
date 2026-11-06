import { describe, expect, it } from "vitest";

import { afterTyreSize } from "./after-size";

const at = (pathname: string, size: string | null, search = "") =>
	afterTyreSize({ pathname, channel: "sk-eur", search, size });

describe("after the shopper gave a tyre size", () => {
	it("leads from the market root to the snow-chain shelf narrowed to the size", () => {
		expect(at("/sk", "205/55 R16")).toEqual({ kind: "push", path: "/sk/snehove-retaze?tyres=1" });
		expect(at("/sk/", "205/55 R16")).toEqual({ kind: "push", path: "/sk/snehove-retaze?tyres=1" });
	});

	it("does not lead anywhere when the size was forgotten, or from a market that does not sell the shelf", () => {
		expect(at("/sk", null)).toEqual({ kind: "refresh" });
		expect(afterTyreSize({ pathname: "/cz", channel: "cz-czk", search: "", size: "205/55 R16" })).toEqual({
			kind: "refresh",
		});
	});

	it("never moves the shopper off any other page, a cart and a checkout among them", () => {
		for (const pathname of [
			"/sk/cart",
			"/sk/stresne-boxy",
			"/sk/produkt-xyz",
			"/sk/account/orders",
			"/checkout",
		]) {
			expect(at(pathname, "205/55 R16").kind).toBe("refresh");
		}
	});

	it("is not fooled by a first segment that is no market", () => {
		expect(at("/checkout", "205/55 R16")).toEqual({ kind: "refresh" });
		expect(at("/", "205/55 R16")).toEqual({ kind: "refresh" });
		expect(at("", "205/55 R16")).toEqual({ kind: "refresh" });
	});
});

describe("on the snow-chain shelf itself", () => {
	it("drops what belonged to the old size and keeps the shopper's own choices", () => {
		expect(at("/sk/snehove-retaze", "205/55 R16", "?cursor=abc&tyres=0&sort=price_asc")).toEqual({
			kind: "replace",
			path: "/sk/snehove-retaze?sort=price_asc",
		});
		expect(at("/sk/snehove-retaze", null, "?tyres=1")).toEqual({
			kind: "replace",
			path: "/sk/snehove-retaze",
		});
	});

	it("renders in place when there was nothing to drop", () => {
		expect(at("/sk/snehove-retaze", "205/55 R16")).toEqual({ kind: "refresh" });
		expect(at("/sk/snehove-retaze", "205/55 R16", "?sort=price_asc")).toEqual({ kind: "refresh" });
	});

	it("leaves another listing's page position alone", () => {
		expect(at("/sk/stresne-boxy", "205/55 R16", "?cursor=abc&tyres=0")).toEqual({ kind: "refresh" });
	});
});
