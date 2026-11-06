import { categoryUrlFor } from "@/config/category-routes";
import { TYRE_SHELF_MARKETS, TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { FRIENDLY_SLUGS } from "@/lib/channel-map";
import { searchAfterTyreChange, tyreFilterHref } from "./listing-param";

/**
 * What the page does when the shopper has given, changed or forgotten a tyre size in the vehicle window.
 *
 * The size is a cookie, so every server-rendered surface that speaks of it has to be rendered again, and that is all
 * most pages need (a product page re-renders its fit box, the header its button). Two places want more, for the same
 * reason the car has `vehicleConfirmDestination`: the answer should arrive where the shopper can see it.
 *
 *   - **The market root.** A size entered on the homepage used to close the window and leave the page as it was. It now
 *     leads to the snow-chain shelf narrowed to that size, once, and only from there: the window is reachable from every
 *     page, and pushing someone out of their cart or their checkout because they answered a question is worse than not
 *     helping. Only a market that sells the shelf (`TYRE_SHELF_MARKETS`) is led there, and only when a size was given
 *     (forgetting one is not a request to see anything).
 *   - **The shelf itself.** What belonged to the old size goes (`searchAfterTyreChange`): the page position, and an
 *     explicit "all chains", which was said about the old size.
 *
 * Pure and client-safe: the window (client) acts on the answer; the rules are here, where a test can drive them.
 */
export type AfterTyreSize =
	/** Go to this full path, market included. */
	| { kind: "push"; path: string }
	/** Stay on the page and swap its URL for this full path (the old size's query dropped). */
	| { kind: "replace"; path: string }
	/** Stay and render again. */
	| { kind: "refresh" };

export function afterTyreSize({
	pathname,
	channel,
	search,
	size,
}: {
	/** The browser path (`usePathname()`), market included: `/sk`, `/sk/snehove-retaze`. */
	pathname: string;
	/** The Saleor channel from the route (`useParams`), when there is one. */
	channel: string | undefined;
	/** `window.location.search`, read at click time. */
	search: string;
	/** The size just remembered, or `null` when it was forgotten. */
	size: string | null;
}): AfterTyreSize {
	const segments = pathname.split("/").filter(Boolean);
	const market = segments[0];
	if (!market || !FRIENDLY_SLUGS.has(market)) return { kind: "refresh" };

	if (segments.length === 1) {
		if (size === null || !TYRE_SHELF_MARKETS.has(market)) return { kind: "refresh" };
		const shelf = categoryUrlFor(channel ?? market, TYRE_SHELF_SLUG);
		return { kind: "push", path: `/${market}${tyreFilterHref(shelf, {}, true)}` };
	}

	if (`/${segments.slice(1).join("/")}` === categoryUrlFor(channel ?? market, TYRE_SHELF_SLUG)) {
		const next = searchAfterTyreChange(search);
		if (next !== null) return { kind: "replace", path: `${pathname}${next}` };
	}
	return { kind: "refresh" };
}
