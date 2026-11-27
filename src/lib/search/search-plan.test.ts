import { describe, expect, it } from "vitest";
import {
	correctedCursor,
	findTyreText,
	onlyWords,
	parseSearchCursor,
	saleorCursor,
	shelfCursor,
	withoutWords,
} from "./search-plan";

describe("the cursor of a search page", () => {
	it("names a page of the shop's own index by its position", () => {
		expect(parseSearchCursor(shelfCursor(40))).toEqual({ kind: "shelf", offset: 40 });
		expect(shelfCursor(-20)).toBe("shelf.0");
	});

	it("names which of Saleor's searches a later page continues", () => {
		expect(parseSearchCursor(saleorCursor("vehicle", "WyJhIl0="))).toEqual({
			kind: "saleor",
			variant: "vehicle",
			cursor: "WyJhIl0=",
		});
		expect(parseSearchCursor(saleorCursor("brand", "abc")).kind).toBe("saleor");
		expect(parseSearchCursor(saleorCursor("racks", "abc"))).toEqual({
			kind: "saleor",
			variant: "racks",
			cursor: "abc",
		});
	});

	it("marks a page of the answer that was given for a corrected car", () => {
		expect(parseSearchCursor(correctedCursor(saleorCursor("full", "WyJhIl0=")))).toEqual({
			kind: "corrected",
			inner: "f.WyJhIl0=",
		});
		expect(parseSearchCursor(correctedCursor(shelfCursor(20)))).toEqual({
			kind: "corrected",
			inner: "shelf.20",
		});
		// The mark alone names no page.
		expect(parseSearchCursor("c.").kind).toBe("saleor");
	});

	it("reads a bare cursor, from a link older than this, as the words as typed", () => {
		expect(parseSearchCursor("WyJhIl0=")).toEqual({ kind: "saleor", variant: "full", cursor: "WyJhIl0=" });
		expect(parseSearchCursor(undefined)).toEqual({ kind: "start" });
		expect(parseSearchCursor("")).toEqual({ kind: "start" });
	});
});

describe("a tyre size inside a search", () => {
	it.each([
		["reťaze 205/55 R16", "205/55 R16", "reťaze"],
		["Schneeketten 205/55R16", "205/55R16", "Schneeketten"],
		["205 55 16 snehové reťaze", "205 55 16", "snehové reťaze"],
		["2055516", "2055516", ""],
	])("%s holds %s", (query, text, rest) => {
		expect(findTyreText(query)).toEqual({ text, rest });
	});

	it.each(["priečniky 120", "8717809204097", "menabo mania 400", "octavia 2019", "N21041"])(
		"%s holds none",
		(query) => {
			expect(findTyreText(query)).toBeNull();
		},
	);
});

describe("the words of a search that belong to the car", () => {
	const car = new Set(["skoda", "octavia", "2019"]);

	it("are left out when another shelf is asked for", () => {
		expect(withoutWords("nosič bicyklov Škoda Octavia 2019", car, "sk")).toBe("nosič bicyklov");
	});

	it("are all that is asked of Saleor when the other words are in a language it cannot read", () => {
		expect(onlyWords("Montagekit Škoda Octavia", car, "de")).toBe("Škoda Octavia");
		expect(onlyWords("Montagekit", car, "de")).toBe("");
	});
});
