import htmlBots from "next/dist/shared/lib/router/utils/html-bots.js";

/**
 * The crawlers Next serves the finished page — metadata in <head> — instead of streaming it.
 *
 * Next's own list (`html-bots.js`: Bingbot, the link-preview bots, Chrome-Lighthouse, the
 * Google crawlers named `…-Google` / `Google-…`) leaves out Googlebot itself, because Googlebot
 * renders JavaScript; for it the metadata of a dynamic page is streamed into <body>. Google takes
 * `rel=canonical` and hreflang from <head> only. Measured 2026-09-25 in a real Chrome with
 * Googlebot's user agent: on product, category and vehicle pages the title, description,
 * canonical, all 13 hreflang links and the robots tag stayed in <body> after hydration.
 *
 * This EXTENDS Next's list and never replaces it: a custom `htmlLimitedBots` is used instead of
 * the default, which would silently drop Bingbot and the share previews. `GoogleOther` is added
 * because it has no hyphen and so matches neither `[\w-]+-Google` nor `Google-[\w-]+`.
 *
 * A bot on this list gets a blocking render: the answer waits for the page's data. That is why
 * the product page's own query has a deadline (`PRODUCT_DEADLINE_MS`), the Saleor queue lets a
 * caller with a deadline go instead of holding it behind slow queries, and — while Saleor is
 * unwell (the existence gate's breaker is open) — the proxy answers these bots 503 with
 * Retry-After instead of a page whose temporarily-unavailable state reads as `noindex`.
 */
export const HTML_LIMITED_BOTS = new RegExp(
	`${htmlBots.HTML_LIMITED_BOT_UA_RE.source}|Googlebot|GoogleOther`,
	"i",
);
