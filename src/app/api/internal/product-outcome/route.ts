import { type NextRequest } from "next/server";
import { SALEOR_SLUGS } from "@/lib/channel-map";
import { isInternalLoopbackToken, INTERNAL_TOKEN_HEADER } from "@/lib/internal-token";
import { logUpstreamError } from "@/lib/saleor/resource-outcome";
import { getProductOutcome } from "@/lib/saleor/product-outcome";

/**
 * The product page's own answer about its product, for the proxy's crawler preflight.
 *
 * Internal: reachable only with this process's loopback token (`lib/internal-token.ts`), which
 * the proxy sends and nobody else has. Anything else is a plain 404, the same answer an unknown
 * API path gets, so the route does not advertise itself.
 *
 * It calls `getProductOutcome` with the arguments the page will be rendered with — `slug` is
 * the decoded URL segment (Next's route matcher decodes `params`), `channel` the Saleor channel
 * the proxy rewrites to — so it reads or fills the page's own `"use cache"` entry. That sharing
 * is the whole point; see `lib/bot-preflight.ts`.
 *
 * The answer is only the status. It never carries product data, and it is never cached.
 */
const NO_STORE = { "cache-control": "private, no-store" } as const;

export async function GET(request: NextRequest) {
	if (!isInternalLoopbackToken(request.headers.get(INTERNAL_TOKEN_HEADER))) {
		return new Response(null, { status: 404, headers: NO_STORE });
	}

	const slug = request.nextUrl.searchParams.get("slug");
	const channel = request.nextUrl.searchParams.get("channel");
	if (!slug || !channel || !SALEOR_SLUGS.has(channel)) {
		return Response.json(
			{ error: "slug and a known channel are required" },
			{ status: 400, headers: NO_STORE },
		);
	}

	const outcome = await getProductOutcome(slug, channel);

	// The read gave up in this bundle's own Saleor queue, before anything was sent. Route
	// handlers share that queue with the sitemap walks, not with the page — so this says only
	// that the queue was full, never that Saleor is down. The preflight fails open on it.
	if (outcome.status === "upstream-error" && outcome.neverSent) {
		return Response.json({ status: "undetermined" }, { headers: NO_STORE });
	}

	if (outcome.status === "upstream-error") {
		logUpstreamError("product-preflight", outcome, { slug, channel });
		return Response.json(
			{ status: outcome.status, type: outcome.type, retryable: outcome.retryable },
			{ headers: NO_STORE },
		);
	}
	return Response.json({ status: outcome.status }, { headers: NO_STORE });
}
