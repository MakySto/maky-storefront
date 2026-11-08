import { type NextRequest } from "next/server";
import { SALEOR_SLUGS } from "@/lib/channel-map";
import { isInternalLoopbackToken, INTERNAL_TOKEN_HEADER } from "@/lib/internal-token";
import { vehiclePageOutcome } from "@/lib/catalog-content/vehicle-page-outcome";

/**
 * Whether a vehicle category address has a page, for the proxy's status decision.
 *
 * Internal: reachable only with this process's loopback token (`lib/internal-token.ts`); anything else is a
 * plain 404, like an unknown API path. The answer is only a status (and, for a retired page, where it went).
 * It never carries page content and is never cached.
 *
 * `path` is the vehicle part of the address, `make/model/generation`, as the visitor typed it (decoded).
 */
const NO_STORE = { "cache-control": "private, no-store" } as const;

export async function GET(request: NextRequest) {
	if (!isInternalLoopbackToken(request.headers.get(INTERNAL_TOKEN_HEADER))) {
		return new Response(null, { status: 404, headers: NO_STORE });
	}

	const params = request.nextUrl.searchParams;
	const channel = params.get("channel");
	const category = params.get("category");
	const path = params.get("path");
	if (!channel || !category || !path || !SALEOR_SLUGS.has(channel)) {
		return Response.json(
			{ error: "channel (a known one), category and path are required" },
			{ status: 400, headers: NO_STORE },
		);
	}

	try {
		const outcome = await vehiclePageOutcome(channel, category, path.split("/"));
		return Response.json(outcome, { headers: NO_STORE });
	} catch (error) {
		// Not an answer about the page: the proxy lets the request through as before.
		console.error("[vehicle-page] outcome failed:", error);
		return Response.json({ status: "undetermined" }, { headers: NO_STORE });
	}
}
