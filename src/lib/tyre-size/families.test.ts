import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	parseTyreFamilies,
	tyreFamilyCodes,
	tyreFamilyOf,
	tyreSizeLabelOf,
	type TyreFamiliesFile,
} from "./families";
import { tyreSizeIndex } from "./size-index";

const FILE = join(__dirname, "data", "rodiny_20261105.json");
const text = readFileSync(FILE, "utf8");
const raw = JSON.parse(text) as TyreFamiliesFile & { self_sha256: string; origin: Record<string, string> };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const clone = () => structuredClone(raw);

describe("the families file is the one the script makes from CFM's sealed batch", () => {
	it("carries a seal that anyone can recompute: the hash of the file with that field empty", () => {
		const body = { ...raw, self_sha256: "" };
		expect(sha256(`${JSON.stringify(body, null, "\t")}\n`)).toBe(raw.self_sha256);
	});

	it("is written exactly as the script writes it, so a rebuild changes no byte", () => {
		expect(text).toBe(`${JSON.stringify(raw, null, "\t")}\n`);
	});

	it("is the file the provenance record pins, by its bytes and by its seal", () => {
		const provenance = JSON.parse(readFileSync(join(__dirname, "data", "PROVENANCE.json"), "utf8")) as {
			derived: Record<string, Record<string, string>>;
		};
		const pinned = provenance.derived["rodiny_20261105.json"];
		expect(sha256(text)).toBe(pinned.sha256);
		expect(raw.self_sha256).toBe(pinned.self_sha256);
		expect(raw.origin.batch_file_sha256).toBe(pinned.batch_file_sha256);
		expect(raw.origin.batch_self_sha256).toBe(pinned.batch_self_sha256);
	});

	it("names the batch it was made from, by its hashes", () => {
		expect(raw.origin.batch).toBe("snehove_retaze_produkty_20261105");
		expect(raw.origin.batch_file_sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(raw.origin.batch_self_sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(raw.origin.producer).toBe("scripts/ops/build-tyre-families.mjs");
	});

	it("holds public facts only: a public code, a family, a size label", () => {
		const lower = text.toLowerCase();
		for (const forbidden of [
			"cfmp",
			"cfm_product",
			'"price"',
			"tazar",
			"supplier",
			"/home/",
			"/mnt/",
			".env",
		]) {
			expect(lower.includes(forbidden), forbidden).toBe(false);
		}
		for (const product of Object.values(raw.products))
			expect(Object.keys(product).sort()).toEqual(["family", "size"]);
		for (const family of Object.values(raw.families))
			expect(Object.keys(family).sort()).toEqual(["kind", "label"]);
	});

	it("belongs to the size list: the same id, and exactly the same 145 codes", () => {
		const index = tyreSizeIndex();
		expect(raw.id).toBe(index.id);
		expect(Object.keys(raw.products).sort()).toEqual(Object.keys(index.products).sort());
		expect(Object.keys(raw.products)).toHaveLength(145);
		expect(Object.keys(raw.families)).toHaveLength(13);
	});

	it("leaves no family empty", () => {
		const used = new Set(Object.values(raw.products).map((product) => product.family));
		expect([...used].sort()).toEqual(Object.keys(raw.families).sort());
	});
});

describe("which codes are one model", () => {
	it("puts the pilot products in three families, so no pilot is the sibling of another", () => {
		expect(tyreFamilyOf("N16061")?.key).toBe("snowdrive-r9");
		expect(tyreFamilyOf("N16128")?.key).toBe("snowdrive-s16");
		expect(tyreFamilyOf("N17140")?.key).toBe("snowdrive-ponozky");
		expect(tyreFamilyOf("N16061")?.label).toBe("SnowDrive R-9");
		expect(tyreFamilyOf("N17140")?.kind).toBe("sock");
	});

	it("puts N16105 and N16128 in one family: they share the sizes they split by tyre", () => {
		expect(tyreFamilyCodes("N16105")).toContain("N16128");
		expect(tyreFamilyCodes("N16128")).toContain("N16105");
		expect(tyreFamilyCodes("N16105")).toEqual(tyreFamilyCodes("N16128"));
	});

	it("lists the codes of a family ascending, the code itself included", () => {
		for (const code of Object.keys(raw.products)) {
			const codes = tyreFamilyCodes(code);
			expect(codes, code).toContain(code);
			expect([...codes], code).toEqual([...codes].sort());
		}
	});

	it("names a size the way the product does ('22,5'), or by the code where the family names none", () => {
		expect(tyreSizeLabelOf("N16105")).toBe("22,5");
		expect(tyreSizeLabelOf("N16128")).not.toBe("N16128");
		expect(tyreSizeLabelOf("N17140")).toBe("N17140");
	});

	it("knows nothing of a code that is not on the list, nor of the prototype's names", () => {
		for (const other of [
			"A7604",
			"n16105",
			" N16105",
			"",
			null,
			undefined,
			"constructor",
			"__proto__",
			"toString",
		]) {
			expect(tyreFamilyOf(other as string | null | undefined), String(other)).toBeNull();
			expect(tyreFamilyCodes(other as string | null | undefined), String(other)).toEqual([]);
		}
	});
});

describe("a families file that is not from the batch of the size list is refused at load", () => {
	const mutate = (change: (copy: any) => void) => {
		const copy = clone();
		change(copy);
		return () => parseTyreFamilies(copy);
	};

	it("accepts the committed file", () => {
		expect(() => parseTyreFamilies(clone())).not.toThrow();
	});

	it("refuses another schema, another list, an unknown kind", () => {
		expect(mutate((c) => (c.schema = "maky.tyre-families/2"))).toThrow(/schema/);
		expect(mutate((c) => (c.id = "snehove-retaze-20261201"))).toThrow(/size list/);
		expect(mutate((c) => (c.families["snowdrive-r9"].kind = "tyre"))).toThrow(/kind/);
	});

	it("refuses a code the size list does not know, a code without a family, a family nobody declared", () => {
		expect(mutate((c) => (c.products.X9999 = { family: "snowdrive-r9", size: null }))).toThrow(
			/not in the size list/,
		);
		expect(mutate((c) => delete c.products.N16061)).toThrow(/no family/);
		expect(mutate((c) => (c.products.N16061.family = "nobody"))).toThrow(/unknown family/);
	});
});
