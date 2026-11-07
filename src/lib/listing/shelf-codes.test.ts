import { describe, expect, it } from "vitest";

import { shelfCodesFromNodes } from "./shelf-codes";

const node = (id: string, variants: { id: string; name: string }[]) => ({ id, variants }) as never;

describe("the products a shelf lists, by public code", () => {
	it("maps a product with one variant to the code that variant is named by", () => {
		expect(
			shelfCodesFromNodes([
				node("p1", [{ id: "v1", name: "N16128" }]),
				node("p2", [{ id: "v2", name: "D0190" }]),
			]),
		).toEqual([
			{ code: "N16128", productId: "p1" },
			{ code: "D0190", productId: "p2" },
		]);
	});

	it("leaves out a product with several variants, which is not one of the size-controlled ones", () => {
		expect(
			shelfCodesFromNodes([
				node("p1", [
					{ id: "v1", name: "N16128" },
					{ id: "v2", name: "N16129" },
				]),
			]),
		).toEqual([]);
		expect(shelfCodesFromNodes([node("p1", [])])).toEqual([]);
		expect(shelfCodesFromNodes([{ id: "p1", variants: null } as never])).toEqual([]);
	});

	it("never takes a name that is not a code, and never the internal SKU marker", () => {
		expect(
			shelfCodesFromNodes([
				node("p1", [{ id: "v1", name: "Black" }]),
				node("p2", [{ id: "v2", name: "N21048|CFMP-B-NOR-57acce2f8ef56b-000000" }]),
				node("p3", [{ id: "v3", name: "" }]),
				node("p4", [{ id: "v4", name: "v4" }]),
			]),
		).toEqual([]);
	});
});
