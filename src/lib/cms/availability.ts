import "server-only";
import { REVERSE_MAP } from "@/lib/channel-map";
import { fetchCmsPage } from "@/lib/cms/client";
import { marketForChannel, payloadLocaleForChannel } from "@/lib/cms/markets";
import { marketHasRoute, routePolicyFor } from "@/lib/route-policy";

/**
 * Whether a CMS-backed route should be advertised in navigation right now.
 *
 * Two different questions used to be answered by one: `marketHasRoute()` says the
 * APPLICATION offers the route in this market, which is a static decision in
 * `route-policy.ts`. It says nothing about whether an editor has published anything.
 * The footer's own comment claimed `/o-nas` "follows the CMS" while the code read only
 * the static table, so publishing or unpublishing a document changed the page and left
 * the navigation pointing wherever it had pointed before.
 *
 * ## Why this costs nothing on eleven markets
 *
 * The static gate is checked FIRST and short-circuits. A market whose policy does not
 * offer the route never reaches the CMS at all, so today — with `o-nas` still `sk` only —
 * this adds exactly one call on one market and none on the other eleven.
 *
 * That call is `fetchCmsPage`, the same cached read the page itself performs, with the
 * same `cms:page:<slug>` tag. So it is a Data Cache hit rather than a second origin
 * request, and the revalidation webhook that invalidates the page invalidates this at the
 * same moment — which is what makes an unpublish reach the navigation at all.
 *
 * ## An outage is not an unpublish
 *
 * Only an AUTHORITATIVE absence hides the link. On an upstream fault the route still
 * renders a page — the approved bootstrap where the market has one, otherwise the
 * localised "temporarily unavailable" — so removing the link would turn a transient CMS
 * problem into a navigation that looks permanently different. That distinction is the
 * whole point of the four outcomes in `page-route.tsx`.
 */
export async function cmsRouteAvailable(channel: string, slug: string): Promise<boolean> {
	if (!marketHasRoute(REVERSE_MAP[channel] ?? "", slug)) return false;

	const locale = payloadLocaleForChannel(channel);
	const market = marketForChannel(channel);
	// No Payload mapping is a configuration fault, not an editorial decision. Treat it
	// like an outage and keep the link, which matches what the route itself will render.
	if (!locale || !market) return true;

	const outcome = await fetchCmsPage(slug, locale, market);
	return outcome.status !== "not-found" && outcome.status !== "market-mismatch";
}

/** Whether `segment` is a CMS-backed route, and so needs the check above. */
export function isCmsRoute(segment: string): boolean {
	return routePolicyFor(segment)?.kind === "cms";
}
