import { connection } from "next/server";
import { renderUrlset, sitemapShardEntries } from "@/lib/seo/sitemap";
import { SITEMAP_HEADERS } from "@/lib/seo/sitemap-response";

/**
 * `/sitemaps/{market}-{kind}-{part}.xml` — one shard named by the index at `/sitemap.xml`.
 *
 * A shard that does not exist — unknown kind, a market that is not live, a part past the end
 * — is a real 404, never an empty `<urlset>`: an empty 200 would tell a crawler those URLs
 * are gone. A route handler sets its own status, so unlike a PPR page this 404 is honest.
 */
export async function GET(
	_request: Request,
	context: { params: Promise<{ file: string }> },
): Promise<Response> {
	await connection();
	const { file } = await context.params;
	const entries = file.endsWith(".xml") ? await sitemapShardEntries(file.slice(0, -".xml".length)) : null;
	if (!entries) {
		return new Response("Not Found", { status: 404, headers: { "x-robots-tag": "noindex" } });
	}
	return new Response(renderUrlset(entries), { headers: SITEMAP_HEADERS });
}
