import "server-only";

import { activeTyreLists } from "./active-lists";
import { parseTyreFamiliesFor, type TyreFamiliesFile, type TyreFamily } from "./families-file";
import { tyreSizeIndex } from "./size-index";

export type { TyreFamiliesFile, TyreFamily } from "./families-file";

/**
 * Which snow-chain code belongs to which model family, and what the family calls its size ("22,7").
 *
 * CFM's sealed batch of the 145 products carries it (`families`, and a family key on every product); CFM makes a
 * public-facts-only file from it and publishes it beside the size list, sealed like the list. It decides one
 * thing: which OTHER codes the shop may offer when a code does not fit the size the shopper gave: the same model in
 * the size that does. It decides nothing about whether a code fits; the size list does.
 *
 * Strict, like the list: a code the size list does not know, a code missing here, or a family nobody declared means
 * the two files are not from one batch, and the module fails at load rather than offer a neighbour that is not one.
 */

/** Check a families file against the list the shop is serving. Exported so a test can show what it refuses. */
export function parseTyreFamilies(raw: TyreFamiliesFile) {
	return parseTyreFamiliesFor(raw, tyreSizeIndex());
}

/** The families of the pair the shop is serving now; never kept, because the pair can be replaced (`active-lists`). */
const data = () => activeTyreLists().families;

/** The family of a public code, or `null` for a code that is not a snow chain or sock of the list. */
export function tyreFamilyOf(code: string | null | undefined): TyreFamily | null {
	if (typeof code !== "string" || !data().familyOf.has(code)) return null;
	return data().families.get(data().familyOf.get(code) as string) ?? null;
}

/** Every code of the code's family, itself included, ascending. Empty for a code that is not on the list. */
export function tyreFamilyCodes(code: string | null | undefined): readonly string[] {
	const family = tyreFamilyOf(code);
	return family ? data().codesOf.get(family.key) ?? [] : [];
}

/** The size as the family names it ("22,7"), or the code itself when the family gives its sizes no name (the socks). */
export function tyreSizeLabelOf(code: string): string {
	return data().sizeOf.get(code) ?? code;
}

/** Every family of the list, ascending by key. */
export function tyreFamilies(): readonly TyreFamily[] {
	return [...data().families.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The family a key names, or `null`. */
export function tyreFamilyByKey(key: string | null | undefined): TyreFamily | null {
	return typeof key === "string" ? data().families.get(key) ?? null : null;
}

/** Every code of a family, ascending. Empty for a key that names none. */
export function tyreCodesOfFamily(key: string): readonly string[] {
	return data().codesOf.get(key) ?? [];
}
