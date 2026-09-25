import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
	CHANNEL_MAP,
	FRIENDLY_SLUGS,
	SALEOR_SLUGS,
	COUNTRY_TO_MARKET,
	DEFAULT_MARKET,
	COOKIE_NAME,
	COOKIE_MAX_AGE,
	cartSegment,
	marketHref,
} from "./lib/channel-map";
import { resolveLegacyProductSlug } from "./lib/product-redirects";
import { orderConfirmationHandoff } from "./lib/order-confirmation-handoff";
import { marketSlugRedirect, sameCfmProduct } from "./lib/market-slug-redirects";
import { marketLanguageCode } from "./config/market-language";
import { catalogRedirectTarget } from "./lib/catalog-content/redirects";
import { CATEGORY_ROUTE_PREFIX, isCategorySlug } from "./config/categories";
import {
	categoryBaseSlug,
	categorySegment,
	isLocalizedRootSegment,
	mappedCategoryFor,
} from "./config/category-routes";
import { categoryAliasTarget, listingCategoryAliasTarget } from "./lib/catalog-content/category-aliases";
import { PUBLIC_ASSET_PATHS, METADATA_ROUTE_PATHS } from "./lib/routing.generated";
import { isMarketLive, liveMarkets, PREVIEW_MARKET_ROBOTS_HEADER } from "./lib/market-state";
import { isRouteMissingInMarket, routePolicyFor } from "./lib/route-policy";
import {
	CMS_PREVIEW_CACHE_CONTROL,
	CMS_PREVIEW_ROBOTS_HEADER,
	hasCmsPreviewCookies,
} from "./lib/cms/preview-cookies";
import {
	classifyRoute,
	gateEnabledFor,
	isGateEnabled,
	lookupExistence,
	lookupTranslatedProduct,
	normalizePathname,
} from "./lib/route-existence";

/**
 * First path segments that are legitimately not a market.
 *
 * Enumerated from `src/app/`, not from memory: `/checkout` and `/checkout/complete`
 * are the only real market-less pages. `api` and `_next` are also excluded by the
 * matcher below; they are repeated here so that a future edit to the matcher cannot
 * silently 404 them. Certbot uses the dns-cloudflare and nginx authenticators, not
 * webroot, so the ACME path does not depend on this app — but it costs nothing to
 * keep it safe.
 *
 * What is NOT in this list any more: "anything containing a dot". See the matcher.
 *
 * `sitemaps` holds the sitemap shards the index at `/sitemap.xml` names
 * (`/sitemaps/sk-products-1.xml`). Their route answers a real 404 for any name it does not
 * serve, so reserving the segment opens nothing.
 */
const RESERVED_FIRST_SEGMENTS = new Set(["checkout", "api", "_next", ".well-known", "sitemaps"]);

/**
 * Detect the best market for a visitor based on cookie, geo, or language.
 *
 * ── Every source is filtered through `isMarketLive` ──────────────────────────
 *
 * A preview market is a direct-access QA surface, not a destination we send
 * people to. Without this filter a visitor from Germany opening
 * `https://maky.store/` would be redirected into `/de` the moment that channel
 * exists in Saleor — an unfinished storefront with no catalogue, no translated
 * legal pages and no working payment, chosen for them automatically.
 *
 * That covers all three inputs, including the cookie: visiting `/de` directly
 * persists `maky-market=de`, so without the filter one QA visit would pin that
 * browser to the preview market for a year.
 *
 * Reaching `/de` by typing it stays fully supported — see the rewrite branch,
 * which serves it with `X-Robots-Tag: noindex`.
 */
