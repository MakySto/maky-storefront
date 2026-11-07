import "server-only";

import rawFamilies from "./data/rodiny_20261105.json";
import { tyreSizeIndex } from "./size-index";

/**
 * Which snow-chain code belongs to which model family, and what the family calls its size ("22,7").
 *
 * CFM's sealed batch of the 145 products carries it (`families`, and a family key on every product); this is a
 * public-facts-only copy made by `scripts/ops/build-tyre-families.mjs`, sealed like the size list. It decides one
 * thing: which OTHER codes the shop may offer when a code does not fit the size the shopper gave: the same model in
 * the size that does. It decides nothing about whether a code fits; the size list does.
 *
 * Strict, like the list: a code the size list does not know, a code missing here, or a family nobody declared means
 * the two files are not from one batch, and the module fails at load rather than offer a neighbour that is not one.
 */

export interface TyreFamily {
	readonly key: string;
	readonly label: string;
	readonly kind: "chain" | "sock";
}

export interface TyreFamiliesFile {
	schema: string;
	id: string;
	families: Record<string, { label: string; kind: string }>;
	products: Record<string, { family: string; size: string | null }>;
}

const fail = (message: string): never => {
	throw new Error(`tyre-size families: ${message}`);
};

/** Check the file against the size list and index it. Exported so a test can show what it refuses. */
export function parseTyreFamilies(raw: TyreFamiliesFile) {
	if (raw.schema !== "maky.tyre-families/1") fail(`schema ${raw.schema}`);
	const index = tyreSizeIndex();
	if (raw.id !== index.id) fail(`list ${raw.id} is not the size list ${index.id}`);

	const families = new Map<string, TyreFamily>();
	for (const [key, family] of Object.entries(raw.families)) {
		if (family.kind !== "chain" && family.kind !== "sock") fail(`family ${key} has kind ${family.kind}`);
		families.set(key, { key, label: family.label, kind: family.kind as "chain" | "sock" });
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

const DATA = parseTyreFamilies(rawFamilies as TyreFamiliesFile);

/** The family of a public code, or `null` for a code that is not a snow chain or sock of the list. */
export function tyreFamilyOf(code: string | null | undefined): TyreFamily | null {
	if (typeof code !== "string" || !DATA.familyOf.has(code)) return null;
	return DATA.families.get(DATA.familyOf.get(code) as string) ?? null;
}

/** Every code of the code's family, itself included, ascending. Empty for a code that is not on the list. */
export function tyreFamilyCodes(code: string | null | undefined): readonly string[] {
	const family = tyreFamilyOf(code);
	return family ? DATA.codesOf.get(family.key) ?? [] : [];
}

/** The size as the family names it ("22,7"), or the code itself when the family gives its sizes no name (the socks). */
export function tyreSizeLabelOf(code: string): string {
	return DATA.sizeOf.get(code) ?? code;
}
