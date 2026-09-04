import "server-only";

/**
 * Connection settings for the Payload forms endpoints.
 *
 * Every value is server-only and must never carry a `NEXT_PUBLIC_` prefix. The
 * Cloudflare Access service token opens the network boundary and the HMAC secret
 * authorises writing a legally significant record, so either one in the browser would
 * let anyone forge a withdrawal notice. `import "server-only"` turns an accidental
 * client import into a build error instead of a silent leak.
 *
 * Read at call time, not at module scope. A module-scope read is captured once at
 * process start, which turns "the secret is in .env now" into a silent 401 until
 * somebody remembers the process still needs restarting.
 *
 * The CF Access pair is deliberately the SAME one the CMS reader uses: it is one
 * Cloudflare application in front of one host. The HMAC secret is separate because it
 * authorises a different thing.
 */
export interface FormsConnection {
	readonly baseUrl: string;
	readonly accessClientId: string;
	readonly accessClientSecret: string;
	readonly hmacSecret: string;
	readonly timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/** `null` when forms are not configured — callers must degrade, never guess. */
export function readFormsConnection(): FormsConnection | null {
	const baseUrl = process.env.PAYLOAD_CMS_URL?.trim();
	const accessClientId = process.env.PAYLOAD_CF_ACCESS_CLIENT_ID?.trim();
	const accessClientSecret = process.env.PAYLOAD_CF_ACCESS_CLIENT_SECRET?.trim();
	const hmacSecret = process.env.MAKY_FORMS_HMAC_SECRET?.trim();

	if (!baseUrl || !accessClientId || !accessClientSecret || !hmacSecret) return null;

	const configured = Number.parseInt(process.env.MAKY_FORMS_TIMEOUT_MS ?? "", 10);
	const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;

	return {
		// A trailing slash would produce `//api/forms/...`, which Access redirects.
		baseUrl: baseUrl.replace(/\/+$/, ""),
		accessClientId,
		accessClientSecret,
		hmacSecret,
		timeoutMs,
	};
}

/**
 * Which settings are missing, for an operational log line.
 *
 * Returns names only. A caller must never be tempted to log the values, and having a
 * ready-made "what is missing" list is what stops somebody printing the object.
 */
export function missingFormsSettings(): string[] {
	return (
		[
			["PAYLOAD_CMS_URL", process.env.PAYLOAD_CMS_URL],
			["PAYLOAD_CF_ACCESS_CLIENT_ID", process.env.PAYLOAD_CF_ACCESS_CLIENT_ID],
			["PAYLOAD_CF_ACCESS_CLIENT_SECRET", process.env.PAYLOAD_CF_ACCESS_CLIENT_SECRET],
			["MAKY_FORMS_HMAC_SECRET", process.env.MAKY_FORMS_HMAC_SECRET],
		] as const
	)
		.filter(([, value]) => !value?.trim())
		.map(([name]) => name);
}
