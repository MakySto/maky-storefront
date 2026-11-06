import { describe, expect, it } from "vitest";

import { searchAfterTyreChange, tyreFilterHref, tyreFilterRequestOf, tyreSizeParamOf } from "./listing-param";

describe("what the URL asks of a snow-chain listing", () => {
	it("reads the three answers", () => {
		expect(tyreFilterRequestOf("1")).toBe("tyres");
		expect(tyreFilterRequestOf("0")).toBe("all");
		expect(tyreFilterRequestOf(undefined)).toBe("default");
	});

	it("takes the first of a repeated parameter, and reads anything else as no answer", () => {
		expect(tyreFilterRequestOf(["1", "0"])).toBe("tyres");
		expect(tyreFilterRequestOf(["0", "1"])).toBe("all");
		expect(tyreFilterRequestOf("yes")).toBe("default");
		expect(tyreFilterRequestOf("")).toBe("default");
		expect(tyreFilterRequestOf([])).toBe("default");
	});
});

describe("the size a link carries", () => {
	it("reads the text of ?tyreSize=, the first of a repeated one, and leaves matching it to the reader", () => {
		expect(tyreSizeParamOf("205/55 R16")).toBe("205/55 R16");
		expect(tyreSizeParamOf(["205/55 R16", "175 R13"])).toBe("205/55 R16");
		expect(tyreSizeParamOf("205/55r16")).toBe("205/55r16");
	});

	it("reads nothing, an empty value or an absurdly long one as no size", () => {
		expect(tyreSizeParamOf(undefined)).toBeUndefined();
		expect(tyreSizeParamOf("")).toBeUndefined();
		expect(tyreSizeParamOf("   ")).toBeUndefined();
		expect(tyreSizeParamOf([])).toBeUndefined();
		expect(tyreSizeParamOf("x".repeat(41))).toBeUndefined();
	});

	it("is put in the link when the link is about one size, and replaces an older one", () => {
		const href = tyreFilterHref(
			"/snehove-retaze",
			{ tyreSize: "175 R13", sort: "price_asc" },
			true,
			"205/55 R16",
		);
		const query = new URLSearchParams(href.split("?")[1]);
		expect(query.get("tyreSize")).toBe("205/55 R16");
		expect(query.getAll("tyreSize")).toHaveLength(1);
		expect(query.get("sort")).toBe("price_asc");
		expect(href).toContain("tyreSize=205%2F55+R16");
	});

	it("is left out when the link is not about a size, and an old one is not carried into 'all chains'", () => {
		expect(tyreFilterHref("/snehove-retaze", {}, true)).toBe("/snehove-retaze?tyres=1");
		expect(tyreFilterHref("/snehove-retaze", { tyreSize: "175 R13" }, false)).toBe("/snehove-retaze?tyres=0");
		expect(tyreFilterHref("/snehove-retaze", {}, true, null)).toBe("/snehove-retaze?tyres=1");
	});
});

describe("the link that selects a mode", () => {
	it("says 'for my tyres' with ?tyres=1 and 'all chains' with ?tyres=0, never by removing the parameter", () => {
		expect(tyreFilterHref("/snehove-retaze", {}, true)).toBe("/snehove-retaze?tyres=1");
		expect(tyreFilterHref("/snehove-retaze", {}, false)).toBe("/snehove-retaze?tyres=0");
	});

	it("drops the cursor and the direction, which belong to the old result set, and keeps the rest", () => {
		const href = tyreFilterHref(
			"/snehove-retaze",
			{ cursor: "abc", direction: "next", sort: "price_asc", brand: ["thule", "dac"], tyres: "0" },
			true,
		);
		const query = new URLSearchParams(href.split("?")[1]);
		expect(query.get("tyres")).toBe("1");
		expect(query.has("cursor")).toBe(false);
		expect(query.has("direction")).toBe(false);
		expect(query.get("sort")).toBe("price_asc");
		expect(query.getAll("brand")).toEqual(["thule", "dac"]);
	});

	it("leaves the vehicle filter's parameter alone", () => {
		expect(
			new URLSearchParams(tyreFilterHref("/x", { vehicle: "1" }, true).split("?")[1]).get("vehicle"),
		).toBe("1");
	});
});

describe("after the shopper changed their size without leaving the page", () => {
	it("drops what belonged to the old size: the cursor, the direction and an explicit 'all chains'", () => {
		expect(searchAfterTyreChange("?cursor=abc&direction=next&tyres=0&sort=price_asc")).toBe(
			"?sort=price_asc",
		);
		expect(searchAfterTyreChange("?tyres=0")).toBe("");
		expect(searchAfterTyreChange("?tyres=1")).toBe("");
		expect(searchAfterTyreChange("cursor=abc")).toBe("");
	});

	it("drops the size the link carried: it was the old size", () => {
		expect(searchAfterTyreChange("?tyres=1&tyreSize=175+R13&sort=price_asc")).toBe("?sort=price_asc");
		expect(searchAfterTyreChange("?tyreSize=175+R13")).toBe("");
	});

	it("is null when there was nothing to drop, so the page re-renders in place instead of navigating to itself", () => {
		expect(searchAfterTyreChange("")).toBeNull();
		expect(searchAfterTyreChange("?sort=price_asc&brand=thule")).toBeNull();
	});
});
