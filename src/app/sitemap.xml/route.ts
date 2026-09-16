import { connection } from "next/server";
import { renderSitemapIndex, sitemapShards } from "@/lib/seo/sitemap";
import { SITEMAP_HEADERS } from "@/lib/seo/sitemap-response";

/**
 * `/sitemap.xml` — the sitemap INDEX: one `<sitemap>` per shard of every live market.
 *
 * It stays at this URL because robots.txt and Search Console name it; an index is a valid
 * answer there. The shards are `app/sitemaps/[file]/route.ts`, the logic `lib/seo/sitemap.ts`.
 *
 * Request-time on purpose (`connection()`): the live market list is read per request, as it
 * was, so `MAKY_LIVE_MARKETS` still reaches the sitemap with a restart and no rebuild. The
 * Saleor walk behind it is cached per channel for an hour and expired by `/api/revalidate`.
 *
 * A catalogue that cannot be read in full throws, and the index answers 500 instead of a
 * short list — see `sitemap()` in the library for why that is the safer of the two.
 */
export async function GET(): Promise<Response> {
	await connection();
	const shards = await sitemapShards();
	return new Response(renderSitemapIndex(shards), { headers: SITEMAP_HEADERS });
}
