import { type MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
	const base = getBaseUrl();

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/checkout", "/cart", "/api/", "/login", "/signup", "/orders", "/account"],
			},
		],
		sitemap: `${base}/sitemap.xml`,
	};
}