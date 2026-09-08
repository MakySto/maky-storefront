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
 * So this navigates from the market root and nowhere else. That is exactly the case that
 * is broken, it cannot interrupt a task, and any route added later inherits "stay",
 * which is today's behaviour and the safe direction to be wrong in.
 *
 * The destination is `/konfigurator` rather than a filtered category listing: it is a
 * reserved root segment, so nothing here has to know a category slug — which
 * `categories.test.ts` forbids outside `src/config/categories.ts` anyway — and the page
 * is built for this question. It names the vehicle, counts the complete sets that fit
 * it, and when there are none it explains which of five situations applies instead of
 * showing an empty list.
 */

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
	return segments.length === MARKET_ROOT_SEGMENT_COUNT ? "/konfigurator" : null;
}
