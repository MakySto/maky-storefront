import { CHANNEL_MAP, FRIENDLY_SLUGS } from "./channel-map";
import { previousProductSlug } from "./product-redirects";
import { isMarketRootSegment } from "./route-policy";

/**
 * Does this resource exist — asked early enough to set an HTTP status.
 *
 * Under `cacheComponents` the status line is committed before any page
 * component's lookup resolves, and the compiler enforces that: a route with
 * dynamic params and no Suspense above it does not build, and neither `dynamic`
 * nor `dynamicParams` is accepted. So `notFound()` in a page can only swap the
 * body. The Next documentation says the same thing and names the remedy —
 * "With Cache Components, every dynamic route streams a static shell first, so
 * run that check in `proxy` instead."
 *
 * ## What this deliberately is not
 *
 * It does NOT reuse `src/lib/graphql.ts`. That client wraps every call in a
 * queue with a 200 ms inter-request delay and three retries on a 15 s timeout —
 * up to ~67 s before it gives up, which is past nginx's 60 s `proxy_read_timeout`.
 * "Fail open" would then present as a site-wide 504. One bare fetch, one attempt,
 * sub-second timeout.
 *
 * It does NOT ask the full product query and share the render's cache. That
 * variant was measured and works, but it needs an internal HTTP endpoint, a
 * secret to protect it, a loopback hop on the routing path, and a dependency on
 * `"use cache"` sharing surviving future refactors. The status only needs
 * existence, and existence is one field.
 *
 * ## The safety property
 *
 * A hard 404 requires POSITIVE PROOF of absence from a healthy authority:
 * HTTP 200, valid JSON, no `errors`, and the resource field explicitly null.
 * Timeout, non-200, malformed body, GraphQL errors, an open breaker, a saturated
 * concurrency limit — every one of those returns `unknown` and the request
 * proceeds exactly as it does today. The failure mode of this gate is "no worse
 * than before", never "the catalogue is gone".
 */
export type RouteFamily = "product" | "collection" | "category" | "saleor-page";

export type ExistenceVerdict = "exists" | "absent" | "unknown";

export interface GateDecision {
	readonly family: RouteFamily;
	readonly slug: string;
	readonly channel: string;
}

// --- configuration ------------------------------------------------------------
//
// Everything defaults OFF. The gate ships inert and is turned on per market and
// per family, which is also how it is turned off again without a deploy.

const ALL_FAMILIES: readonly RouteFamily[] = ["product", "collection", "category", "saleor-page"];

function envList(name: string): readonly string[] {
	return (process.env[name] ?? "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

/** The global kill switch. Anything other than the exact string "on" is off. */
export function isGateEnabled(): boolean {
	return process.env.ROUTE_EXISTENCE_GATE === "on";
}

export function gateEnabledFor(market: string, family: RouteFamily): boolean {
	if (!isGateEnabled()) return false;

	const markets = envList("ROUTE_EXISTENCE_MARKETS");
	const families = envList("ROUTE_EXISTENCE_FAMILIES");

	// An empty list means "none", not "all". Rolling out is an explicit act.
	return markets.includes(market) && families.includes(family);
}

export function describeGate(): { enabled: boolean; markets: readonly string[]; families: readonly string[] } {
	return {
		enabled: isGateEnabled(),
		markets: envList("ROUTE_EXISTENCE_MARKETS").filter((m) => FRIENDLY_SLUGS.has(m)),
		families: envList("ROUTE_EXISTENCE_FAMILIES").filter((f) =>
			(ALL_FAMILIES as readonly string[]).includes(f),
		),
	};
}

// --- tuning -------------------------------------------------------------------

const POSITIVE_TTL_MS = 300_000;
const NEGATIVE_TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const TIMEOUT_MS = 400;
const MAX_CONCURRENT = 8;
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30_000;

// --- process-local cache -------------------------------------------------------
//
// A performance cache, never a correctness dependency. The proxy is its own
// bundle, so nothing else can invalidate it and it is empty after every restart;
// both are fine, because a miss costs one small request and a wrong-but-stale
// POSITIVE only means a page renders its own not-found body, as it does today.
// Stale NEGATIVES are the dangerous direction, which is why their TTL is short.

type Entry = { verdict: "exists" | "absent"; expiresAt: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<ExistenceVerdict>>();
let concurrent = 0;
let consecutiveFaults = 0;
let breakerOpenUntil = 0;

function cacheKey(channel: string, family: RouteFamily, slug: string): string {
	return `${channel}:${family}:${slug}`;
}

function readCache(key: string, now: number): ExistenceVerdict {
	const hit = cache.get(key);
	if (!hit) return "unknown";
	if (hit.expiresAt <= now) {
		cache.delete(key);
		return "unknown";
	}
	// Refresh insertion order so the LRU evicts the genuinely cold entries.
	cache.delete(key);
	cache.set(key, hit);
	return hit.verdict;
}

function writeCache(key: string, verdict: "exists" | "absent", now: number): void {
	cache.set(key, {
		verdict,
		expiresAt: now + (verdict === "exists" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
	});
	while (cache.size > MAX_ENTRIES) {
		const oldest = cache.keys().next();
		if (oldest.done) break;
		cache.delete(oldest.value);
	}
}

/** Test seam — the cache and breaker are module state by design. */
export function resetRouteExistenceStateForTests(): void {
	cache.clear();
	inFlight.clear();
	concurrent = 0;
	consecutiveFaults = 0;
	breakerOpenUntil = 0;
}

export function routeExistenceStats(): { size: number; inFlight: number; breakerOpen: boolean } {
	return { size: cache.size, inFlight: inFlight.size, breakerOpen: breakerOpenUntil > Date.now() };
}

// --- the query -----------------------------------------------------------------

const QUERIES: Record<RouteFamily, { query: string; field: string; channelScoped: boolean }> = {
	product: {
		query: "query E($s:String!,$c:String!){product(slug:$s,channel:$c){id}}",
		field: "product",
		channelScoped: true,
	},
	collection: {
		query: "query E($s:String!,$c:String!){collection(slug:$s,channel:$c){id}}",
		field: "collection",
		channelScoped: true,
	},
	// `category(slug:)` takes no channel — categories are global in Saleor, only
	// their products are per channel. So this answers "does the slug exist at
	// all", which is the right question for a STATUS. Whether it holds anything
	// in this market is an indexability decision and lives in the page's
	// metadata, not here.
	category: { query: "query E($s:String!){category(slug:$s){id}}", field: "category", channelScoped: false },
	"saleor-page": { query: "query E($s:String!){page(slug:$s){id}}", field: "page", channelScoped: false },
};

async function askUpstream(family: RouteFamily, slug: string, channel: string): Promise<ExistenceVerdict> {
	const endpoint = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!endpoint) return "unknown";

	const spec = QUERIES[family];

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				query: spec.query,
				variables: spec.channelScoped ? { s: slug, c: channel } : { s: slug },
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
			cache: "no-store",
		});

		if (!response.ok) return "unknown";

		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) return "unknown";

		const payload = body as { data?: Record<string, unknown> | null; errors?: unknown };
		// A partial response — data AND errors — is not a trustworthy negative.
		if (payload.errors) return "unknown";
		if (payload.data == null || !(spec.field in payload.data)) return "unknown";

		return payload.data[spec.field] == null ? "absent" : "exists";
	} catch {
		// Timeout, DNS, connection reset, malformed JSON. All the same answer.
		return "unknown";
	}
}

