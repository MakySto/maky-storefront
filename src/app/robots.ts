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
					"/login",
					"/signup",
					"/orders",
					"/account",
					// Junk / ghost paths indexed under a non-market first segment.
					// The proxy has no market gate, so /admin and /products/login render
					// 200 instead of 404. The `/*/login$` / `/*/signup$` wildcards also
					// catch the real market-prefixed auth pages (e.g. /sk/login).
					// NOTE: /sk-eur/* is intentionally NOT disallowed — the proxy already
					// 301-redirects it to /sk/*, and the product/page canonicals now point
					// to /sk/*. Blocking it in robots would stop crawlers from seeing the
					// 301 and keep the stale /sk-eur/* URLs stuck in the index.
					"/admin",
					"/*/login$",
					"/*/signup$",
				],
			},
		],
		sitemap: `${base}/sitemap.xml`,
	};
}