import createNextIntlPlugin from "next-intl/plugin";

import { CMS_MEDIA_BASE_URL } from "./src/config/cms-media.js";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const cmsMediaBaseUrl = new URL(CMS_MEDIA_BASE_URL);

/** @type {import('next').NextConfig} */
const config = {
	// Cache Components (Partial Prerendering)
	// Enables mixing static, cached, and dynamic content in a single route.
	// See: https://nextjs.org/docs/app/getting-started/cache-components
	cacheComponents: true,

	// Optimize barrel file imports for better bundle size and cold start performance
	// See: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
	experimental: {
		optimizePackageImports: ["lucide-react", "lodash-es"],
		// Note: API rate limiting is handled by RequestQueue in src/lib/graphql.ts
		// (max 3 concurrent requests + 200ms delay between requests)
	},
	images: {
		remotePatterns: [
			{
				// Saleor Cloud CDN
				hostname: "*.saleor.cloud",
			},
			{
				// Saleor Media (common pattern)
				hostname: "*.media.saleor.cloud",
			},
			{
				// Payload public media CDN — the runtime parser enforces the same origin.
				protocol: cmsMediaBaseUrl.protocol.slice(0, -1),
				hostname: cmsMediaBaseUrl.hostname,
				port: cmsMediaBaseUrl.port,
				pathname: `${cmsMediaBaseUrl.pathname}**`,
			},
			{
				// Every product image on the live site comes from here — 284 of them on a
				// single crawl of /sk, /sk/products and one category. Saleor is SELF-HOSTED,
				// so the two *.saleor.cloud patterns above match nothing in this deployment
				// and provide no cover for it.
				protocol: "https",
				hostname: "cdn.maky.store",
			},
			{
				// Saleor's on-demand thumbnail endpoint, the fallback when no generated
				// thumbnail exists yet.
				protocol: "https",
				hostname: "api.maky.store",
			},
			{
				// Kept deliberately. Narrowing this is a good idea and NOT this commit's job:
				// it is CLAUDE.md §10 deployment configuration, it needs its own approval, and
				// it needs an acceptance step that a homepage smoke test cannot give you.
				// Removing it here returned HTTP 400 '"url" parameter is not allowed' for
				// every cdn.maky.store image on a real production build — 142 broken images on
				// one PLP — while /logo-deer.webp kept working, so the homepage looked fine.
				// `next dev` cannot see this; only `next start` can.
				hostname: "*",
			},
		],
	},
	typedRoutes: false,

	// Used in the Dockerfile
	output:
		process.env.NEXT_OUTPUT === "standalone"
			? "standalone"
			: process.env.NEXT_OUTPUT === "export"
				? "export"
				: undefined,

	// Cache headers for static assets and API routes
	async headers() {
		const isDev = process.env.NODE_ENV === "development";
		return [
			// In development, prevent aggressive caching of dynamic chunks
			...(isDev
				? [
						{
							source: "/_next/static/chunks/:path*",
							headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
						},
					]
				: []),
			{
				// Static assets - cache for 1 year (immutable with hash in filename)
				source: "/_next/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				// Public folder assets - cache for 1 month (logos, favicons, etc.)
				source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|webmanifest)",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=2592000, stale-while-revalidate=31536000",
					},
				],
			},
			{
				// OG Image API - cache for 1 day
				source: "/api/og",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=86400, stale-while-revalidate=604800",
					},
				],
			},
		];
	},

	// Logging configuration
	logging: {
		fetches: {
			fullUrl: process.env.NODE_ENV === "development",
		},
	},
};

export default withNextIntl(config);
