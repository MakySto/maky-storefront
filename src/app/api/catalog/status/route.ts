import { connection, type NextRequest } from "next/server";

import { extractBearerToken, verifySecret } from "@/lib/api-auth";
import { peekCatalogContent } from "@/lib/catalog-content/snapshot";
import { buildCatalogStatus } from "@/lib/catalog-release/status";
import { inspectRelease } from "@/lib/catalog-release/sync";
import { fitmentRuntimeStatus } from "@/lib/fitment/provider";

/**
 * What the RUNNING process serves for the catalogue — the answer CFM waits for before it calls a published
 * release adopted.
 *
 * CFM confirms an adoption from this document and from nothing else: not from the manifest it published,
 * not from the file being reachable, not from an HTTP 200. It reads the document with several GETs in a
 * row, because behind a balancer each request lands on a different process, and calls a target adopted only
 * when every live process reports the delivered file as `active`.
 *
 * Contract and schema: `backend/docs/contracts/MAKY_RELEASE_MANIFEST_CONTRACT.md` in CarFitManager-4.
 *
 * ## No side effects
 *
 * GET only (HEAD comes with it, anything else is a 405). It reads memory: it does not fetch the manifest,
 * download a file, read the disk or change any state, so a status read can never cause the load it reports
 * on. It answers 200 even before the first manifest has been seen — the document then says `missing`.
 *
 * ## Two tiers
 *
 * Everything in the document is the same for everyone and carries nothing secret (file names, hashes,
 * counts, error codes). What identifies THIS process — its pid and start time — is added only for a caller
 * holding the revalidate secret, as in `/api/fitment/status`.
 *
 * @example
 * curl https://maky.store/api/catalog/status
 */
export async function GET(request: NextRequest): Promise<Response> {
	await connection();

	const document = buildCatalogStatus(
		inspectRelease(),
		{
			content: (language) => {
				const held = peekCatalogContent(language);
				return held ? { sha256: held.sha256, pageCount: held.pageCount } : null;
			},
			fitment: () => {
				const held = fitmentRuntimeStatus();
				return held.loaded
					? {
							sha256: held.transportSha256,
							datasetHash: held.datasetHash,
							datasetVersion: held.datasetVersion,
						}
					: null;
			},
		},
		{ operator: verifySecret(extractBearerToken(request)) },
	);

	return Response.json(document, {
		headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
	});
}