function detectMarket(request: NextRequest): string {
	// Priority 1: Persisted cookie
	const cookie = request.cookies.get(COOKIE_NAME)?.value;
	if (cookie && FRIENDLY_SLUGS.has(cookie) && isMarketLive(cookie)) return cookie;

	// Priority 2: Cloudflare geo header
	const cfCountry = request.headers.get("CF-IPCountry");
	const geoMarket = cfCountry ? COUNTRY_TO_MARKET[cfCountry] : undefined;
	if (geoMarket && isMarketLive(geoMarket)) {
		return geoMarket;
	}

	// Priority 3: Accept-Language
	const acceptLang = request.headers.get("Accept-Language") || "";
	const langMap: Record<string, string> = {
		sk: "sk",
		cs: "cz",
		de: "de",
		pl: "pl",
		hu: "hu",
		it: "it",
		fr: "fr",
		es: "es",
		ro: "ro",
	};
	for (const [lang, market] of Object.entries(langMap)) {
		if (acceptLang.toLowerCase().includes(lang) && isMarketLive(market)) return market;
	}

	// DEFAULT_MARKET is `sk`, which is in the default live set. If somebody ever
	// takes it out of MAKY_LIVE_MARKETS, fall back to whatever is live rather
	// than redirecting the root at a noindex storefront.
	return isMarketLive(DEFAULT_MARKET) ? DEFAULT_MARKET : liveMarkets()[0] ?? DEFAULT_MARKET;
}

/**
 * The market URL a retired product slug moved to — but only once it is really there.
 *
 * PUBLIC_MARKET_URL_V2: CFM owns the foreign market slug and publishes the old → new map.
 * The storefront must have this support deployed BEFORE the swap, and must not move anyone
 * before it: until CFM writes the new slug into Saleor, the OLD url is the one that serves the
 * product, and a redirect would take a working page away. So the answer is only "yes" when
 * the target resolves in that market's own language AND the product it resolves to is the one
 * the map names — Saleor's `externalReference` against CFM's `cfm_product_id`. Anything else
 * (absent, a different product, an upstream we could not reach) leaves the request alone.
 *
 * Returns the new slug, or null. One hop: the map is flattened when it is read.
 */
async function movedMarketSlug(market: string, slug: string): Promise<string | null> {
	const alias = marketSlugRedirect(market, slug);
	if (!alias) return null;

	const language = marketLanguageCode(market);
	const channel = CHANNEL_MAP[market]?.saleorSlug;
	if (!language || !channel) return null;

	const answer = await lookupTranslatedProduct(alias.newSlug, channel, language);
	if (answer.verdict !== "exists") return null;
	return sameCfmProduct(answer.externalReference, alias.cfmProductId) ? alias.newSlug : null;
}

/**
 * Rewrite a friendly market slug onto its Saleor channel slug.
 *
 * Extracted so that the fail-open path below returns the *same* response the
 * success path does, rather than a second implementation that can drift from it.
 * Every market URL that this file does not claim for a redirect or a 404 ends up
 * here, and so does any request whose handling threw.
 */
function marketRewrite(
	request: NextRequest,
	market: string,
	gateVerdict: string | null,
	/**
	 * Path after the market to serve INSTEAD of the one that was requested, with no
	 * leading slash. Only the root-level category URLs use it: the public URL is
	 * `/sk/stresne-nosice`, the page file lives at `categories/[slug]`, and this is
	 * what bridges the two without moving the file or changing the visible URL.
	 */
	internalRest?: string,
): NextResponse {
	const config = CHANNEL_MAP[market];
	const rest = internalRest ?? request.nextUrl.pathname.split("/").filter(Boolean).slice(1).join("/");
	const url = request.nextUrl.clone();
	url.pathname = "/" + config.saleorSlug + (rest ? "/" + rest : "");

	const res = NextResponse.rewrite(url);
	if (gateVerdict) res.headers.set("x-maky-gate", gateVerdict);
	res.headers.set("x-channel", config.saleorSlug);
	res.headers.set("x-locale", config.locale);
	res.headers.set("x-market", market);
	res.headers.set("x-currency", config.currency);

	// A market that is not live yet must not be indexed — and this is the only
	// layer that can decide it per request.
	//
	// It started life in (main)/layout.tsx as `robots` metadata. That does not
	// work: generateMetadata has no request-time input, so under cacheComponents
	// it is evaluated once and baked into the prerendered shell. Measured
	// 2026-08-06 on a production build — with MAKY_LIVE_MARKETS="sk,cz" the
	// sitemap picked cz up on the next request while /cz went on serving the
	// `noindex` from build time. Same reason the 404 status has to live here.
	//
	// X-Robots-Tag is equivalent to the meta tag for Google and applies to every
	// response under the market, RSC payloads included.
	if (!isMarketLive(market)) {
		res.headers.set("x-robots-tag", PREVIEW_MARKET_ROBOTS_HEADER);
	}
	// Only a LIVE market becomes sticky. The cookie is a year-long persistent
	// preference, and it is read outside this file too — the checkout locale
	// fallback in src/checkout/lib/server/resolve-fallback-locale.ts uses it.
	// One QA visit to /de must not pin a browser to an unfinished market for a
	// year, nor quietly switch a real customer's checkout language. Navigating
	// inside a preview market still works: the market comes from the URL.
	if (isMarketLive(market)) {
		res.cookies.set(COOKIE_NAME, market, {
			path: "/",
			maxAge: COOKIE_MAX_AGE,
			sameSite: "lax",
		});
	}
	return res;
}

