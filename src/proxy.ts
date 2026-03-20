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
    sk: "sk", cs: "cz", de: "de", pl: "pl", hu: "hu",
    it: "it", fr: "fr", es: "es", ro: "ro",
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
    const friendly = Object.entries(CHANNEL_MAP).find(
      ([, c]) => c.saleorSlug === first,
    )?.[0];
    if (friendly) {
      const rest = segments.slice(1).join("/");
      const url = request.nextUrl.clone();
      url.pathname = "/" + friendly + (rest ? "/" + rest : "");
      return NextResponse.redirect(url, 301);
    }
  }

  // REWRITE friendly slug -> Saleor channel slug (URL stays /sk/...)
  if (first && FRIENDLY_SLUGS.has(first)) {
    const config = CHANNEL_MAP[first];
    const rest = segments.slice(1).join("/");
    const url = request.nextUrl.clone();
    url.pathname =
      "/" + config.saleorSlug + (rest ? "/" + rest : "");

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|opengraph-image.png|twitter-image.png|.*\\..*).*)",
  ],
};
