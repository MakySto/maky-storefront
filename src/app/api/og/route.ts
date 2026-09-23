/**
 * /api/og used to draw Open Graph images with next/og's ImageResponse. Nothing linked to it,
 * and ImageResponse on Node is the path of GHSA-vcvr-r3jv-pc5j (remote code execution,
 * next >=16.2.0 <16.3.6), so the renderer was removed. Without a route of its own the URL
 * fell through to [channel]/[productSlug] and answered 200 with a "product not found" page,
 * which is not true of anything. The endpoint is gone and says so.
 *
 * Keep this file after the upgrade too: a rollback to a build older than the removal brings
 * the renderer back, and the Cloudflare rule is what covers that, not this.
 */
export function GET() {
	return new Response(null, { status: 410 });
}
