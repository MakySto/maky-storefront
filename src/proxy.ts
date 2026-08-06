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
} from "./lib/channel-map";
import { resolveLegacyProductSlug } from "./lib/product-redirects";
import { PUBLIC_ASSET_PATHS, METADATA_ROUTE_PATHS } from "./lib/public-assets.generated";

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
 */
const RESERVED_FIRST_SEGMENTS = new Set(["checkout", "api", "_next", ".well-known"]);

/**
 * Detect the best market for a visitor based on cookie, geo, or language.
 */
function detectMarket(request: NextRequest): string {
	// Priority 1: Persisted cookie
	const cookie = request.cookies.get(COOKIE_NAME)?.value;
	if (cookie && FRIENDLY_SLUGS.has(cookie)) return cookie;

	// Priority 2: Cloudflare geo header
	const cfCountry = request.headers.get("CF-IPCountry");
	if (cfCountry && COUNTRY_TO_MARKET[cfCountry]) {
		return COUNTRY_TO_MARKET[cfCountry];
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
		if (acceptLang.toLowerCase().includes(lang)) return market;
	}

	return DEFAULT_MARKET;
}

export function proxy(request: NextRequest) {
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
			url.pathname = "/" + friendly + (rest ? "/" + rest : "");
			return NextResponse.redirect(url, 301);
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
		const url = request.nextUrl.clone();
		url.pathname = "/" + first + "/" + resolveLegacyProductSlug(segments[2]);
		return NextResponse.redirect(url, 308);
	}

	// REWRITE friendly slug -> Saleor channel slug (URL stays /sk/...)
	if (first && FRIENDLY_SLUGS.has(first)) {
		const config = CHANNEL_MAP[first];
		const rest = segments.slice(1).join("/");
		const url = request.nextUrl.clone();
		url.pathname = "/" + config.saleorSlug + (rest ? "/" + rest : "");

		const res = NextResponse.rewrite(url);
		res.headers.set("x-channel", config.saleorSlug);
		res.headers.set("x-locale", config.locale);
		res.headers.set("x-market", first);
		res.headers.set("x-currency", config.currency);
		res.cookies.set(COOKIE_NAME, first, {
			path: "/",
			maxAge: COOKIE_MAX_AGE,
			sameSite: "lax",
		});
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
