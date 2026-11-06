import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isTyreSizeCode, TYRE_SIZE_CODE_LIST } from "./codes";

import {
	isTyreSizeControlled,
	parseTyreSizeIndex,
	tyrePickerData,
	tyreSizeIndex,
	tyreSizeProduct,
} from "./size-index";

const DATA = join(__dirname, "data");
const FILE = join(DATA, "velkosti_20261105.json");
const bytes = readFileSync(FILE);
const raw = JSON.parse(bytes.toString("utf8")) as Record<string, any>;

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

/** CFM's `canonical_json`: sorted keys, no whitespace, UTF-8 as written. The keys and numbers here are ASCII. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

const clone = () => structuredClone(raw);

describe("the vendored tyre-size list is the producer's file, unchanged", () => {
	const provenance = JSON.parse(readFileSync(join(DATA, "PROVENANCE.json"), "utf8")) as {
		files: Record<string, { sha256: string; self_sha256: string; git_blob_sha1: string }>;
	};
	const pinned = provenance.files["velkosti_20261105.json"];

	it("has the SHA-256 the sidecar and the provenance record", () => {
		const sidecar = readFileSync(join(DATA, "velkosti_20261105.json.sha256"), "utf8").trim().split(/\s+/);
		expect(sidecar[1]).toBe("velkosti_20261105.json");
		expect(sha256(bytes)).toBe(sidecar[0]);
		expect(sha256(bytes)).toBe(pinned.sha256);
	});

	it("has the git blob id the provenance records", () => {
		const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
		expect(blob).toBe(pinned.git_blob_sha1);
	});

	it("carries a seal that is the hash of its own content", () => {
		const { self_sha256: seal, ...body } = raw;
		expect(sha256(canonical(body))).toBe(seal);
		expect(seal).toBe(pinned.self_sha256);
	});

	it("holds public data only: no internal id, price, supplier or server path", () => {
		const text = bytes.toString("utf8").toLowerCase();
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
			expect(text.includes(forbidden), forbidden).toBe(false);
		}
		expect(Object.keys(raw.sources).sort()).toEqual(["manufacturer_list_2026_10", "previous_shop_card"]);
		for (const source of Object.values<any>(raw.sources)) expect(Object.keys(source)).toEqual(["label"]);
	});
});

describe("parseTyreSizeIndex", () => {
	it("accepts the committed list and reports what it holds", () => {
		const index = tyreSizeIndex();
		expect(index.id).toBe("snehove-retaze-20261105");
		expect(index.counts).toEqual({ conditional_products: 27, conditions: 16, products: 145, sizes: 5324 });
		expect(Object.keys(index.products)).toHaveLength(145);
		expect(Object.values(index.products).reduce((total, p) => total + p.sizes.length, 0)).toBe(5324);
	});

	it("refuses a list that is not the one that was meant to ship", () => {
		const mutate = (change: (copy: Record<string, any>) => void) => {
			const copy = clone();
			change(copy);
			return () => parseTyreSizeIndex(copy);
		};
		expect(() => parseTyreSizeIndex(null)).toThrow(/not an object/);
		expect(mutate((c) => (c.schema = "maky.tyre-size-index/2"))).toThrow(/schema/);
		expect(mutate((c) => (c.products.N16061.source = "somewhere_else"))).toThrow(/unknown source/);
		expect(mutate((c) => (c.products.N16061.sizes = []))).toThrow(/no sizes/);
		expect(mutate((c) => c.products.N16061.sizes.push(["145/70 R12", "12", ""]))).toThrow(/appears twice/);
		expect(mutate((c) => (c.products.N16061.sizes[0][2] = "c99"))).toThrow(/unknown condition/);
		expect(mutate((c) => (c.products.N16061.sizes[0] = ["145/70 R12 ", "12", ""]))).toThrow(
			/stray whitespace/,
		);
		expect(mutate((c) => (c.products.N16061.sizes[0] = ["", "12", ""]))).toThrow(/malformed row/);
		expect(mutate((c) => (c.conditions.c01.mode = "sometimes"))).toThrow(/mode/);
		expect(mutate((c) => (c.conditions.c01.tyres = []))).toThrow(/no tyres/);
		expect(mutate((c) => (c.counts.sizes += 1))).toThrow(/counts/);
		expect(mutate((c) => (c.counts.conditional_products -= 1))).toThrow(/counts/);
		expect(mutate((c) => delete c.self_sha256)).toThrow(/seal/);
	});
});

describe("tyreSizeProduct", () => {
	it("answers a code of the list and nothing else", () => {
		expect(tyreSizeProduct("N16061")?.sizes.length).toBeGreaterThan(0);
		expect(isTyreSizeControlled("N16061")).toBe(true);
		for (const other of ["A7604", "n16061", " N16061", "N16061 ", "", null, undefined]) {
			expect(tyreSizeProduct(other as string | null | undefined), String(other)).toBeNull();
		}
	});

	it("is not answered by the object's prototype", () => {
		for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
			expect(tyreSizeProduct(key), key).toBeNull();
		}
	});

	it("does not offer the combination the review invented, and offers the real one", () => {
		const sizes = tyreSizeProduct("N16061")!.sizes.map(([label]) => label);
		expect(sizes).toContain("145/70 R12");
		expect(sizes).not.toContain("145/70 R13");
	});
});

describe("tyrePickerData", () => {
	it("groups a code's sizes by rim, in numeric order, with every size once", () => {
		const data = tyrePickerData("N17144")!;
		const rims = data.rims.map((group) => Number.parseFloat(group.rim));
		expect(rims).toEqual([...rims].sort((a, b) => a - b));
		expect(new Set(data.rims.map((group) => group.rim)).size).toBe(data.rims.length);
		const listed = data.rims.flatMap((group) => group.sizes.map((size) => size.label));
		expect(new Set(listed).size).toBe(listed.length);
		expect(listed).toHaveLength(tyreSizeProduct("N17144")!.sizes.length);
	});

	it("orders half-inch rims between whole ones", () => {
		const all = Object.keys(tyreSizeIndex().products)
			.map((code) => tyrePickerData(code)!)
			.find((data) => data.rims.some((group) => group.rim.includes(".")))!;
		const rims = all.rims.map((group) => Number.parseFloat(group.rim));
		expect(rims).toEqual([...rims].sort((a, b) => a - b));
	});

	it("hands the picker only the conditions the code uses, each with its direction", () => {
		const data = tyrePickerData("N16128")!;
		expect(Object.keys(data.conditions).sort()).toEqual(["c01", "c10"]);
		expect(data.conditions.c01).toEqual({ mode: "only", tyres: ["Bridgestone Duravis Rxxx"] });
		expect(data.conditions.c10).toEqual({ mode: "not", tyres: ["Kleber", "Michelin", "Continental"] });
		const conditional = data.rims.flatMap((group) => group.sizes).filter((size) => size.conditionKey !== "");
		expect(conditional.map((size) => [size.label, size.conditionKey])).toEqual(
			expect.arrayContaining([
				["195/75 R16", "c10"],
				["215/60 R16", "c01"],
			]),
		);
	});

	it("says whose list the sizes are, and does not call the previous shop's cards a manufacturer's list", () => {
		expect(tyrePickerData("N16061")!.fromManufacturerList).toBe(true);
		expect(tyrePickerData("D0190")!.fromManufacturerList).toBe(false);
		// The list's own labels say the same in words, and the card source says it is not the manufacturer's list.
		const { sources, products } = tyreSizeIndex();
		expect(sources[products.N16061.source].label).toMatch(/výrobcu Lampa/);
		expect(sources[products.D0190.source].label).toMatch(/nie list výrobcu/);
	});

	it("is null for a code that is not size-controlled", () => {
		expect(tyrePickerData("A7604")).toBeNull();
		expect(tyrePickerData(null)).toBeNull();
	});

	it("carries nothing internal into the page", () => {
		for (const code of Object.keys(tyreSizeIndex().products)) {
			const text = JSON.stringify(tyrePickerData(code)).toLowerCase();
			expect(text.includes("cfmp"), code).toBe(false);
			expect(text.includes("tazar"), code).toBe(false);
		}
	});
});

describe("the small code set for the browser", () => {
	it("is exactly the list's codes, so a card and the server agree on which products need a size", () => {
		expect([...TYRE_SIZE_CODE_LIST].sort()).toEqual(Object.keys(tyreSizeIndex().products).sort());
		for (const code of Object.keys(tyreSizeIndex().products)) expect(isTyreSizeCode(code), code).toBe(true);
	});

	it("answers like the list for anything that is not a code", () => {
		for (const other of ["A7604", "n16061", " N16061", "constructor", "__proto__", "", null, undefined]) {
			expect(isTyreSizeCode(other as string | null | undefined), String(other)).toBe(false);
			expect(isTyreSizeControlled(other as string | null | undefined), String(other)).toBe(false);
		}
	});
});
