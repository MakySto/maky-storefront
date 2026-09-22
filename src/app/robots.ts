import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";

/**
 * Crawlers that get a rate, not a ban (owner decision, 2026-09-22).
 *
 * On 2026-09-22 (00:00–20:17 UTC) ClaudeBot made 61 % of all requests (112k) and Googlebot
 * 0.2 %. Every bot PDP view costs 13–25 Saleor queries behind a 60-second cache, and the
 * evening Saleor slowdown tracked that crawl. ClaudeBot honours Crawl-delay (Anthropic's
 * crawler docs); SemrushBot and AhrefsBot do too, and the owner still uses those tools, so
 * they are slowed rather than blocked. Their own site-audit crawlers (SiteAuditBot,
 * AhrefsSiteAudit) are different user agents and are not affected.
 *
 * Search and user-triggered agents — Claude-SearchBot, Claude-User, OAI-SearchBot,
 * ChatGPT-User, PerplexityBot — are deliberately NOT listed: they are how the shop shows up
 * in AI answers, and their volume is small.
 */
const RATE_LIMITED_CRAWLERS = ["ClaudeBot", "SemrushBot", "AhrefsBot"] as const;
const CRAWL_DELAY_SECONDS = 10;

/**
 * Amazonbot ignores Crawl-delay (Amazon's docs say so), so a rate is not an option, and the
 * owner approved keeping it off the product pages. Those have no common path prefix — a
 * product lives at `/{market}/{slug}` beside every other page — so the only rule that covers
 * them is the whole site. It made 19 % of requests on 2026-09-22 and ~17k of the day's
 * `/_next/image?w=3840` encodes, for a shop that does not sell on Amazon.
 */
const BLOCKED_CRAWLERS = ["Amazonbot"] as const;

export default function robots(): MetadataRoute.Robots {
	const base = getBaseUrl();

	// A crawler obeys ONLY its most specific group, so every named group repeats these;
	// a named group without them would be allowed into /api/ and the rest.
	const disallow = [
		// Private / non-content storefront areas (market-less legacy entries)
		//
		// `/checkout` was here until 2026-09-22 and came out for the reason the
		// comment below already gives for /admin and the login pages: a URL a
		// crawler may not fetch can never be re-crawled, so it can never be
		// dropped from the index either. Both checkout routes now carry
		// `noindex, follow` (`app/(site)/checkout/layout.tsx`, 2026-09-21),
		// which is what actually keeps them out. Disallow only saved crawl
		// budget on two pages, and paid for it by freezing whatever was already
		// indexed.
		"/cart",
		"/api/",
		"/orders",
		"/account",
		// NOTE: /sk-eur/* is intentionally NOT disallowed — the proxy already
		// 301-redirects it to /sk/*, and the product/page canonicals now point
		// to /sk/*. Blocking it in robots would stop crawlers from seeing the
		// 301 and keep the stale /sk-eur/* URLs stuck in the index.
		//
		// `/admin`, `/*/login$` and `/*/signup$` used to be here and were
		// removed deliberately. Google currently has
		// /admin/categories/stresne-nosice, /admin/pages/privacy, /gb/login and
		// /products/signup in its index. The proxy 404s all four as of this
		// change — but a crawler cannot see a 404 on a URL it is forbidden to
		// fetch, so those entries would have stayed indexed indefinitely.
		// /sk/login and /sk/signup now carry `noindex, follow` instead, which
		// is the right tool for a page that must stay crawlable but must not
		// rank. These lines can return once Search Console confirms the junk
		// has dropped out.
	];

	return {
		rules: [
			// No Crawl-delay here, ever: Bing honours it, and it would throttle Bingbot too.
			{ userAgent: "*", allow: "/", disallow },
			...RATE_LIMITED_CRAWLERS.map((userAgent) => ({
				userAgent,
				allow: "/",
				disallow,
				crawlDelay: CRAWL_DELAY_SECONDS,
			})),
			...BLOCKED_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
		],
		sitemap: `${base}/sitemap.xml`,
	};
}
