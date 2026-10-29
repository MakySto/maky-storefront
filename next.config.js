import { fileURLToPath } from "node:url";

import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants.js";
import createNextIntlPlugin from "next-intl/plugin";

import { main as guardLiveBuild } from "./scripts/ops/guard-live-build.mjs";
import { CMS_MEDIA_BASE_URL } from "./src/config/cms-media.js";
import { HTML_LIMITED_BOTS } from "./src/config/html-limited-bots.js";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const cmsMediaBaseUrl = new URL(CMS_MEDIA_BASE_URL);

/**
 * How much of the page cache the running server keeps in memory, and what it is allowed to write to
 * disk. The handler is `cache-handler.mjs`; read the long comment there first.
 *
 * `cacheMaxMemorySize` sizes the in-memory LRU of BOTH of Next's page-side caches: the incremental
 * cache (rendered pages and `fetch` results, which now holds every page the build did not make) and
 * the `"use cache"` store. Next's default is 50 MB each.
 *
 * Why 256 MB: a page the handler no longer keeps on disk lives only in that LRU, and one pushed out
 * of it before it expires (an hour, `cacheLife("minutes")`) is rendered again on its next visit,
 * where the stock cache would have served the copy from disk. A market page weighs 200 to 270 KB, so
 * 256 MB holds roughly a thousand of them (sandbox, Saleor at 150 ms: a page was still in memory
 * after 800 others had been served and was pushed out after 1 600), and the box's crawlers touched
 * 900 to 1 250 distinct pages an hour by the first estimate (19 501 in 15.5 h on 2026-10-12), 1 623 on
 * median and 3 686 at the peak by the nginx log of 2026-10-13 to 15: a page then survives some 20 to
 * 25 minutes (an estimate: the `fetch` entries share the LRU), not the hour it is valid for. The
 * price is memory: at most 2 x 256 MB (both stores full) against 2 x 50 MB before, 412 MB more
 * (up to some 550 MB: the page store counts characters, and V8 keeps a string with a letter outside
 * Latin-1, such as the č or ł of the Czech and Polish pages, at two bytes a character), on a box that
 * `deploy-production.sh` requires 10 GB free on before it builds. Measured with this handler (CLAUDE.md
 * §13.3.1): `next-server` near 3.5 GB between surges and 5.0 GB at two crawler surges, where the
 * stock cache had a median of 2.5 GB and a maximum of 2.9 GB. It must never be 0: that switches the
 * memory cache off, and with it every page the handler no longer writes to disk.
 */
const pageCache = {
	cacheHandler: fileURLToPath(new URL("./cache-handler.mjs", import.meta.url)),
	cacheMaxMemorySize: 256 * 1024 * 1024,
};

/**
 * The most the optimised-image cache (`.next/cache/images`) may hold, least recently used out first.
 * Next's default is half of the free disk at the first image request, some 22 GB on the box today, and
 * a snapshot kept a copy of whatever was there (the deploy now slims it away). The ~2 GB that all of
 * `.next/cache` held in the box's
 * snapshots (2026-10-12) was `fetch-cache`, not images: images grew about 380 MB a day (905 MB after
 * 2.4 days, 2026-10-18), so the cap is reached in about a week and from then on evicts the least
 * recently used, which is what it is for; the cache can no longer outgrow it. Do not cap it with
 * `experimental.isrFlushToDisk: false`: the image optimizer only keeps this disk cache while that
 * switch is on (`image-optimizer.js`), so the cap would arrive by switching it off.
 */
const IMAGE_DISK_CACHE_BYTES = 3 * 1024 ** 3;