/**
 * A CMS page (`o-nas`, `poradna` — a `cms` route in `route-policy.ts`) requested inside a CMS
 * draft preview session: BOTH Next's Draft Mode cookie and `maky-cms-preview` are present.
 *
 * `__fixtures__/provider-v3/preview-v1.md` requires the preview to work for all twelve
 * markets without opening any of them, so only for such a request the route-policy 404 below
 * steps aside and the page itself decides. It is a narrow door:
 *
 *   - exactly `/{market}/{cms-slug}` (plus Next's `.rsc` forms) — nothing below it, no other
 *     route, never the checkout;
 *   - cookie PRESENCE only; the page then needs Draft Mode to be genuinely on (Next checks
 *     its cookie against the build's secret) and the CMS to accept the token on every load,
 *     and without both it renders exactly what it would anyway — for a market outside the
 *     policy, a 404 body;
 *   - the response is `noindex, nofollow` and `private, no-store`, whatever the market;
 *   - nothing is enabled: the market stays not-live, no `maky-market` cookie is set for it,
 *     no link, sitemap entry or hreflang appears.
 *
 * Without both cookies nothing here changes.
 */
function isCmsPreviewPage(request: NextRequest): boolean {
	if (!hasCmsPreviewCookies(request.cookies)) return false;
	const normalized = normalizePathname(request.nextUrl.pathname).split("/").filter(Boolean);
	return (
		normalized.length === 2 &&
		FRIENDLY_SLUGS.has(normalized[0]) &&
		routePolicyFor(normalized[1])?.kind === "cms"
	);
}

/**
 * Note on the `x-channel` / `x-locale` / `x-market` / `x-currency` headers below:
 * they are set on the RESPONSE, and nothing in the app reads an `x-*` header off
 * the REQUEST (verified: the only request-header reads are the revalidate secret
 * and the rate limiter's forwarded-for). So there is no spoofing vector to strip.
 * If a component ever starts reading one, it must be stripped from the incoming
 * request first.
 */
