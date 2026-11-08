import { describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";

import { afterTyreSize } from "./after-size";

const at = (pathname: string, size: string | null, search = "") =>
	afterTyreSize({ pathname, channel: "sk-eur", search, size });

/** The market's own address of the shelf, as CFM writes it as the category's translated slug (see `category-routes`). */
const SHELF_ADDRESS: Readonly<Record<string, string>> = {
	cz: "snehove-retezy",
	de: "schneeketten",
	at: "schneeketten",
	pl: "lancuchy-sniegowe",
	hu: "holancok",
	it: "catene-da-neve",
	fr: "chaines-a-neige",
	es: "cadenas-de-nieve",
	ro: "lanturi-de-zapada",
};

describe("after the shopper gave a tyre size", () => {
	it("leads from the market root to the snow-chain shelf narrowed to the size, and carries the size in the link", () => {
		const path = "/sk/snehove-retaze?tyres=1&tyreSize=205%2F55+R16";
		expect(at("/sk", "205/55 R16")).toEqual({ kind: "push", path });
		expect(at("/sk/", "205/55 R16")).toEqual({ kind: "push", path });
	});

	it("leads from the root of each of the nine EU markets to the shelf at that market's own address", () => {
		for (const [market, segment] of Object.entries(SHELF_ADDRESS)) {
			const answer = afterTyreSize({
				pathname: `/${market}`,
				channel: CHANNEL_MAP[market]!.saleorSlug,
				search: "",
				size: "205/55 R16",
			});
			expect(answer, market).toEqual({
				kind: "push",
				path: `/${market}/${segment}?tyres=1&tyreSize=205%2F55+R16`,
			});
		}
	});

	it("does not lead anywhere when the size was forgotten, or from a market that does not sell the shelf", () => {
		expect(at("/sk", null)).toEqual({ kind: "refresh" });
		for (const market of Object.keys(SHELF_ADDRESS)) {
			const channel = CHANNEL_MAP[market]!.saleorSlug;
			expect(afterTyreSize({ pathname: `/${market}`, channel, search: "", size: null }), market).toEqual({
				kind: "refresh",
			});
		}
		// The USA and Canada were not part of the foreign chain run: the shelf holds nothing there.
		for (const market of ["us", "ca"]) {
			const channel = CHANNEL_MAP[market]!.saleorSlug;
			expect(
				afterTyreSize({ pathname: `/${market}`, channel, search: "", size: "205/55 R16" }),
				market,
			).toEqual({
				kind: "refresh",
			});
		}
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

	it("does the same at the market's own address of the shelf", () => {
		for (const [market, segment] of Object.entries(SHELF_ADDRESS)) {
			const answer = afterTyreSize({
				pathname: `/${market}/${segment}`,
				channel: CHANNEL_MAP[market]!.saleorSlug,
				search: "?cursor=abc&tyres=0&sort=price_asc",
				size: "205/55 R16",
			});
			expect(answer, market).toEqual({ kind: "replace", path: `/${market}/${segment}?sort=price_asc` });
		}
	});

	it("renders in place when there was nothing to drop", () => {
		expect(at("/sk/snehove-retaze", "205/55 R16")).toEqual({ kind: "refresh" });
		expect(at("/sk/snehove-retaze", "205/55 R16", "?sort=price_asc")).toEqual({ kind: "refresh" });
	});

	it("leaves another listing's page position alone", () => {
		expect(at("/sk/stresne-boxy", "205/55 R16", "?cursor=abc&tyres=0")).toEqual({ kind: "refresh" });
	});
});