/**
 * The authoritative question, with the same slug semantics the page uses.
 *
 * `previousProductSlug` matters: ten products are reachable at their new
 * canonical URL while Saleor still holds the old slug, and the page's own
 * resolver falls back to it. A gate that asked only about the new slug would
 * hard-404 live products for the length of that convergence window.
 */
async function resolveVerdict(family: RouteFamily, slug: string, channel: string): Promise<ExistenceVerdict> {
	const first = await askUpstream(family, slug, channel);
	if (first !== "absent" || family !== "product") return first;

	const previous = previousProductSlug(slug);
	return previous ? askUpstream(family, previous, channel) : "absent";
}

/**
 * `exists`, `absent`, or `unknown` — and only `absent` may become a 404.
 */
export async function lookupExistence(
	family: RouteFamily,
	slug: string,
	channel: string,
	now: number = Date.now(),
): Promise<ExistenceVerdict> {
	const key = cacheKey(channel, family, slug);

	const cached = readCache(key, now);
	if (cached !== "unknown") return cached;

	// A run of faults means Saleor is unwell. Stop asking and let everything
	// through until it has had a chance to recover.
	if (breakerOpenUntil > now) return "unknown";

	const existing = inFlight.get(key);
	if (existing) return existing;

	// Bounded concurrency. Under a dictionary scan this sheds load by failing
	// open rather than queueing, which keeps the added latency bounded.
	if (concurrent >= MAX_CONCURRENT) return "unknown";

	concurrent += 1;
	const pending = resolveVerdict(family, slug, channel)
		.then((verdict) => {
			if (verdict === "unknown") {
				consecutiveFaults += 1;
				if (consecutiveFaults >= BREAKER_THRESHOLD) {
					breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
					consecutiveFaults = 0;
					console.error(
						`[route-existence] breaker open for ${BREAKER_COOLDOWN_MS}ms after ${BREAKER_THRESHOLD} faults`,
					);
				}
				return verdict;
			}
			consecutiveFaults = 0;
			writeCache(key, verdict, Date.now());
			return verdict;
		})
		.finally(() => {
			concurrent -= 1;
			inFlight.delete(key);
		});

	inFlight.set(key, pending);
	return pending;
}

// --- classification -------------------------------------------------------------

/**
 * Strip the suffixes Next appends for RSC, prefetch and segment requests.
 *
 * The built matcher carries `(\.json|\.rsc|\.segments\/.+\.segment\.rsc)?`, so
 * one user navigation can invoke the gate several times for the same logical
 * path. Keying on the raw path would multiply the Saleor traffic.
 */
export function normalizePathname(pathname: string): string {
	let path = pathname;
	path = path.replace(/\/_?segments\/.+\.segment\.rsc$/, "");
	path = path.replace(/\.(rsc|json)$/, "");
	if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	return path;
}

/**
 * Which resource, if any, a market-relative path is asking for.
 *
 * Returns null for anything the gate must not touch: a declared static route, a
 * path with the wrong shape, an unknown market. Silence is the safe answer —
 * a path this cannot classify simply renders as it does today.
 */
export function classifyRoute(market: string, segments: readonly string[]): GateDecision | null {
	const config = CHANNEL_MAP[market];
	if (!config) return null;

	const rest = segments.slice(1);
	if (rest.length === 0) return null;

	// /{market}/{slug} — but only when the segment is not a real route. This is
	// the check that stops the gate asking Saleor about "poradna".
	if (rest.length === 1) {
		return isMarketRootSegment(rest[0])
			? null
			: { family: "product", slug: decodeURIComponent(rest[0]), channel: config.saleorSlug };
	}

	if (rest.length !== 2) return null;

	const family: RouteFamily | null =
		rest[0] === "categories"
			? "category"
			: rest[0] === "collections"
				? "collection"
				: rest[0] === "pages"
					? "saleor-page"
					: null;

	return family ? { family, slug: decodeURIComponent(rest[1]), channel: config.saleorSlug } : null;
}
