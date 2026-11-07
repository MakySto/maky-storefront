/**
 * Which category shelf is chosen by the shopper's TYRE SIZE — and where it lives.
 *
 * The snow chains and snow socks are one shelf, and one product on it is one manufacturer's code (`lib/tyre-size`).
 * Which of its 145 products fit is not a fact about a car; it is a fact about a tyre, and the shopper tells the shop
 * the size once, in the vehicle selector's second tab. On this shelf the listing can therefore narrow itself to the
 * products that fit that size (`lib/tyre-size/plp-tyre-filter`), exactly as a roof-rack shelf narrows to a saved car.
 *
 * ## Why the slug is not typed here
 *
 * The shelf is the catalogue's `snowChains` category (`config/categories.ts`), and that file is the one place a
 * category slug is written (`categories.test.ts` guards it). This file only names which catalogue entry it means, so
 * a rename in Saleor is one edit there and the tyre filter follows. Like the fitment shelves it registers nothing in
 * the navigation and changes no URL: a shelf is linked from the menu or the homepage only when the catalogue says so.
 *
 * A category that is not this one is a shelf nobody assessed. The filter leaves it alone and says nothing on it: an
 * unknown shelf is the safe direction to be wrong in (the same rule as `FITMENT_SHELVES`).
 */

import { STOREFRONT_CATEGORIES } from "./categories";

/** The catalogue entry (`StorefrontCategory.key`) of the shelf that is chosen by tyre size. */
export const TYRE_SHELF_KEY = "snowChains";

const shelf = STOREFRONT_CATEGORIES.find((category) => category.key === TYRE_SHELF_KEY);
if (!shelf) throw new Error(`tyre shelf: the catalogue has no category with the key ${TYRE_SHELF_KEY}`);

/** The Saleor (base) slug of the shelf. */
export const TYRE_SHELF_SLUG: string = shelf.slug;

/** Is this base slug the shelf whose products are chosen by tyre size? */
export function isTyreShelf(baseSlug: string | null | undefined): boolean {
	return typeof baseSlug === "string" && baseSlug === TYRE_SHELF_SLUG;
}

/**
 * The markets (friendly slugs, `/sk`) whose shop sells the shelf. Only there does a tyre size given on the homepage lead
 * to it: on any other market the shelf holds nothing yet, and sending a shopper to an empty page because they answered
 * a question is worse than leaving them where they were. Add a market here on the day CFM opens the shelf in it.
 */
export const TYRE_SHELF_MARKETS: ReadonlySet<string> = new Set(["sk"]);
