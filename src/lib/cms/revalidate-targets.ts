import { marketHref } from "@/lib/channel-map";
import { isMarketLive } from "@/lib/market-state";
import { marketHasRoute } from "@/lib/route-policy";
import { getBaseUrl } from "@/lib/seo/config";
import {
	ALL_MARKET_CODES,
	friendlyMarketFor,
	payloadLocaleForMarket,
	type MarketCode,
	type PayloadLocale,
} from "./markets";
import { type CmsRevalidateEvent } from "./revalidate-event";

/**
 * Which public addresses the CMS should check after a v2 event, and which it should not.
 *
 * The CMS knows WHAT changed and in which markets; it does not know the storefront's URLs,
 * which markets are open, or which routes a market has. This is where those meet
 * (`__fixtures__/provider-v3/revalidation-event-v2.md`, „Odpoveď v2“):
 *
 *   - one target per market the event names, for a `pages` document with a slug;
 *   - `live: true` only when the market is live (`MAKY_LIVE_MARKETS`) AND the route policy
 *     lets this page render there — the same two gates the proxy and the page apply, so a
 *     target is live exactly when a visitor could open it;
 *   - otherwise `live: false` and a reason, which the CMS shows as „trh nie je spustený“ and
 *     never retries. Nothing here opens a market;
 *   - `url` absolute and `https`, on the storefront's own origin, from the same site URL the
 *     canonical tags use. No origin, no URL — and then the target cannot be live either;
 *   - `expect: "absent"` when the document left the web (`revision: null`), and also for a
 *     market the document was just taken out of while staying published elsewhere, because
 *     that market's page 404s from now on and checking it for the new revision would fail
 *     forever.
 *
 * Every other entity answers `[]`: brands, posts, globals and images have no page the CMS
 * can check yet, so their delivery alone is recorded.
 */

export type CmsTargetReason = "market-not-live" | "route-not-available";

export interface CmsRevalidationTarget {
	readonly market: MarketCode;
	readonly locale: PayloadLocale;
	readonly live: boolean;
	readonly expect: "present" | "absent";
	readonly url: string | null;
	readonly reason?: CmsTargetReason;
}

/** Payload slugs are `[a-z0-9-]`; anything else is not something to build a URL from. */
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The public origin, or `null` when none can be vouched for.
 *
 * `getBaseUrl()` falls back to `http://localhost:3000` when the site URL is unset. That is a
 * fine default for a canonical in development and a useless one for a machine that will
 * fetch it, so anything that is not `https` counts as "no origin".
 */
function publicOrigin(): string | null {
	try {
		const url = new URL(getBaseUrl());
		return url.protocol === "https:" && url.username === "" && url.password === "" ? url.origin : null;
	} catch {
		return null;
	}
}

export function revalidationTargets(event: CmsRevalidateEvent): CmsRevalidationTarget[] {
	const v2 = event.v2;
	if (!v2 || event.entityType !== "collection" || event.entitySlug !== "pages") return [];

	// v1 `slug` is "the new slug, or the one that disappeared"; the route identities say the
	// same and are only a fallback for a body that carries them alone.
	const slug = event.slug ?? v2.routes.current?.slug ?? v2.routes.previous?.slug ?? null;
	if (!slug || !PAGE_SLUG.test(slug)) return [];

	// `[]` on a document means all twelve; the CMS expands it, but an unexpanded list must not
	// silently mean "check nothing".
	const markets = v2.markets.length > 0 ? v2.markets : ALL_MARKET_CODES;
	const current = v2.routes.current;
	const origin = publicOrigin();

	return markets.map((market): CmsRevalidationTarget => {
		const locale = payloadLocaleForMarket(market);
		const leftThisMarket =
			current !== null && current.markets.length > 0 && !current.markets.includes(market);
		const expect = v2.revision === null || leftThisMarket ? "absent" : "present";

		const friendly = friendlyMarketFor(market);
		if (!friendly || !isMarketLive(friendly)) {
			return { market, locale, live: false, expect, url: null, reason: "market-not-live" };
		}
		if (!marketHasRoute(friendly, slug) || !origin) {
			return { market, locale, live: false, expect, url: null, reason: "route-not-available" };
		}
		return { market, locale, live: true, expect, url: `${origin}${marketHref(friendly, `/${slug}`)}` };
	});
}
