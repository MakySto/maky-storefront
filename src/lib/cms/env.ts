import "server-only";

/**
 * Payload CMS connection settings.
 *
 * Every value here is server-only and must never carry a `NEXT_PUBLIC_` prefix.
 * The Cloudflare Access service token is what gets this box past the Access gate
 * in front of cms.maky.store, so handing it to the browser would hand out the key
 * to the whole CMS. `import "server-only"` makes an accidental client import a
 * build error rather than a silent leak.
 *
 * Read at call time, not at module scope. A module-scope read is captured once at
 * process start, which turns "the secret is in .env now" into a silent 401 until
 * somebody remembers the process still needs restarting — the same trap
 * `src/lib/api-auth.ts` sits in today.
 */
export interface CmsConnection {
	readonly baseUrl: string;
	readonly accessClientId: string;
	readonly accessClientSecret: string;
	readonly timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** `null` when the CMS is not configured — callers must fall back, never guess. */
export function readCmsConnection(): CmsConnection | null {
	const baseUrl = process.env.PAYLOAD_CMS_URL?.trim();
	const accessClientId = process.env.PAYLOAD_CF_ACCESS_CLIENT_ID?.trim();
	const accessClientSecret = process.env.PAYLOAD_CF_ACCESS_CLIENT_SECRET?.trim();

	if (!baseUrl || !accessClientId || !accessClientSecret) return null;

	const configuredTimeout = Number.parseInt(process.env.PAYLOAD_CMS_FETCH_TIMEOUT_MS ?? "", 10);
	const timeoutMs =
		Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;

	return {
		// Trailing slashes would produce `//api/pages`, which Access redirects.
		baseUrl: baseUrl.replace(/\/+$/, ""),
		accessClientId,
		accessClientSecret,
		timeoutMs,
	};
}
