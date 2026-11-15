import { createHash } from "node:crypto";

import type { TyreSizeIndex } from "./types";

/**
 * The model families of the snow-chain codes as a FILE: its shape, its seal, and the check that it belongs to one
 * size list. Nothing here knows which pair the shop is serving (`active-lists.ts` does).
 */

export interface TyreFamily {
	readonly key: string;
	readonly label: string;
	readonly kind: "chain" | "sock";
	/**
	 * The model's name with no noun in it ("SnowDrive", "DAC Blue ICE"), when CFM gives one (optional). A page in
	 * twelve languages says "chains" or "socks" itself, so this is what it prints beside that word.
	 */
	readonly name: string | null;
}

export interface TyreFamiliesFile {
	schema: string;
	id: string;
	families: Record<string, { label: string; kind: string; name?: string }>;
	products: Record<string, { family: string; size: string | null }>;
}

/** A families file, checked and indexed. */
export interface TyreFamiliesData {
	readonly families: ReadonlyMap<string, TyreFamily>;
	readonly familyOf: ReadonlyMap<string, string>;
	readonly sizeOf: ReadonlyMap<string, string>;
	readonly codesOf: ReadonlyMap<string, readonly string[]>;
}

const fail = (message: string): never => {
	throw new Error(`tyre-size families: ${message}`);
};

/**
 * Check the file against the size list it belongs to and index it. The two are a pair: a families file is only ever
 * read beside the one list whose codes it names.
 */
export function parseTyreFamiliesFor(raw: TyreFamiliesFile, index: TyreSizeIndex): TyreFamiliesData {
	if (typeof raw !== "object" || raw === null) fail("the file is not an object");
	if (raw.schema !== "maky.tyre-families/1") fail(`schema ${raw.schema}`);
	if (typeof raw.families !== "object" || raw.families === null) fail("no families");
	if (typeof raw.products !== "object" || raw.products === null) fail("no products");
	if (raw.id !== index.id) fail(`list ${raw.id} is not the size list ${index.id}`);

	const families = new Map<string, TyreFamily>();
	for (const [key, family] of Object.entries(raw.families)) {
		if (family.kind !== "chain" && family.kind !== "sock") fail(`family ${key} has kind ${family.kind}`);
		if (typeof family.label !== "string" || family.label.trim() === "") fail(`family ${key} has no label`);
		if (family.name !== undefined && (typeof family.name !== "string" || family.name.trim() === "")) {
			fail(`family ${key} has an empty name`);
		}
		families.set(key, {
			key,
			label: family.label,
			kind: family.kind as "chain" | "sock",
			name: family.name ?? null,
		});
	}

	const familyOf = new Map<string, string>();
	const sizeOf = new Map<string, string>();
	const codesOf = new Map<string, string[]>();
	for (const [code, product] of Object.entries(raw.products)) {
		if (!Object.hasOwn(index.products, code)) fail(`${code} is not in the size list`);
		if (!families.has(product.family)) fail(`${code} names the unknown family ${product.family}`);
		familyOf.set(code, product.family);
		if (product.size) sizeOf.set(code, product.size);
		codesOf.set(product.family, [...(codesOf.get(product.family) ?? []), code]);
	}
	for (const code of Object.keys(index.products)) {
		if (!familyOf.has(code)) fail(`${code} is in the size list and has no family`);
	}
	for (const codes of codesOf.values()) codes.sort();
	return { families, familyOf, sizeOf, codesOf };
}

/**
 * The seal a families file must carry: the SHA-256 of the file as it is written (tab-indented JSON, one trailing
 * newline) with the `self_sha256` field empty, so anyone can recompute it.
 */
export function tyreFamiliesSeal(raw: TyreFamiliesFile): string {
	const body = { ...raw, self_sha256: "" };
	return createHash("sha256")
		.update(`${JSON.stringify(body, null, "\t")}\n`, "utf8")
		.digest("hex");
}
