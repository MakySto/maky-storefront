/**
 * Where to send the shopper after they confirm a vehicle.
 *
 * Confirming used to do nothing visible. Measured on production `3b0843f`: picking
 * ŠKODA → Octavia Combi → 2024 → roof type → "Potvrdiť vozidlo" on the homepage closed
 * the sheet and left the URL at `/sk`. The hero invites "Vyberte vaše vozidlo" and then
 * the answer never arrives — the shopper has told us about their car and has nothing to
 * show for it.
 *
 * ## Why this is deliberately narrow
 *
 * Most surfaces already answer the question in place, and moving the shopper off them
 * would be a regression, not a fix:
 *
 *   - a PDP re-renders its compatibility box for the car that was just chosen;
 *   - a listing narrows itself when the vehicle filter is on;
 *   - `/konfigurator` and `/garage` are about the vehicle to begin with.
 *
 * The selector is reachable from the header on EVERY page, so the rule has to be safe on
 * every page — including the ones where navigating away would interrupt something the
 * shopper is in the middle of. Pushing someone out of their cart, their checkout or
 * their order history because they picked a car is a worse failure than not helping
 * them, and it is the kind of failure that only shows up in a real session.
 *
 * So this navigates from the market root and nowhere else — and "market root" means a
 * segment that is a market in `CHANNEL_MAP`, not just a path with one segment. That is
 * exactly the case that is broken, it cannot interrupt a task, and any route added later
 * inherits "stay", which is today's behaviour and the safe direction to be wrong in.
 *
 * The destination is `/konfigurator` rather than a filtered category listing: it is a
 * reserved root segment, so nothing here has to know a category slug — which
 * `categories.test.ts` forbids outside `src/config/categories.ts` anyway — and the page
 * is built for this question. It names the vehicle, counts the complete sets that fit
 * it, and when there are none it explains which of five situations applies instead of
 * showing an empty list.
 */

import { FRIENDLY_SLUGS } from "@/lib/channel-map";
import { vehicleViewQuery, type VehicleView } from "@/lib/fitment/vehicle-view";

/** Reserved for the market segment itself: `/sk` is one segment, `/sk/anything` is two. */
const MARKET_ROOT_SEGMENT_COUNT = 1;

/**
 * A channel-relative path to push, or `null` to stay put and re-render in place.
 *
 * `pathname` is the browser path (`usePathname()`), not the rewritten internal route:
 * the proxy maps `/sk/stresne-boxy` onto the `categories/[slug]` file, and it is the
 * public shape that says whether the shopper is standing on the homepage.
 */
export function vehicleConfirmDestination(pathname: string): string | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length !== MARKET_ROOT_SEGMENT_COUNT) return null;
	// The segment has to BE a market, not merely be alone. Counting segments was the
	// first version of this and it was wrong in the one way that mattered: `/checkout`
	// is a real single-segment route (`src/app/(site)/checkout/page.tsx`, outside `[channel]`),
	// so changing your car while paying would have pushed you out of the checkout —
	// exactly the failure this function exists to avoid. `/sk/cart` has two segments and
	// passed its test, which is how the hole survived it.
	return FRIENDLY_SLUGS.has(segments[0]!) ? "/konfigurator" : null;
}

/** The page that answers for whichever car the garage holds. A reserved root segment in every market. */
const CONFIGURATOR_SEGMENT = "konfigurator";

/**
 * The confirmed car's OWN page, with the year and the roof in the address, or `null` to fall back
 * to the rule above.
 *
 * The owner asked for addresses a shopper can save and send (2026-11-27), and for the selector to
 * end where the category's vehicle pages already are, so that there is one listing and not two.
 * `vehiclePath` is that page in this market (`loadVehiclePagePath`), market prefix included, and it
 * is `null` where the market has no page for the car: then nothing here applies.
 *
 * The same caution as above decides WHERE this may move the shopper from. It is the places whose
 * whole subject is "which sets are for my car", where staying would leave them looking at an
 * answer for a different question:
 *
 *   - the market root, which used to send them to `/konfigurator`;
 *   - `/konfigurator` itself;
 *   - the roof-rack shelf and the vehicle pages below it. The shelf is read off `vehiclePath`
 *     (its first two segments), so no category slug is spelled here, in any language.
 *
 * A product page, a brand's shelf, the cart, the checkout and the account stay where they are and
 * re-render in place: the product page's box answers for the new car, a brand's shelf keeps its
 * vehicle filter, and nobody is pushed out of a task because they picked a car.
 */
export function vehiclePageDestination(
	pathname: string,
	vehiclePath: string | null,
	view: VehicleView,
): string | null {
	if (!vehiclePath) return null;
	const here = pathname.split("/").filter(Boolean);
	const page = vehiclePath.split("/").filter(Boolean);
	// A vehicle page is market / shelf / make / model / generation. Anything shorter is not one.
	if (page.length < 3 || !FRIENDLY_SLUGS.has(page[0]!) || here[0] !== page[0]) return null;

	const atRoot = here.length === MARKET_ROOT_SEGMENT_COUNT;
	const atConfigurator = here.length === 2 && here[1] === CONFIGURATOR_SEGMENT;
	const onShelf = here.length >= 2 && here[1] === page[1];
	if (!atRoot && !atConfigurator && !onShelf) return null;
	return `${vehiclePath}${vehicleViewQuery(view)}`;
}

/**
 * Search params a change of vehicle invalidates, dropped when the shopper stays put.
 *
 * A cursor is a position in ONE ordered result set. Change the car with `?vehicle=1` on
 * and the set becomes a different one, so continuing from a row that belonged to the old
 * set is meaningless — the same reasoning `vehicleFilterHref` already applies when the
 * filter itself is toggled, and there is no principled reason for the two to differ.
 *
 * Honest limit of what was tested: on 2026-09-08 this was reproduced only as far as the
 * URL — the stale cursor DOES survive a vehicle change — and no false-empty page could
 * be produced from it. Measured against live Saleor, an ALFA ROMEO Giulietta (11 sets)
 * and a ŠKODA Octavia Combi NX (9 sets) each rendered every one of their products behind
 * a deep cursor from a FIAT Panda page, so Saleor appears to ignore an `after` it cannot
 * place. This is therefore a correctness fix, not a repair of a defect anyone has seen,
 * and it is worth making because that tolerance is Saleor's to withdraw and because a
 * different sort order need not behave the same way.
 */
const PAGINATION_PARAMS = ["cursor", "direction"] as const;

/**
 * The query string with pagination removed, or `null` when there was none to remove.
 *
 * `null` rather than an unchanged string so the caller can tell "nothing to do" from
 * "navigate to this", and re-render in place instead of pushing an identical URL.
 */
export function searchWithoutPagination(search: string): string | null {
	const params = new URLSearchParams(search);
	if (!PAGINATION_PARAMS.some((param) => params.has(param))) return null;
	for (const param of PAGINATION_PARAMS) params.delete(param);
	const query = params.toString();
	return query ? `?${query}` : "";
}
