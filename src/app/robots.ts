import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
	const base = getBaseUrl();

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: [
					// Private / non-content storefront areas (market-less legacy entries)
					"/checkout",
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
				],
			},
		],
		sitemap: `${base}/sitemap.xml`,
	};
}
