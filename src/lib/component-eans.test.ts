import { describe, expect, it } from "vitest";

import { publicComponentEans } from "./component-eans";

// Valid GTIN-13s (check digit correct, not a restricted-circulation prefix).
const BARS = "4006381333931";
const FEET = "5901234123457";
const KIT = "8712345678906";

const json = (value: unknown) => JSON.stringify(value);

describe("the EANs of a set's parts", () => {
	it("reads the parts CFM publishes, in the order of the set's code", () => {
		expect(
			publicComponentEans(
				json([
					{ code: "N21401", role: "bars", ean: BARS, qty: 1 },
					{ code: "N20004", role: "feet", ean: FEET, qty: 1 },
					{ code: "N15203", role: "kit", ean: KIT, qty: 2 },
				]),
			),
		).toEqual([
			{ code: "N21401", role: "bars", ean: BARS, qty: 1 },
			{ code: "N20004", role: "feet", ean: FEET, qty: 1 },
			{ code: "N15203", role: "kit", ean: KIT, qty: 2 },
		]);
	});

	it("leaves out a part with no EAN, or with a number that cannot be a GTIN", () => {
		expect(
			publicComponentEans(
				json([
					{ code: "N21401", role: "bars", qty: 1 },
					{ code: "N20004", role: "feet", ean: "5901234123450" },
					{ code: "N15203", role: "kit", ean: "2001234567893" },
					{ code: "N15202", role: "kit", ean: KIT },
				]),
			),
		).toEqual([{ code: "N15202", role: "kit", ean: KIT, qty: 1 }]);
	});

	it("shows one EAN once", () => {
		expect(
			publicComponentEans(
				json([
					{ code: "A100", role: "bars", ean: BARS },
					{ code: "A101", role: "bars", ean: BARS },
				]),
			).map((part) => part.code),
		).toEqual(["A100"]);
	});

	it("reads an unknown role as other and an unusable quantity as one", () => {
		expect(
			publicComponentEans(
				json([
					{ code: "X1", role: "priečniky", ean: BARS, qty: 0 },
					{ code: "X2", ean: FEET, qty: "2" },
					{ code: "X3", role: "kit", ean: KIT, qty: 1.5 },
				]),
			),
		).toEqual([
			{ code: "X1", role: "other", ean: BARS, qty: 1 },
			{ code: "X2", role: "other", ean: FEET, qty: 1 },
			{ code: "X3", role: "kit", ean: KIT, qty: 1 },
		]);
	});

	it("never shows an internal identifier or markup as a part code", () => {
		expect(
			publicComponentEans(
				json([
					{ code: "CFMP-B-NOR-57acce", role: "bars", ean: BARS },
					{ code: "<b>N1</b>", role: "feet", ean: FEET },
					{ code: "", role: "kit", ean: KIT },
				]),
			),
		).toEqual([]);
	});

	it("is nothing for anything that is not this shape", () => {
		for (const raw of [
			null,
			undefined,
			"",
			"  ",
			"not json",
			"{}",
			'"text"',
			"[1,2]",
			42,
			json({ code: "A" }),
		]) {
			expect(publicComponentEans(raw), String(raw)).toEqual([]);
		}
		// A list longer than any set is not a set's parts.
		expect(
			publicComponentEans(json(Array.from({ length: 13 }, (_, i) => ({ code: `P${i}`, ean: BARS })))),
		).toEqual([]);
	});
});
