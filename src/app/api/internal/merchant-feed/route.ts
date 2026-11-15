import { connection, type NextRequest } from "next/server";

import { extractBearerToken, verifySecret } from "@/lib/api-auth";
import { readFeedPage } from "@/lib/merchant-feed/page";

/**
 * One step of the Google Merchant feed walk, for the writer on this server (`scripts/ops/merchant-feed.mjs`).
 *
 *   GET /api/internal/merchant-feed?market=sk[&after=<cursor>][&first=50]
 *
 * The feed is made by the running shop and not by a second program with rules of its own, because Google
 * compares every feed item with its page: price, availability, code and URL come from the functions the
 * page itself uses (`lib/merchant-feed/item.ts`).
 *
 * Operator only. It answers with the revalidate secret (as `/api/internal/b2b-readiness` does); anyone
 * else gets a plain 404, so the route does not advertise itself. Each call is one heavy Saleor read past
 * the cache, which is why it is not open: the finished feed is, at `/feeds/google-<market>.xml.gz`.
 */
const NO_STORE = { "cache-control": "private, no-store" } as const;

export async function GET(request: NextRequest) {
	await connection();
	if (!verifySecret(extractBearerToken(request))) {
		return new Response("Not Found", { status: 404, headers: NO_STORE });
	}

	const params = request.nextUrl.searchParams;
	const market = params.get("market");
	if (!market) {
		return Response.json({ error: "market is required" }, { status: 400, headers: NO_STORE });
	}
	const first = params.get("first");
	const result = await readFeedPage(market, params.get("after") || null, first ? Number(first) : undefined);
	if (!result.ok) {
		return Response.json({ error: result.error }, { status: result.status, headers: NO_STORE });
	}
	return Response.json(result.page, { headers: NO_STORE });
}
