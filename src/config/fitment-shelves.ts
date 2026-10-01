/**
 * Which category shelves the vehicle filter may speak for — and what is on each.
 *
 * ## Why this is not part of the category registry
 *
 * `STOREFRONT_CATEGORIES` decides what the site LINKS to: the menu, the homepage tiles and the
 * root URL of a category (`/sk/stresne-nosice`, which the proxy resolves from a build-time set).
 * Whether the vehicle filter may narrow a listing is a different question, and it used to ride on
 * that registry as a `fitmentKind` field. That tied the filter to navigation: the Thule and
 * Nordrive roof-rack shelves (`thule-stresne-nosice`, `nordrive-stresne-nosice`) are real Saleor
 * categories with real listings, they are deliberately NOT in the registry — a registry entry
 * gives a category a root URL, a menu slot and a proxy rule — and so the filter treated both as
 * a shelf it had never assessed and said nothing on them. With 9 150 Thule sets about to land on
 * one of them, the shelf where a car-less list is least useful was the one with no car filter.
 *
 * Adding a shelf here changes NO URL and registers nothing in the navigation.
 *
 * ## What an entry means — and what it does not
 *
 * The kind is what is ON the shelf. It is NOT a promise that the dataset covers that kind: the
 * dataset says what it covers (`coverage.scope.productKinds`) and the filter narrows only where
 * the two agree (`plp-vehicle-filter.ts`). So the boxes, bike carriers and ski carriers stay
 * listed here, as they were in the registry, and stay silent for as long as CFM ships only
 * roof-rack sets.
 *
 * Measured on production 2026-09-07 with a saved ŠKODA: `?vehicle=1` emptied roof boxes, bike
 * carriers, ski carriers, roof tents and car fridges — 101, 188, 26, 9 and 7 products to zero —
 * each under the headline "Zobrazujeme iba produkty overené pre ŠKODA Octavia Combi NX". The
 * programme covers roof-rack SETS, so every one of those five was a claim never earned. That
 * is why an unknown slug is `null` and not "roof racks": a slug nobody listed here is a shelf
 * nobody assessed. In particular the accessory, spare-part and fitting-kit buckets under the
 * roof-rack category are NOT here — a set's id never names one of their products.
 *
 * Keyed by the BASE (Slovak) slug, which is how Saleor, the cache tags and this lookup know a
 * category; abroad the page turns the localized URL segment back into it first
 * (`categoryBaseSlug` in `category-routes.ts`).
 */

import type { ProductKind } from "@/lib/fitment/contract";

export const FITMENT_SHELVES: Readonly<Record<string, ProductKind>> = {
	/** The main roof-rack category: it holds every set, both makers' children included. */
	"stresne-nosice": "roof-rack-set",
	/** The Thule child category — the shelf the 9 150-set opening lands on. */
	"thule-stresne-nosice": "roof-rack-set",
	"nordrive-stresne-nosice": "roof-rack-set",
	// Kinds the dataset does not cover today; listed so that the day CFM ships one, its shelf
	// starts answering with no storefront change.
	"stresne-boxy": "roof-box",
	"nosice-bicyklov": "bike-carrier",
	"nosice-lyzi": "ski-carrier",
};

/**
 * The fitment product kind on this category's shelf, or `null` when the compatibility
 * programme makes no claim about it.
 *
 * `null` is the safe direction: an unknown shelf is one nobody assessed, so the vehicle filter
 * must leave it alone.
 */
export function shelfFitmentKind(slug: string): ProductKind | null {
	return Object.hasOwn(FITMENT_SHELVES, slug) ? FITMENT_SHELVES[slug]! : null;
}
