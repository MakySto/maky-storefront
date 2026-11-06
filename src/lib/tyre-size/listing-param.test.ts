import { describe, expect, it } from "vitest";

import { searchAfterTyreChange, tyreFilterHref, tyreFilterRequestOf } from "./listing-param";

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

	it("is null when there was nothing to drop, so the page re-renders in place instead of navigating to itself", () => {
		expect(searchAfterTyreChange("")).toBeNull();
		expect(searchAfterTyreChange("?sort=price_asc&brand=thule")).toBeNull();
	});
});
