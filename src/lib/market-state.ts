import { CHANNEL_MAP, FRIENDLY_SLUGS, REVERSE_MAP } from "./channel-map";

/**
 * Whether a market is ready to be in Google, as opposed to merely routable.
 *
 * `CHANNEL_MAP` answers "do we know this slug". That is not the same question.
 * A channel provisioned in Saleor is an afternoon's configuration; an indexable
 * market additionally needs a stocked catalogue, translated product and category
 * names, localized legal pages, shipping zones and a payment gateway. Publishing
 * before those exist does not produce thin content, it produces WRONG content —
 * Slovak copy under `hreflang="de-DE"` — and that costs the whole domain, not
 * just the page.
 *
 * So the two facts are stored separately:
 *
 *   live      indexable. In the sitemap, in the hreflang cluster, `index, follow`.
 *   preview   reachable at its URL so it can be tested against real production
 *             data, but `noindex, nofollow`, absent from the sitemap and absent
 *             from every hreflang cluster.
 *
 * Preview is a tool, not untidiness. It is what lets a market be switched on
 * technically, filled with products and translations, and checked on production
 * — days before it is shown to a crawler.
 *
 * Today eleven of the twelve channels have an empty catalogue, and all twelve
 * currently answer `index, follow` with a self-canonical. Defaulting everything
 * except `sk` to preview is therefore strictly a correction.
 */
export type MarketState = "live" | "preview";

/**
 * Markets that are indexable when nothing overrides it.
 *
 * Deliberately just `sk`. A market joins this list — or the env override below
 * — only after it passes the checklist in
 * `docs/design/market-launch-checklist.md`.
 */
const DEFAULT_LIVE_MARKETS: readonly string[] = ["sk"];

/**
 * Env override, so a market can go live without a rebuild.
 *
 * `MAKY_LIVE_MARKETS="sk,cz"`. Server-only and read per call, never a
 * `NEXT_PUBLIC_` variable: those are inlined at build time, which is exactly the
 * rebuild this is meant to avoid. A PM2 restart is enough.
 */
const ENV_VAR = "MAKY_LIVE_MARKETS";

let warned = false;

/**
 * The live markets, in `CHANNEL_MAP` order.
 *
 * Two guards, both deliberate. Unknown names in the override are dropped rather
 * than trusted — a typo must not invent a market. And an override that resolves
 * to nothing falls back to the default rather than being honoured: an empty live
 * set would `noindex` the entire site, and a typo in an env var is not a
 * plausible reason to do that.
 */
export function liveMarkets(): readonly string[] {
	const raw = process.env[ENV_VAR];
	if (!raw) return DEFAULT_LIVE_MARKETS;

	const requested = raw
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	const known = requested.filter((m) => FRIENDLY_SLUGS.has(m));

	if (known.length !== requested.length && !warned) {
		warned = true;
		const unknown = requested.filter((m) => !FRIENDLY_SLUGS.has(m));
		console.warn(`[market-state] ${ENV_VAR} lists unknown markets, ignoring: ${unknown.join(", ")}`);
	}

	if (known.length === 0) {
		if (!warned) warned = true;
		console.warn(`[market-state] ${ENV_VAR} resolved to no known markets, falling back to the default`);
		return DEFAULT_LIVE_MARKETS;
	}

	// CHANNEL_MAP order, not the order somebody typed into the env var, so the
	// sitemap and the hreflang cluster are stable across restarts.
	return Object.keys(CHANNEL_MAP).filter((m) => known.includes(m));
}

/**
 * The resolved split, plus anything in the override that is not a market.
 *
 * Exists so the state can be reported rather than inferred. `src/instrumentation.ts`
 * prints it once at boot and `scripts/ops/deploy-production.sh` reads that line
 * back, which is what turns a typo from a quiet warning into a visible deploy
 * failure — without giving a typo the power to take the site down, since
 * `liveMarkets()` still degrades safely at runtime.
 */
export function describeMarketState(): {
	live: readonly string[];
	preview: readonly string[];
	unknown: readonly string[];
} {
	const live = liveMarkets();
	const preview = Object.keys(CHANNEL_MAP).filter((m) => !live.includes(m));

	const raw = process.env[ENV_VAR];
	const unknown = raw
		? raw
				.split(",")
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean)
				.filter((m) => !FRIENDLY_SLUGS.has(m))
		: [];

	return { live, preview, unknown };
}

/** `live` or `preview` for a friendly market slug (`sk`, `de`, …). */
export function marketState(market: string): MarketState {
	return liveMarkets().includes(market) ? "live" : "preview";
}

export function isMarketLive(market: string): boolean {
	return marketState(market) === "live";
}

/** Same question, asked with a Saleor channel slug (`sk-eur`, `de-eur`, …). */
export function isChannelLive(saleorSlug: string): boolean {
	const market = REVERSE_MAP[saleorSlug];
	return market ? isMarketLive(market) : false;
}

/**
 * `X-Robots-Tag` for every response under a market that is not live yet.
 *
 * A response header rather than `robots` metadata, and that is not a style
 * choice. `generateMetadata` has no request-time input, so under cacheComponents
 * it is evaluated once and baked into the prerendered shell — measured
 * 2026-08-06: with `MAKY_LIVE_MARKETS="sk,cz"` the sitemap picked cz up on the
 * next request while `/cz` went on serving the `noindex` from build time. Set in
 * `src/proxy.ts`, which is the only layer that sees the request.
 *
 * `nofollow` as well as `noindex`, on purpose: a preview market renders the same
 * navigation as a live one, so following it would spend crawl budget on twelve
 * duplicates of every category.
 */
export const PREVIEW_MARKET_ROBOTS_HEADER = "noindex, nofollow";

/**
 * ── What follows the env var immediately, and what waits for a deploy ──────────
 *
 *   instant   the `noindex` header (proxy, per request)
 *   instant   the sitemap (a dynamic route, re-read per request)
 *   at build  hreflang, because it is emitted from `generateMetadata` and baked
 *             into the prerendered shell
 *
 * The asymmetry is safe in the direction that matters. PROMOTING a market with
 * the env var protects nothing and reveals nothing prematurely: it stops sending
 * `noindex` and starts listing the market in the sitemap, while hreflang simply
 * stays quiet until the next deploy — a missing annotation, never a wrong one.
 * DEMOTING is instant for the header and the sitemap, but a hreflang cluster
 * baked while the market was live would keep naming it until the next deploy, so
 * a demotion should be followed by one.
 */

/** Test seam. Resets the once-only warning so a test can assert on it. */
export function resetMarketStateWarningForTests(): void {
	warned = false;
}
