import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connection, type NextRequest } from "next/server";

import { extractBearerToken, verifySecret } from "@/lib/api-auth";
import { fitmentRuntimeStatus } from "@/lib/fitment/provider";

/**
 * What the RUNNING process holds — the answer to "which dataset is this server actually using?".
 *
 * CFM opens each publication batch only after the storefront confirms the `datasetHash` it
 * loaded, and the confirmation has to come from the process, not from a file or an environment
 * variable: `.env` says what a restart WOULD load, a downloaded file says what CFM published, and
 * neither says what is in this server's memory. This reads that memory. It never loads anything
 * and never reaches CFM — a status read must not be able to cause the load it reports on.
 *
 * ## Two tiers
 *
 * Everything in `dataset` is public by nature: the file is served by CFM at a public URL and the
 * hash is its own. That much answers without a secret, so a keyword monitor can pin it.
 *
 * What identifies THIS process — its pid, uptime, memory, the commit and the build — is for an
 * operator, and is returned only with the revalidate secret, the same one `/api/cache-info`
 * wants. Nothing else is exposed: no environment variable, no URL beyond host and path.
 *
 * @example
 * curl https://maky.store/api/fitment/status
 * curl -H "Authorization: Bearer <REVALIDATE_SECRET>" https://maky.store/api/fitment/status
 */

/** What `deploy-production.sh` wrote beside the build — `.next/MAKY_DEPLOY_META`. */
function deployMeta(): Record<string, string> | null {
	try {
		const raw = readFileSync(join(process.cwd(), ".next", "MAKY_DEPLOY_META"), "utf8");
		const meta: Record<string, string> = {};
		for (const line of raw.split("\n")) {
			const at = line.indexOf("=");
			if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
		}
		return meta;
	} catch {
		return null;
	}
}

function buildId(): string | null {
	try {
		return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || null;
	} catch {
		return null;
	}
}

export async function GET(request: NextRequest): Promise<Response> {
	await connection();

	const dataset = fitmentRuntimeStatus();
	const body: Record<string, unknown> = { dataset };

	if (verifySecret(extractBearerToken(request))) {
		const meta = deployMeta();
		const memory = process.memoryUsage();
		body.process = {
			pid: process.pid,
			uptimeSeconds: Math.round(process.uptime()),
			rssMB: Math.round(memory.rss / 1048576),
			heapUsedMB: Math.round(memory.heapUsed / 1048576),
			node: process.version,
		};
		body.build = {
			buildId: buildId(),
			gitSha: meta?.git_sha ?? null,
			builtAt: meta?.built_at ?? null,
		};
	}

	return Response.json(body, {
		headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
	});
}