/** @type {import('next').NextConfig} */
const config = {
	// Cache Components (Partial Prerendering)
	// Enables mixing static, cached, and dynamic content in a single route.
	// See: https://nextjs.org/docs/app/getting-started/cache-components
	cacheComponents: true,

	// Google's crawlers get the metadata in <head>, like Bingbot and the share previews already
	// do — see src/config/html-limited-bots.js. Visitors keep the streamed metadata.
	htmlLimitedBots: HTML_LIMITED_BOTS,

	// Optimize barrel file imports for better bundle size and cold start performance
	// See: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
	experimental: {
		optimizePackageImports: ["lucide-react", "lodash-es"],
		// Note: API rate limiting is handled by RequestQueue in src/lib/graphql.ts
		// (max 3 concurrent requests + 200ms delay between requests)
	},
	images: {
		// Next's default is `['image/webp']`, so AVIF was never served — a browser
		// that explicitly offered `image/avif` still got WebP. Listing it first lets
		// content negotiation pick it when the browser actually asks.
		//
		// Measured on the six media of the reference Nordrive PDP, at the parameters
		// `image-optimizer` really uses (it encodes AVIF at `quality - 20`, effort 3):
		//
		//     w=640    webp 44 692 B  ->  avif 30 912 B   -31 %
		//     w=1080   webp 82 966 B  ->  avif 57 226 B   -31 %
		//     PSNR vs the unencoded resize: webp 48.87 dB, avif 45.05 dB
		//
		// Both sit well above the ~40 dB indistinguishable threshold, so this is a
		// transfer-size change and not a visible one. Comparing the two at the SAME
		// nominal quality is what misleads: at q=75 for both, AVIF is 12 % LARGER,
		// because the scales are not the same. Next's own compensation is what makes
		// this a win, which is why `qualities` must stay at the default `[75]` —
		// widening it would also move the AVIF target and was measured to gain
		// nothing for WebP.
		//
		// Cost: AVIF encoding is 1.5x (w=640) to 4x (w=1080) slower than WebP. That is
		// paid once per image and width, then cached, so it lands on first request
		// rather than on shoppers generally.
		//
		// Old browsers need no entry here. When Accept matches neither format,
		// `image-optimizer` falls through to the upstream type — and because Saleor's
		// thumbnails are themselves WebP, that branch is skipped and it serves JPEG.
		// So the pre-WebP fallback is JPEG today and stays JPEG.
		//
		// Failure is safe: if an encode throws or exceeds the 7 s sharp timeout,
		// `image-optimizer` serves the upstream file unchanged rather than erroring,
		// so the worst case is a WebP where an AVIF was wanted.
		formats: ["image/avif", "image/webp"],
		maximumDiskCacheSize: IMAGE_DISK_CACHE_BYTES,
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
				// The still of a product's video, which its preview shows (src/lib/video-embed.ts). The
				// shopper's browser asks this server for it, so nothing of YouTube loads before the click.
				// Exactly the one path the preview uses and no query: not an open door to the host.
				protocol: "https",
				hostname: "i.ytimg.com",
				pathname: "/vi/*/hqdefault.jpg",
				search: "",
			},
			{
				// The photographs of a Nordrive Kargo description (CFM, 2026-10-29): CFM writes their
				// addresses into the product text, and `src/lib/editorjs.ts` has the shopper's browser ask
				// this server for them, so the live CFM server is asked once per photograph and width, by
				// this one server, and not by every shopper and every robot. Exactly `/media/` on that host
				// and no query: not an open door to it.
				protocol: "https",
				hostname: "carfitmanager.com",
				pathname: "/media/**",
				search: "",
			},
			// No `hostname: "*"` any more (owner GO, 2026-09-26). It let anyone use this
			// server to fetch and re-encode an image from any host on the internet. Before it
			// went, the last two days of nginx logs were read for every `/_next/image` source:
			// 91 043 from https://cdn.maky.store/thumbnails, 282 from Saleor's
			// https://api.maky.store/thumbnail fallback, 81 local — nothing else. Both hosts
			// are listed above, and `next-image-allowlist.test.ts` checks them through Next's
			// own 400 path, with every width those logged URLs use.
			//
			// Why this is not the July outage again (fixed in 58fa984, 2026-07-31): then, removing the wildcard
			// returned 400 '"url" parameter is not allowed' for every cdn.maky.store image
			// (142 broken on one PLP) because nothing ELSE admitted that host. The explicit
			// cdn.maky.store entry exists since 58fa984. Accepting a change here still takes
			// a `next start` of a production build with real image URLs — `next dev` and a
			// homepage smoke test cannot see it.
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

/**
 * Resolve the config for Next. The injectable guard is for unit tests only;
 * Next's default export always uses the real, hardcoded production guard.
 *
 * @param {string} phase
 * @param {typeof guardLiveBuild} [runLiveBuildGuard]
 * @returns {import("next").NextConfig}
 */
export function resolveNextConfig(phase, runLiveBuildGuard = guardLiveBuild) {
	if (phase === PHASE_PRODUCTION_BUILD && runLiveBuildGuard() !== 0) {
		throw new Error(
			"Production build refused by the live storefront guard. Use scripts/ops/deploy-production.sh.",
		);
	}

	// The Dockerfile builds with NEXT_OUTPUT=standalone: a container's disk is not this box's, and a
	// standalone server keeps Next's stock cache. Development keeps it too.
	const isProduction = phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER;
	return withNextIntl(isProduction && !process.env.NEXT_OUTPUT ? { ...config, ...pageCache } : config);
}

/** @param {string} phase */
export default function nextConfig(phase) {
	return resolveNextConfig(phase, guardLiveBuild);
}
