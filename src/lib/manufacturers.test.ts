import { describe, expect, it } from "vitest";
import { manufacturerOf } from "./manufacturers";

/**
 * The makers the shop holds the details of, by the brand's Saleor slug.
 *
 * The details are the ones the owner sent on 2026-10-08, taken from the maker's own terms of sale. What is
 * pinned is that they are the maker's, that nothing is guessed for a brand the shop has no details of, and that
 * the record holds what the page prints and no register or VAT number (the source gave two register numbers
 * for the one company).
 */
describe("manufacturerOf", () => {
	it("names Tradekar Benelux for the PRO-USER and Spinder brands, with the address as its terms give it", () => {
		for (const brand of ["pro-user", "spinder"]) {
			expect(manufacturerOf(brand), brand).toEqual({
				name: "Tradekar Benelux B.V.",
				street: "Ohmweg 1",
				town: "4140 BM Culemborg",
				country: "NL",
				email: "service@tradekar.com",
			});
		}
	});

	it("is one company behind both brands", () => {
		expect(manufacturerOf("pro-user")).toBe(manufacturerOf("spinder"));
	});

	it("is null for a brand the shop has no details of, and for no brand at all", () => {
		for (const brand of ["thule", "yakima", "nordrive", "neznackove", "", null, undefined]) {
			expect(manufacturerOf(brand), String(brand)).toBeNull();
		}
	});

	it("matches the slug exactly, as Saleor writes it, and never reaches a prototype", () => {
		for (const brand of [
			"PRO-USER",
			" pro-user",
			"pro-user ",
			"prouser",
			"constructor",
			"__proto__",
			"toString",
		]) {
			expect(manufacturerOf(brand), brand).toBeNull();
		}
	});

	it("holds an address a visitor can write to, and no register or VAT number", () => {
		const maker = manufacturerOf("pro-user");
		expect(Object.keys(maker ?? {}).sort()).toEqual(["country", "email", "name", "street", "town"]);
		expect(maker?.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
		expect(maker?.country).toMatch(/^[A-Z]{2}$/);
	});
});
