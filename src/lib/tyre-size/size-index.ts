import "server-only";

import { activeTyreLists } from "./active-lists";
import type { TyreSizeIndex, TyreSizeProduct } from "./types";

export { parseTyreSizeIndex } from "./size-index-file";

/**
 * The tyre sizes of the snow-chain and snow-sock codes (CFM's `velkosti_20261105.json`, copied in verbatim).
 *
 * One product on this shop is one manufacturer's code, and one code fits dozens to hundreds of tyre sizes (5 806
 * rows over 145 codes). The size the customer chose is not a variant of the product; it is data on the cart line.
 * This list is what decides, on the page and again on the server when the line is added, whether a size belongs to
 * a code: a size is never converted, never rounded to a neighbour, and the condition on a tyre make or model that
 * the list attaches to some sizes never disappears.
 *
 * Which list that is, is not fixed at build time: the copy in `data/` is what a process starts with, and a list CFM
 * publishes later takes its place without a deploy (`active-lists.ts`). So nothing here, and nothing that reads
 * this, may keep the list or anything computed from it in a module-level constant: ask each time
 * (`perTyreLists` for what is costly to compute).
 *
 * Server-only on purpose. A client component that imported this would put the whole list in the browser; the page
 * hands the browser only the verdict for the one code it shows and the one size the shopper gave (`size-lookup`).
 */

/** The list's own id ("snehove-retaze-20261105"): written on the cart line so a later reader knows which list it was checked against. */
export function tyreSizeListId(): string {
	return activeTyreLists().index.id;
}

export function tyreSizeIndex(): TyreSizeIndex {
	return activeTyreLists().index;
}

/**
 * The sizes of a public product code, or `null` when the code is not one of the size-controlled ones.
 *
 * `Object.hasOwn`, not a property read: a code is attacker-shaped text, and `"constructor"` or `"__proto__"` must
 * not be answered by the object's prototype.
 */
export function tyreSizeProduct(code: string | null | undefined): TyreSizeProduct | null {
	if (typeof code !== "string" || code === "") return null;
	const { products } = tyreSizeIndex();
	return Object.hasOwn(products, code) ? products[code] : null;
}

export function isTyreSizeControlled(code: string | null | undefined): boolean {
	return tyreSizeProduct(code) !== null;
}

/** The manufacturer's own list, as against the previous shop's cards: the customer is told which one it is. */
const MANUFACTURER_SOURCE = /^manufacturer_list/;

/** Is this source key the manufacturer's own list (and not the supplier's data from the previous shop's cards)? */
export const isManufacturerListSource = (source: string): boolean => MANUFACTURER_SOURCE.test(source);
