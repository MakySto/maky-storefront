import { connection, type NextRequest } from "next/server";

import { checkB2bReadiness } from "@/checkout/lib/b2b/server/b2b-readiness";
import { extractBearerToken, verifySecret } from "@/lib/api-auth";

/**
 * B2B runtime preflight of the RUNNING process — for the operator, before switching the B2B checkout on.
 *
 * Answers only with the revalidate secret (the same one `/api/cache-info` and the operator tier of
 * `/api/fitment/status` want); anyone else gets a plain 404. The body carries names, ids, booleans and short codes:
 * never the token, never an Authorization header, never an environment dump. Always a fresh probe (`fresh: true`),
 * so the answer is about the token this process holds now.
 *
 * @example
 * curl -sS -H @/path/to/header-file http://127.0.0.1:3000/api/internal/b2b-readiness
 */
export async function GET(request: NextRequest) {
	await connection();
	if (!verifySecret(extractBearerToken(request))) {
		return new Response("Not Found", { status: 404 });
	}
	const readiness = await checkB2bReadiness({ fresh: true });
	return Response.json(readiness, {
		status: readiness.ok ? 200 : 503,
		headers: { "Cache-Control": "no-store" },
	});
}
