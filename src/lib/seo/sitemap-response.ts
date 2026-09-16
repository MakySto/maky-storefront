/**
 * The headers the metadata-route sitemap answered with, kept for the index and the shards.
 *
 * `max-age=0, must-revalidate`: a crawler re-asks, and freshness comes from the tagged data
 * cache behind the route (`sitemap:{channel}`), which `/api/revalidate` expires per channel.
 */
export const SITEMAP_HEADERS = {
	"Content-Type": "application/xml",
	"Cache-Control": "public, max-age=0, must-revalidate",
} as const;