async function route(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const segments = pathname.split("/").filter(Boolean);
	const first = segments[0];

	// STATIC ASSETS AND ROOT METADATA ROUTES -> hands off.
	//
	// The matcher used to exclude every path containing a dot, which is how these
	// were kept safe. It also let /admin.php, /wp-login.php and /does.not.exist
	// skip the gate below and answer 200 + index,follow with a self-canonical, on a
	// domain whose entire legacy inventory is WordPress .php URLs. The matcher no
	// longer does that, so the real files have to be recognised here instead —
	// from a generated list, because /logo.svg is indistinguishable from a bogus
	// market prefix by shape alone.
	if (PUBLIC_ASSET_PATHS.has(pathname) || METADATA_ROUTE_PATHS.has(pathname)) {
		return NextResponse.next();
	}

	// ORDER CONFIRMATION -> the order id leaves the URL: 303 + HttpOnly cookie.
	//
	// `/checkout/complete?order=<id>` put the credential for the order into the URL of a
	// document that loads the tag manager, and from there into every page_view and consent
	// ping sent to GA4 and Google Ads, and into the referrer of the next page. Decided here,
	// before any page renders, for the same PPR reason the redirects below live here. See
	// src/lib/order-confirmation-handoff.ts.
	const handoff = orderConfirmationHandoff(request);
	if (handoff) return handoff;

	// ROOT: geo-detect -> redirect to /xx
	if (pathname === "/") {
		const market = detectMarket(request);
		const url = request.nextUrl.clone();
		url.pathname = "/" + market;
		const res = NextResponse.redirect(url);
		res.cookies.set(COOKIE_NAME, market, {
			path: "/",
			maxAge: COOKIE_MAX_AGE,
			sameSite: "lax",
		});
		return res;
	}

	// BLOCK direct access to Saleor slugs (e.g. /sk-eur -> redirect to /sk)
	if (first && SALEOR_SLUGS.has(first)) {
		const friendly = Object.entries(CHANNEL_MAP).find(([, c]) => c.saleorSlug === first)?.[0];
		if (friendly) {
			const rest = segments.slice(1).join("/");
			const url = request.nextUrl.clone();
			url.pathname = marketHref(first, rest ? "/" + rest : "");
			return NextResponse.redirect(url, 301);
		}
	}

	// LOCALISED CART URL -> the shared internal `/cart` route.
	//
	// The physical App Router directory stays language-neutral while shoppers and
	// search engines see their market's word. This runs before the existence gate;
	// otherwise `/sk/kosik` is indistinguishable from a product slug and can 404.
	//
	// The decision uses the normalized pathname, while the rewrite keeps Next's
	// `.rsc` and `/_segments/…segment.rsc` suffixes for client navigation.
	if (first && FRIENDLY_SLUGS.has(first)) {
		const normalized = normalizePathname(pathname).split("/").filter(Boolean);
		const requested = normalized.length === 2 ? normalized[1] : undefined;
		const canonical = cartSegment(first);

		if (requested === "cart" && canonical !== "cart") {
			const rawRest = segments.slice(1).join("/");
			const url = request.nextUrl.clone();
			url.pathname = marketHref(first, "/" + rawRest);
			return NextResponse.redirect(url, 308);
		}

		if (requested === canonical && canonical !== "cart") {
			const rawRest = segments.slice(1).join("/");
			const internalRest = "cart" + rawRest.slice(canonical.length);
			return marketRewrite(request, first, null, internalRest);
		}
	}

	// RETIRED PRODUCT URL: /{market}/products/{slug} -> /{market}/{slug}
	//
	// Issued here, at the edge, and not from the route file: the app router page
	// runs under PPR, so its shell is already flushed by the time a redirect()
	// could set a status — the response comes back 200, not 308. Proven on a
	// local production build before this moved up here.
	//
	// Only the DETAIL url redirects; /{market}/products is the product listing
	// and must keep rendering.
	if (first && FRIENDLY_SLUGS.has(first) && segments.length === 3 && segments[1] === "products") {
		const rootSlug = resolveLegacyProductSlug(segments[2]);
		// If that slug has also been replaced in this market, go to the replacement directly.
		// Two redirects for one click is the chain the contract forbids.
		const moved = await movedMarketSlug(first, rootSlug);
		const url = request.nextUrl.clone();
		url.pathname = "/" + first + "/" + (moved ?? rootSlug);
		return NextResponse.redirect(url, moved ? 301 : 308);
	}

	// RETIRED CATEGORY URL: /{market}/categories/{slug} -> /{market}/{slug}
	//
	// Same edge, same reason as the products redirect above: under PPR a redirect()
	// from the route file comes back 200, because the shell is flushed before it can
	// set a status. Proven once already by that migration; not re-litigated here.
	//
	// ONLY for a slug in src/config/categories.ts, and that condition is load-bearing.
	// Saleor holds 30 categories and the catalogue names 8; the other 22 keep this URL
	// as their real one, because the root namespace is resolved from a build-time set
	// and would soft-404 them. Redirecting every /categories/ URL would send
	// `/sk/prislusenstvo-k-stresnym-boxom` to a page that does not exist — turning a
	// working listing into a 404 for the sake of a tidier path.
	//
	// Only the DETAIL url redirects; `/{market}/categories` has no page either way.
	//
	// Straight to the market's CANONICAL root, in one hop: `/cz/categories/stresne-nosice` goes
	// to `/cz/stresni-nosice`, not to `/cz/stresne-nosice` and from there onwards. The Czech
	// spelling under `/categories/` is accepted too, since it is what a link built from a
	// translated Saleor slug would produce. Slovakia is unchanged: its segment is the slug.
	if (first && FRIENDLY_SLUGS.has(first) && segments.length === 3 && segments[1] === CATEGORY_ROUTE_PREFIX) {
		const mapped = mappedCategoryFor(first, segments[2]);
		if (isCategorySlug(segments[2]) || mapped?.placement === "root") {
			const url = request.nextUrl.clone();
			url.pathname = "/" + first + "/" + categorySegment(first, categoryBaseSlug(first, segments[2]));
			return NextResponse.redirect(url, 308);
		}
		// A listing category (not a root one) with a localized segment keeps `/categories/`,
		// and only its spelling changes: `/cz/categories/nordrive-stresne-nosice` → the Czech one.
		const listing = listingCategoryAliasTarget(first, segments[2]);
		if (listing) {
			const url = request.nextUrl.clone();
			url.pathname = "/" + first + listing;
			return NextResponse.redirect(url, 301);
		}
	}

	// RETIRED VEHICLE PAGE: /{market}/{catalogue path} -> the page that replaced it, 301.
	//
	// CFM retires a vehicle page when its car turns out to be a different car: the products
	// move, the fitment tree drops the node, and the page stays in the content export with
	// its text — so without this it answers 200 with the not-found body. Same edge, and the
	// same PPR reason, as the two redirects above. 301 because CFM asked for 301.
	//
	// The table is data, keyed by CFM language: `lib/catalog-content/redirects.ts`. Decided
	// on the NORMALIZED path, so an in-app `.rsc` navigation onto a retired page is sent to
	// the plain replacement too, which the client router follows as a full navigation.
	if (first && FRIENDLY_SLUGS.has(first) && segments.length >= 2) {
		const rest = normalizePathname(pathname).split("/").filter(Boolean).slice(1);
		const target = catalogRedirectTarget(first, "/" + rest.join("/"));
		if (target) {
			const url = request.nextUrl.clone();
			url.pathname = "/" + first + target;
			return NextResponse.redirect(url, 301);
		}
	}

	// A CATEGORY URL SPELLED THE OTHER WAY: 301 to the market's canonical spelling.
	//
	// A foreign market's canonical root is localized (`/cz/stresni-nosice`, COMMERCE-2 M1) and
	// every link the storefront built before that pointed at the Slovak one. Those keep working
	// through this redirect, one hop, query kept. The exception is the handful of pages the
	// catalogue itself still publishes under the Slovak root abroad — see
	// `lib/catalog-content/category-aliases.ts` — which answer where they are and pull the
	// localized spelling over to them instead.
	//
	// After the retired-page redirect on purpose: a retired path spelled either way is sent to
	// its replacement directly rather than through the alias first. Same PPR reason as above
	// for doing it here at all.
	if (first && FRIENDLY_SLUGS.has(first) && segments.length >= 2) {
		const rest = normalizePathname(pathname).split("/").filter(Boolean).slice(1);
		const target = categoryAliasTarget(first, rest);
		if (target) {
			const url = request.nextUrl.clone();
			url.pathname = "/" + first + target;
			return NextResponse.redirect(url, 301);
		}
	}

	// A MARKET SLUG CFM HAS REPLACED -> ONE permanent redirect, and not a moment early.
	//
	// The public URL of a foreign market's product is authored in CFM (PUBLIC_MARKET_URL_V2).
	// When CFM allocates a new one it publishes old → new, and the old URL must keep working
	// until the new slug is actually in Saleor — the swap is a separate step, and this
	// storefront has to be ready before it, not after. `movedMarketSlug` is what enforces
	// "ready, but not early": it redirects only when the new slug resolves in this market and
	// belongs to the same CFM product.
	//
	// Whether a path is a product URL at all is `classifyRoute`'s answer, not a second set of
	// rules here — so a localized category root, the cart word, `/products`, `/search` and the
	// legal pages are excluded by the same logic the existence gate uses. Slovakia never
	// enters: its slug is the base row and CFM sends no SK entries.
	//
	// Decided on the NORMALIZED path so an in-app `.rsc` navigation is sent to the plain
	// replacement, which the client router then follows as a full navigation.
	if (first && FRIENDLY_SLUGS.has(first) && first !== DEFAULT_MARKET) {
		const decision = classifyRoute(first, normalizePathname(pathname).split("/").filter(Boolean));
		if (decision?.family === "product") {
			const moved = await movedMarketSlug(first, decision.slug);
			if (moved) {
				const url = request.nextUrl.clone();
				url.pathname = "/" + first + "/" + moved;
				return NextResponse.redirect(url, 301);
			}
		}
	}

	// A ROUTE THAT EXISTS, BUT NOT IN THIS MARKET -> real 404.
	//
	// The seven Slovak legal pages and the two CMS pages are `sk` only: each calls
	// notFound() for another channel. But `export const metadata` on them has no
	// such branch, so /de/kontakt answered HTTP 200 with a fully indexable Slovak
	// <head> over a 404-ed body. Selling into Germany on Slovak terms is a
	// compliance problem before it is an SEO one.
	//
	// Decided from the route policy, so it costs no upstream call and ships ahead
	// of the resource-existence gate. A market gains these the moment it has its
	// own translated set — see docs/design/market-launch-checklist.md.
	//
	// Except for a CMS page inside a CMS preview session — see `isCmsPreviewPage`.
	const cmsPreview = isCmsPreviewPage(request);
	if (
		first &&
		FRIENDLY_SLUGS.has(first) &&
		segments[1] &&
		isRouteMissingInMarket(first, segments[1]) &&
		!cmsPreview
	) {
		const url = request.nextUrl.clone();
		url.pathname = "/_not-found";
		return NextResponse.rewrite(url, {
			status: 404,
			headers: { "x-robots-tag": "noindex" },
		});
	}

	// RESOURCE EXISTENCE GATE -> real 404 for a product, collection, category or
	// Saleor page that the authority says is not there.
	//
	// This is the only layer that can decide it. Under cacheComponents the status
	// line is committed before any page component's lookup resolves, and the
	// compiler enforces that — see docs/design/seo-hard-404-analysis-20260806.md.
	// The Next docs prescribe the same remedy by name.
	//
	// Ships OFF and stays off until ROUTE_EXISTENCE_GATE=on plus an explicit
	// market and family list. `absent` is the ONLY verdict that 404s; a timeout,
	// a non-200, malformed JSON, GraphQL errors, an open breaker or a saturated
	// concurrency limit all return `unknown` and fall through to exactly today's
	// behaviour. See src/lib/route-existence.ts for why that asymmetry is the
	// whole safety argument.
	//
	// `x-maky-gate` is attached to every gated response, not just the 404s. During
	// the canary rollout the question is not only "did anything 404" but "is the
	// gate even looking at this URL, and what did it conclude" — and a header is
	// the only way to ask that of a live request without turning on debug logging.
	let gateVerdict: string | null = null;

	if (first && FRIENDLY_SLUGS.has(first) && isGateEnabled()) {
		const decision = classifyRoute(first, normalizePathname(pathname).split("/").filter(Boolean));

		if (!decision) {
			gateVerdict = "unclassified";
		} else if (!gateEnabledFor(first, decision.family)) {
			gateVerdict = `${decision.family}:not-armed`;
		} else {
			const verdict = await lookupExistence(decision.family, decision.slug, decision.channel);
			gateVerdict = `${decision.family}:${verdict}`;

			if (verdict === "absent") {
				const url = request.nextUrl.clone();
				// `/_not-found`, and it has to be.
				//
				// A market-aware target under `[channel]` was tried first and measured:
				// the gate reported `x-maky-gate: product:absent`, rewrote there with
				// `status: 404`, and the response came back HTTP 200. That route is
				// partially prerendered (◐), and a PPR route takes its status from its
				// own prerender entry — app-page.js:1112 — which overrides the
				// rewrite's. `/_not-found` is fully static (○), so the rewrite status
				// stands. Same constraint that put this decision in the proxy at all,
				// arriving from a third direction.
				//
				// The cost is the body: a gate 404 renders the English global page
				// rather than the localized market one. An in-app notFound() still gets
				// the localized boundary. Recovering it needs a fully static per-market
				// 404, which is a follow-up — the status is the part that matters to a
				// crawler.
				url.pathname = "/_not-found";
				return NextResponse.rewrite(url, {
					status: 404,
					headers: { "x-robots-tag": "noindex", "x-maky-gate": gateVerdict },
				});
			}
		}
	}

	// REWRITE friendly slug -> Saleor channel slug (URL stays /sk/...)
	//
	// A root-level category is carried onto its route file in the same hop. The root
	// is a namespace shared with product slugs, and this set is what tells them apart
	// without an upstream call on every request: `/sk/stresne-nosice` is a category,
	// `/sk/stresny-nosic-nordrive-...` falls through to `[productSlug]`.
	//
	// A category slug wins over a product with the same slug. That case does not exist
	// (0 of 9,587 product slugs collide) and `pnpm check:nav` fails if it ever does —
	// but the precedence has to be decided somewhere, and shadowing a product is the
	// recoverable direction: the product keeps a working URL under `/{market}/products/`,
	// while a shadowed category would have no URL at all.
	if (first && FRIENDLY_SLUGS.has(first)) {
		// Decided on the NORMALIZED path and rewritten with the raw one.
		//
		// Client-side navigation asks for `/sk/stresne-boxy.rsc` and
		// `/sk/stresne-boxy/_segments/<id>.segment.rsc`. Matching the raw segment
		// against the catalogue misses both — `"stresne-boxy.rsc"` is not a category
		// slug — so the category would fall through to `[productSlug]` and every
		// in-app link into a category would break while the first, full-page load
		// looked perfect. The suffix has to survive into the rewrite, though, or Next
		// gets a document request where it asked for a flight response.
		const normalized = normalizePathname(pathname).split("/").filter(Boolean);
		// `>= 2`, not `=== 2`: the vehicle category pages live BELOW a category slug
		// (`/sk/stresne-nosice/bmw/...`) and are served by a catch-all inside the same
		// internal `categories/[slug]` route. Adding a real `stresne-nosice/` directory
		// instead would have made the slug a market-root segment, which
		// `categories.test.ts` forbids outright — a category slug and a route segment
		// must stay distinguishable, or `[productSlug]` cannot tell them apart.
		//
		// A foreign market's localized root (`/cz/stresni-nosice`) is carried the same way, with
		// its own spelling kept in the internal path: the vehicle pages are looked up by the URL
		// the catalogue publishes them under, and the page maps the segment back to the base slug
		// for Saleor. Only the market's own spelling — `/cz/dachtraeger` is not a category here.
		const internalRest =
			normalized.length >= 2 &&
			(isCategorySlug(normalized[1]) || isLocalizedRootSegment(first, normalized[1]))
				? CATEGORY_ROUTE_PREFIX + "/" + segments.slice(1).join("/")
				: undefined;
		const res = marketRewrite(request, first, gateVerdict, internalRest);
		// A preview is never indexed or stored, in a live market as much as in any other.
		if (cmsPreview) {
			res.headers.set("x-robots-tag", CMS_PREVIEW_ROBOTS_HEADER);
			res.headers.set("cache-control", CMS_PREVIEW_CACHE_CONTROL);
		}
		return res;
	}

	// INVALID FIRST SEGMENT -> real 404.
	//
	// Everything above this point has claimed the request or it is not a market
	// URL at all. Without this gate `[channel]` accepted any string, so
	// /pilcicke-nohavice-engelbert-strauss-kwf-profi, /wishlist, /admin and
	// /products all rendered the storefront with a 200 and `index, follow` — and
	// then the rendered page's own navigation emitted seven category links under
	// that same bogus prefix. Google indexed the result. It was a generator, not
	// a stray URL.
	//
	// The status has to be decided here and not in a page component: under PPR
	// the shell is already flushed by the time notFound() could run, so the
	// response would come back 200 with a noindex tag — which does not remove
	// anything already in the index. The acceptance criterion is `curl -I`.
	if (first && !RESERVED_FIRST_SEGMENTS.has(first)) {
		const url = request.nextUrl.clone();
		url.pathname = "/_not-found";
		return NextResponse.rewrite(url, {
			status: 404,
			headers: { "x-robots-tag": "noindex" },
		});
	}

	return NextResponse.next();
}

