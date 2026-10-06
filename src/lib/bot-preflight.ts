import { PRODUCT_DEADLINE_MS } from "@/config/product-deadline";
import { INTERNAL_TOKEN_HEADER, internalLoopbackToken } from "./internal-token";

/**
 * A crawler asking for a product page: find out, BEFORE the status is committed, whether the
 * page will be able to read its product — by asking the page's own resolver.
 *
 * ## The defect
 *
 * Googlebot and the other `htmlLimitedBots` get a blocking render. When Saleor answers the
 * existence gate's small query but fails the page's full product read (a partial outage, or a
 * read past `PRODUCT_DEADLINE_MS`), the page takes its temporarily-unavailable path: HTTP 200,
 * `noindex`, no canonical, no title. Under cacheComponents the status comes from the prerendered
 * shell, so the page cannot turn that into a 5xx itself — and throwing from `generateMetadata`
 * was tried and made it worse (200 with no metadata at all). The proxy is the last place that
 * can still choose the status.
 *
 * ## Why a loopback, and not the proxy reading Saleor itself
 *
 * A proxy that runs its own full read decides the status from ONE read and lets the page render
 * from ANOTHER. When the first succeeds and the second fails, the crawler still gets the
 * `noindex` page — the problem just moves — and every crawler hit costs an extra Saleor read.
 * Measured on a production build (Next 16.3.6, 2026-09-27): proxy read OK, page read failing
 * -> HTTP 200 + `noindex`.
 *
 * Sharing Next's fetch cache does not close that gap. The proxy does run with a work store now,
 * but its `IncrementalCache` is one the proxy adapter builds per invocation, in minimal mode,
 * with NO cache handler behind it. Measured on the same build with the page's exact
 * ProductDetails request: proxy fetch then page render = 2 upstream reads; the same fetch twice
 * in the proxy = 2 upstream reads; after the page had cached the product, the proxy's fetch still
 * went upstream. And abroad the product fetch is not fetch-cached at all (`revalidate: 0`).
 *
 * So the proxy does not read Saleor. It asks `/api/internal/product-outcome`, which calls
 * `getProductOutcome` — the very function the page and its metadata call, with the same
 * arguments. That call reads or fills the page's own `"use cache"` entry: when it succeeds, the
 * entry the page renders from moments later is the one it just stored (or found), and the page
 * makes no Saleor read of its own. When it fails, the fault is remembered for seconds only
 * (`cachedOutcome`) and the crawler is told 503 + Retry-After instead of being handed the page.
 *
 * ## Fail open, except on proof
 *
 * Only an explicit `upstream-error` from the page's resolver becomes a 503. A loopback that could
 * not be made — no port, connection refused, a 404 because the token did not match, a timeout,
 * a malformed body — is `skipped` and the request proceeds exactly as it did before this existed.
 * A defect in this mechanism must never be able to take crawlers off the whole catalogue.
 */

export type PreflightVerdict = "found" | "not-found" | "upstream-error";

export type PreflightAnswer =
	| { readonly verdict: PreflightVerdict; readonly ms: number }
	| { readonly verdict: "skipped"; readonly reason: string; readonly ms: number };

export const PREFLIGHT_PATH = "/api/internal/product-outcome";

/**
 * Longer than the resolver's own deadline, so a slow Saleor is answered by the resolver
 * (`upstream-error`, a 503) rather than by this timeout (`skipped`, the page as before).
 */
export const PREFLIGHT_TIMEOUT_MS = PRODUCT_DEADLINE_MS + 1_500;

/** The kill switch: `MAKY_BOT_PREFLIGHT=off` turns it off without a deploy (restart only). */
export function isBotPreflightEnabled(): boolean {
	return process.env.MAKY_BOT_PREFLIGHT?.trim().toLowerCase() !== "off";
}

const VERDICTS: readonly PreflightVerdict[] = ["found", "not-found", "upstream-error"];

export interface PreflightOptions {
	/** The port `next start` listens on. `start-server` sets `PORT` to the port it actually bound. */
	readonly port?: string | undefined;
	readonly fetchImpl?: typeof fetch;
	readonly timeoutMs?: number;
	readonly token?: string;
	readonly now?: () => number;
}

export async function preflightProductOutcome(
	slug: string,
	channel: string,
	options: PreflightOptions = {},
): Promise<PreflightAnswer> {
	const now = options.now ?? (() => performance.now());
	const started = now();
	const skipped = (reason: string): PreflightAnswer => ({
		verdict: "skipped",
		reason,
		ms: Math.round(now() - started),
	});

	const port = "port" in options ? options.port : process.env.PORT;
	if (!port || !/^\d{1,5}$/.test(port)) return skipped("no-port");

	const url = new URL(`http://127.0.0.1:${port}${PREFLIGHT_PATH}`);
	url.searchParams.set("slug", slug);
	url.searchParams.set("channel", channel);

	const fetchImpl = options.fetchImpl ?? fetch;
	try {
		const response = await fetchImpl(url, {
			headers: { [INTERNAL_TOKEN_HEADER]: options.token ?? internalLoopbackToken() },
			signal: AbortSignal.timeout(options.timeoutMs ?? PREFLIGHT_TIMEOUT_MS),
			cache: "no-store",
			// The route never redirects. A redirect means something else answered, and following
			// it would carry the token header to wherever it points.
			redirect: "manual",
		});
		if (!response.ok) return skipped(`http-${response.status}`);

		const body: unknown = await response.json();
		const status =
			typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined;
		// The route could not tell: its read never reached Saleor (a full local queue).
		if (status === "undetermined") return skipped("undetermined");
		const verdict = VERDICTS.find((candidate) => candidate === status);
		if (!verdict) return skipped("malformed");
		return { verdict, ms: Math.round(now() - started) };
	} catch (error) {
		const name = error instanceof Error ? error.name : "";
		return skipped(name === "TimeoutError" || name === "AbortError" ? "timeout" : "transport");
	}
}

/** How often one skip reason may reach the log: a broken loopback would otherwise log every bot hit. */
const SKIP_LOG_INTERVAL_MS = 60_000;
const lastSkipLog = new Map<string, number>();

/**
 * A skipped preflight fails open — the crawler gets the page as before — so without a log line the
 * mechanism could stop working and nobody would know. One warning per reason per minute.
 */
export function logSkippedPreflight(
	answer: PreflightAnswer,
	options: { readonly now?: number; readonly log?: (message: string) => void } = {},
): void {
	if (answer.verdict !== "skipped") return;
	const now = options.now ?? Date.now();
	const last = lastSkipLog.get(answer.reason);
	if (last !== undefined && now - last < SKIP_LOG_INTERVAL_MS) return;
	lastSkipLog.set(answer.reason, now);
	(options.log ?? console.warn)(
		`[bot-preflight] skipped (${answer.reason}, ${answer.ms} ms): crawler served the page without the check`,
	);
}

/** For tests: forget when each reason was last logged. */
export function __resetSkipLog(): void {
	lastSkipLog.clear();
}

/** The header value that reports what the preflight concluded, on every response it looked at. */
export function describePreflight(answer: PreflightAnswer): string {
	return answer.verdict === "skipped"
		? `skipped:${answer.reason};${answer.ms}ms`
		: `${answer.verdict};${answer.ms}ms`;
}
