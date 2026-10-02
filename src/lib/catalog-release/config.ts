/**
 * Where the release manifest comes from, read from the environment at call time.
 *
 *   MAKY_RELEASE_MANIFEST_URL   the pointer, `https://…/MANIFEST.json`. Unset = release mode is off and the
 *                               process behaves exactly as before: `MAKY_CATALOG_CONTENT_*` and
 *                               `MAKY_FITMENT_*` decide everything.
 *   MAKY_RELEASE_POLL_SECONDS   how often the pointer is asked for again. Default 30, kept within 10–300.
 *
 * Read at call time rather than at module scope because the deploy changes it with a restart, and a tested
 * module must be able to see a different value on the next call.
 *
 * Precedence, stated once because it was the quiet trap: `MAKY_RELEASE_MANIFEST_URL` > `MAKY_CATALOG_CONTENT_PATH`
 * > `MAKY_CATALOG_CONTENT_URL`. The older two stay as the answer for a market only until the manifest has
 * verified a file for it; after that they are never consulted again for that market, because they may be older
 * than what the page is already showing. Boot prints both settings side by side so the order is visible.
 */

export type ReleaseConfig = {
	/** The one address the pointer is ever read from. */
	readonly manifestUrl: string;
	readonly pollMs: number;
	readonly manifestTimeoutMs: number;
	readonly fileTimeoutMs: number;
};

export type ReleaseSetting =
	| { readonly kind: "off" }
	/** Set, but not usable. Release mode stays off and boot says so, loudly. */
	| { readonly kind: "invalid"; readonly reason: string }
	| { readonly kind: "on"; readonly config: ReleaseConfig };

const DEFAULT_POLL_SECONDS = 30;
const MIN_POLL_SECONDS = 10;
const MAX_POLL_SECONDS = 300;
const DEFAULT_MANIFEST_TIMEOUT_MS = 10_000;
const DEFAULT_FILE_TIMEOUT_MS = 60_000;

function number(name: string, fallback: number, min: number, max: number): number {
	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? Math.min(max, Math.max(min, raw)) : fallback;
}

export function releaseSetting(): ReleaseSetting {
	const raw = process.env.MAKY_RELEASE_MANIFEST_URL?.trim();
	if (!raw) return { kind: "off" };

	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { kind: "invalid", reason: "MAKY_RELEASE_MANIFEST_URL is not a URL" };
	}
	// The pointer decides what a whole market serves. It is read over TLS from one configured address and
	// from nowhere else; a plain-http pointer is not a configuration anyone should be able to run.
	if (url.protocol !== "https:") return { kind: "invalid", reason: "MAKY_RELEASE_MANIFEST_URL is not https" };
	if (url.username || url.password) {
		return { kind: "invalid", reason: "MAKY_RELEASE_MANIFEST_URL must not carry credentials" };
	}

	return {
		kind: "on",
		config: {
			manifestUrl: url.toString(),
			pollMs:
				number("MAKY_RELEASE_POLL_SECONDS", DEFAULT_POLL_SECONDS, MIN_POLL_SECONDS, MAX_POLL_SECONDS) * 1000,
			manifestTimeoutMs: number(
				"MAKY_RELEASE_MANIFEST_TIMEOUT_MS",
				DEFAULT_MANIFEST_TIMEOUT_MS,
				1000,
				60_000,
			),
			fileTimeoutMs: number("MAKY_RELEASE_FILE_TIMEOUT_MS", DEFAULT_FILE_TIMEOUT_MS, 5000, 300_000),
		},
	};
}

/** Whether this process selects catalogue content by market from a manifest. */
export function releaseEnabled(): boolean {
	return releaseSetting().kind === "on";
}

/** Host and path of the pointer, for a log line: no query string, no credentials. */
export function describePointer(config: ReleaseConfig): string {
	const url = new URL(config.manifestUrl);
	return `${url.host}${url.pathname}`;
}