/**
 * The response to fall back to when our own code throws.
 *
 * NOT `NextResponse.next()`. That emits `x-middleware-next: 1` and leaves the URL
 * untouched, so the app matches `[channel] = "sk"` instead of `"sk-eur"`: an empty
 * catalogue, Slovak copy under every market, no preview `noindex`, and — because
 * the legal pages test `REVERSE_MAP[channel] !== "sk"` — all seven statutory pages
 * calling notFound() on the Slovak market. A blanket next() would turn one thrown
 * exception into a worse outage than the exception. So a market URL still gets its
 * channel rewrite; next() is right only for a path with no market prefix.
 */
function failOpen(request: NextRequest): NextResponse {
	try {
		const first = request.nextUrl.pathname.split("/").filter(Boolean)[0];
		return first && FRIENDLY_SLUGS.has(first) ? marketRewrite(request, first, "error") : NextResponse.next();
	} catch {
		// Rebuilding the rewrite is itself what broke. Nothing left to try.
		return NextResponse.next();
	}
}

/**
 * Fail open on any exception, and say so in the log.
 *
 * The gate below was designed to fail open on what *Saleor* does — a timeout, a
 * 5xx, malformed JSON. It was not designed to fail open on what *this file* does,
 * and the proxy runs before every page: an exception here is a site-wide 500, not
 * a degraded page.
 *
 * `classifyRoute` calling bare `decodeURIComponent` on an attacker-supplied
 * segment was the throw site that prompted this. Measured before believing it:
 * a singly-malformed `/sk/%E0%A4%A` never reaches us at all — nginx answers 400
 * and Next rejects the URL before the proxy runs — so that particular input was
 * never the 500 it was reported to be. A DOUBLE-encoded `/sk/%25E0%25A4%25A` does
 * arrive, and decodes cleanly, so it did not throw either. The guard stays because
 * "no input reaches it today" is a property of nginx and of Next's URL handling,
 * not of this file, and neither is ours to depend on.
 *
 * That is also the argument for this wrapper. A guard only covers the throw site
 * somebody thought of, and the one somebody thought of turned out not to be the
 * live one. This covers the ones nobody has found yet.
 *
 * `await route(...)` — the await is load-bearing. Returning the promise unawaited
 * would let a rejection escape the try block entirely.
 */
export async function proxy(request: NextRequest) {
	try {
		return await route(request);
	} catch (error) {
		console.error(
			`[proxy] ${JSON.stringify({
				event: "fail-open",
				pathname: request.nextUrl.pathname,
				gate: isGateEnabled(),
				name: error instanceof Error ? error.name : typeof error,
				message: error instanceof Error ? error.message : String(error),
			})}`,
		);
		return failOpen(request);
	}
}

export const config = {
	// Only `api` and `_next` are excluded here. The previous pattern also carried
	// `.*\..*`, i.e. every path containing a dot anywhere — which meant the proxy
	// never ran for /admin.php, /wp-login.php, /index.php or /does.not.exist. Those
	// answered HTTP 200 with `index, follow` and a self-canonical, and the rendered
	// page emitted twelve more crawlable links under the same bogus prefix. It was
	// the same generator the invalid-first-segment gate was written to kill, still
	// open for dotted segments, on a domain migrated off WooCommerce.
	//
	// Static files and root metadata routes are now recognised inside `proxy()`
	// from a generated list instead. That costs one Set lookup on requests that
	// used to skip the proxy entirely, and buys a gate with no hole in it.
	matcher: ["/((?!api/|_next/).*)"],
};
