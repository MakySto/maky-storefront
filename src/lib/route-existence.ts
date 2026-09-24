import { CHANNEL_MAP, FRIENDLY_SLUGS, REVERSE_MAP } from "./channel-map";
import { MARKET_LANGUAGE_CODE } from "@/config/market-language";
import { isCategorySlug } from "@/config/categories";
import { categoryBaseSlug, isLocalizedRootSegment } from "@/config/category-routes";
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

export function describeGate(): {
	enabled: boolean;
	markets: readonly string[];
	families: readonly string[];
} {
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

// --- process-wide cache ----------------------------------------------------------
//
// A performance cache, never a correctness dependency: a miss costs one small request.
// A STALE answer is not free, though, and nothing could expire this one early. An
// "absent" kept for 60 s meant a product just published in a market answered 404 at its
// new URL for up to a minute after the event that announced it; an "exists" kept for 300 s
// meant one just unpublished kept serving its soft-404 body with a 200. Both measured on a
// production build, 2026-09-23, after a real POST to /api/revalidate.
//
// So the state lives on `globalThis` under a registry symbol rather than in this module.
// The proxy is one bundle and the route handlers another, so each loads its OWN copy of this
// module; under `next start` both run in one process and one realm, so they share
// `globalThis`. That is what lets `/api/revalidate` drop what this cache believes about a
// product (`forgetProductExistence`). Verified on a production build rather than assumed —
// the revalidate response reports how many entries it could see.

type Entry = { verdict: "exists" | "absent"; expiresAt: number; baseSlug: string | null };
type IdentityEntry = { answer: TranslatedProductAnswer; expiresAt: number };

interface ExistenceState {
	readonly cache: Map<string, Entry>;
	readonly inFlight: Map<string, Promise<ExistenceVerdict>>;
	readonly identityCache: Map<string, IdentityEntry>;
	readonly identityInFlight: Map<string, Promise<TranslatedProductAnswer>>;
	concurrent: number;
	consecutiveFaults: number;
	breakerOpenUntil: number;
	/** Bumped by every product event: an answer asked for before it is not stored after it. */
	epoch: number;
}

const STATE_KEY = Symbol.for("maky.route-existence.state.v1");

function state(): ExistenceState {
	const registry = globalThis as typeof globalThis & { [STATE_KEY]?: ExistenceState };
	registry[STATE_KEY] ??= {
		cache: new Map(),
		inFlight: new Map(),
		identityCache: new Map(),
		identityInFlight: new Map(),
		concurrent: 0,
		consecutiveFaults: 0,
		breakerOpenUntil: 0,
		epoch: 0,
	};
	return registry[STATE_KEY];
}

function cacheKey(channel: string, family: RouteFamily, slug: string): string {
	return `${channel}:${family}:${slug}`;
}

function readCache(key: string, now: number): ExistenceVerdict {
	const { cache } = state();
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

function writeCache(key: string, verdict: "exists" | "absent", now: number, baseSlug: string | null): void {
	const { cache } = state();
	cache.set(key, {
		verdict,
		expiresAt: now + (verdict === "exists" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
		baseSlug,
	});
	while (cache.size > MAX_ENTRIES) {
		const oldest = cache.keys().next();
		if (oldest.done) break;
		cache.delete(oldest.value);
	}
}

/** Test seam — the cache and breaker are process state by design. */
export function resetRouteExistenceStateForTests(): void {
	const s = state();
	s.cache.clear();
	s.inFlight.clear();
	s.identityCache.clear();
	s.identityInFlight.clear();
	s.concurrent = 0;
	s.consecutiveFaults = 0;
	s.breakerOpenUntil = 0;
	s.epoch = 0;
}

export function routeExistenceStats(): { size: number; inFlight: number; breakerOpen: boolean } {
	const s = state();
	return { size: s.cache.size, inFlight: s.inFlight.size, breakerOpen: s.breakerOpenUntil > Date.now() };
}

/**
 * A product event reached `/api/revalidate`: forget what this cache believes about it.
 *
 * - every "absent" product answer in the event's channels — a URL that did not exist a moment
 *   ago may be the translated slug the event just published, and an absence has no base slug
 *   to be named by (the same reasoning as the page cache's `product-miss` tag);
 * - every "exists" answer that resolved to one of the event's slugs, under any URL — the base
 *   slug in Slovakia, the translated slug abroad, an old mapped slug;
 * - the same two for the translated-slug identities the redirects rely on.
 *
 * Any answer still in flight was asked before the event, so it is not stored when it lands.
 * Returns what it did, so the caller can report it — and so a caller in a different realm
 * would visibly see an empty cache rather than silently doing nothing.
 */
export function forgetProductExistence(event: { channels: readonly string[]; slugs: readonly string[] }): {
	dropped: number;
	remaining: number;
} {
	const s = state();
	s.epoch += 1;
	const channels = new Set(event.channels);
	const slugs = new Set(event.slugs.filter(Boolean));
	let dropped = 0;

	for (const [key, entry] of s.cache) {
		const [channel, family, ...rest] = key.split(":");
		if (family !== "product" || !channels.has(channel!)) continue;
		if (
			entry.verdict === "absent" ||
			slugs.has(rest.join(":")) ||
			(entry.baseSlug && slugs.has(entry.baseSlug))
		) {
			s.cache.delete(key);
			dropped++;
		}
	}
	for (const [key, entry] of s.identityCache) {
		const channel = key.slice(0, key.indexOf(":"));
		if (!channels.has(channel)) continue;
		if (entry.answer.verdict === "absent" || (entry.answer.baseSlug && slugs.has(entry.answer.baseSlug))) {
			s.identityCache.delete(key);
			dropped++;
		}
	}
	for (const key of s.inFlight.keys())
		if (channels.has(key.slice(0, key.indexOf(":")))) s.inFlight.delete(key);
	for (const key of s.identityInFlight.keys())
		if (channels.has(key.slice(0, key.indexOf(":")))) s.identityInFlight.delete(key);

	return { dropped, remaining: s.cache.size + s.identityCache.size };
}

// --- the query -----------------------------------------------------------------

const QUERIES: Record<RouteFamily, { query: string; field: string; channelScoped: boolean }> = {
	product: {
		// `slug` is the base slug, so a product event can find this answer again.
		query: "query E($s:String!,$c:String!){product(slug:$s,channel:$c){id slug}}",
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

/** A verdict, plus the base slug of the product it found, so a product event can name it. */
type Probe = { verdict: ExistenceVerdict; baseSlug: string | null };

const UNKNOWN_PROBE: Probe = { verdict: "unknown", baseSlug: null };

const slugOf = (resource: unknown): string | null =>
	typeof resource === "object" &&
	resource !== null &&
	typeof (resource as { slug?: unknown }).slug === "string"
		? (resource as { slug: string }).slug
		: null;

async function askUpstream(family: RouteFamily, slug: string, channel: string): Promise<Probe> {
	const endpoint = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!endpoint) return UNKNOWN_PROBE;

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

		if (!response.ok) return UNKNOWN_PROBE;

		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) return UNKNOWN_PROBE;

		const payload = body as { data?: Record<string, unknown> | null; errors?: unknown };
		// A partial response — data AND errors — is not a trustworthy negative.
		if (payload.errors) return UNKNOWN_PROBE;
		if (payload.data == null || !(spec.field in payload.data)) return UNKNOWN_PROBE;

		const resource = payload.data[spec.field];
		return resource == null
			? { verdict: "absent", baseSlug: null }
			: { verdict: "exists", baseSlug: slugOf(resource) };
	} catch {
		// Timeout, DNS, connection reset, malformed JSON. All the same answer.
		return UNKNOWN_PROBE;
	}
}

/**
 * The language a market writes its product slugs in — null for Slovakia, which uses the base row.
 *
 * `MARKET_LANGUAGE_CODE` rather than `LOCALE_MAP`: this module is reachable from the proxy
 * bundle, and `config/locale.ts` pulls in generated GraphQL documents. The contract test keeps
 * the two tables identical.
 */
function translatedLanguageForChannel(channel: string): string | null {
	const market = REVERSE_MAP[channel];
	return market ? MARKET_LANGUAGE_CODE[market] ?? null : null;
}

/**
 * The authoritative question, with the same slug semantics the page uses.
 *
 * Three asks, in the order the PAGE resolves them, and the order is the point — a gate that
 * answers differently from the renderer hard-404s a URL that renders perfectly well.
 *
 * 1. the base row (`product(slug:)`), which is what Slovakia serves;
 * 2. abroad, the TRANSLATED row. A foreign market's product URL is its translated slug, and
 *    `product(slug:)` alone never matches one — it only reads the base row. So "absent" from
 *    step 1 says nothing at all abroad, and arming this gate without step 2 would have
 *    hard-404'd every foreign product page on the site, including the 33 canary URLs;
 * 3. `previousProductSlug`, because ten products are reachable at their new canonical URL
 *    while Saleor still holds the old slug and the page's own resolver falls back to it.
 *
 * Steps 2 and 3 run only when the cheaper answer was `absent`, and the whole verdict is cached,
 * so the extra round trip costs a foreign miss once per 300 s rather than once per request. It
 * borrows this call's concurrency slot instead of taking a second one: nesting the cached
 * `lookupTranslatedProduct` here would have each gate check hold two, and shed load at half
 * the traffic.
 */
async function resolveVerdict(family: RouteFamily, slug: string, channel: string): Promise<Probe> {
	const first = await askUpstream(family, slug, channel);
	if (first.verdict !== "absent" || family !== "product") return first;

	const language = translatedLanguageForChannel(channel);
	if (language) {
		const translated = await askTranslatedUpstream(slug, channel, language);
		if (translated.verdict !== "absent")
			return { verdict: translated.verdict, baseSlug: translated.baseSlug ?? null };
	}

	const previous = previousProductSlug(slug);
	return previous ? askUpstream(family, previous, channel) : { verdict: "absent", baseSlug: null };
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

	const s = state();
	// A run of faults means Saleor is unwell. Stop asking and let everything
	// through until it has had a chance to recover.
	if (s.breakerOpenUntil > now) return "unknown";

	const existing = s.inFlight.get(key);
	if (existing) return existing;

	// Bounded concurrency. Under a dictionary scan this sheds load by failing
	// open rather than queueing, which keeps the added latency bounded.
	if (s.concurrent >= MAX_CONCURRENT) return "unknown";

	s.concurrent += 1;
	const epoch = s.epoch;
	const pending: Promise<ExistenceVerdict> = resolveVerdict(family, slug, channel)
		.then(({ verdict, baseSlug }) => {
			if (verdict === "unknown") {
				s.consecutiveFaults += 1;
				if (s.consecutiveFaults >= BREAKER_THRESHOLD) {
					s.breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
					s.consecutiveFaults = 0;
					console.error(
						`[route-existence] breaker open for ${BREAKER_COOLDOWN_MS}ms after ${BREAKER_THRESHOLD} faults`,
					);
				}
				return verdict;
			}
			s.consecutiveFaults = 0;
			// Asked before a product event landed: answer this request, remember nothing.
			if (s.epoch === epoch) writeCache(key, verdict, Date.now(), baseSlug);
			return verdict;
		})
		.finally(() => {
			s.concurrent -= 1;
			if (s.inFlight.get(key) === pending) s.inFlight.delete(key);
		});

	s.inFlight.set(key, pending);
	return pending;
}

// --- the translated-slug question (PUBLIC_MARKET_URL_V2) -----------------------
//
// A market's product URL is its TRANSLATED slug, and `product(slug:)` alone matches only the
// base row — so the question the redirect asks ("does the slug CFM allocated already serve
// this product here?") needs `slugLanguageCode`, and it needs the identity back, not a
// boolean: the answer may only move a visitor when the target is the SAME product the
// redirect map names. Same transport, same breaker and the same fail-open rule as above; a
// separate cache because the value is an identity rather than a verdict.

export interface TranslatedProductAnswer {
	readonly verdict: ExistenceVerdict;
	/** Saleor's `externalReference` (`cfm:product:CFMP-…`), when the slug resolved. */
	readonly externalReference: string | null;
	/** The owner's BASE slug, when the slug resolved: what a product event names it by. */
	readonly baseSlug?: string | null;
}

const UNKNOWN_PRODUCT: TranslatedProductAnswer = { verdict: "unknown", externalReference: null };

const TRANSLATED_PRODUCT_QUERY =
	"query T($s:String!,$c:String!,$l:LanguageCodeEnum!){product(slug:$s,channel:$c,slugLanguageCode:$l){id slug externalReference}}";

async function askTranslatedUpstream(
	slug: string,
	channel: string,
	languageCode: string,
): Promise<TranslatedProductAnswer> {
	const endpoint = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!endpoint) return UNKNOWN_PRODUCT;

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				query: TRANSLATED_PRODUCT_QUERY,
				variables: { s: slug, c: channel, l: languageCode },
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
			cache: "no-store",
		});
		if (!response.ok) return UNKNOWN_PRODUCT;

		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) return UNKNOWN_PRODUCT;
		const payload = body as { data?: Record<string, unknown> | null; errors?: unknown };
		if (payload.errors) return UNKNOWN_PRODUCT;
		if (payload.data == null || !("product" in payload.data)) return UNKNOWN_PRODUCT;

		const product = payload.data.product as { externalReference?: string | null } | null;
		if (product == null) return { verdict: "absent", externalReference: null };
		return {
			verdict: "exists",
			externalReference: product.externalReference ?? null,
			baseSlug: slugOf(product),
		};
	} catch {
		return UNKNOWN_PRODUCT;
	}
}

/**
 * Who, if anyone, owns `slug` in this market's own language.
 *
 * `exists` + the owner's identity, `absent`, or `unknown`. Only `exists` with a matching
 * identity may produce a redirect; `absent` means the swap has not happened yet and the old
 * URL must keep serving; `unknown` means we could not find out and nothing changes.
 */
export async function lookupTranslatedProduct(
	slug: string,
	channel: string,
	languageCode: string,
	now: number = Date.now(),
): Promise<TranslatedProductAnswer> {
	const key = `${channel}:${languageCode}:${slug}`;
	const s = state();

	const hit = s.identityCache.get(key);
	if (hit && hit.expiresAt > now) {
		s.identityCache.delete(key);
		s.identityCache.set(key, hit);
		return hit.answer;
	}
	if (hit) s.identityCache.delete(key);

	if (s.breakerOpenUntil > now) return UNKNOWN_PRODUCT;

	const existing = s.identityInFlight.get(key);
	if (existing) return existing;
	if (s.concurrent >= MAX_CONCURRENT) return UNKNOWN_PRODUCT;

	s.concurrent += 1;
	const epoch = s.epoch;
	const pending: Promise<TranslatedProductAnswer> = askTranslatedUpstream(slug, channel, languageCode)
		.then((answer) => {
			if (answer.verdict === "unknown") {
				s.consecutiveFaults += 1;
				if (s.consecutiveFaults >= BREAKER_THRESHOLD) {
					s.breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
					s.consecutiveFaults = 0;
					console.error(
						`[route-existence] breaker open for ${BREAKER_COOLDOWN_MS}ms after ${BREAKER_THRESHOLD} faults`,
					);
				}
				return answer;
			}
			s.consecutiveFaults = 0;
			// Asked before a product event landed: answer this request, remember nothing.
			if (s.epoch !== epoch) return answer;
			s.identityCache.set(key, {
				answer,
				expiresAt: Date.now() + (answer.verdict === "exists" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
			});
			while (s.identityCache.size > MAX_ENTRIES) {
				const oldest = s.identityCache.keys().next();
				if (oldest.done) break;
				s.identityCache.delete(oldest.value);
			}
			return answer;
		})
		.finally(() => {
			s.concurrent -= 1;
			if (s.identityInFlight.get(key) === pending) s.identityInFlight.delete(key);
		});

	s.identityInFlight.set(key, pending);
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
 * `decodeURIComponent` that cannot take the site down.
 *
 * A malformed percent-escape — `/sk/%E0%A4%A`, `/sk/%zz`, a bare `/sk/%` — makes
 * the built-in throw URIError. This runs inside the proxy, which runs before every
 * page, so an uncaught throw here is a site-wide 500 handed to anyone who can type
 * a URL. Returning undefined instead makes `classifyRoute` return null, and a path
 * the gate cannot classify simply renders as it does today.
 *
 * The proxy also wraps itself in try/catch, so this is the inner of two layers.
 * Both are wanted: this one keeps a known-bad input on the normal code path, the
 * outer one catches the throw sites nobody has thought of yet.
 */
function safeDecode(segment: string): string | undefined {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
}

/**
 * Which resource, if any, a market-relative path is asking for.
 *
 * Returns null for anything the gate must not touch: a declared static route, a
 * path with the wrong shape, an unknown market, an undecodable slug. Silence is
 * the safe answer — a path this cannot classify simply renders as it does today.
 */
export function classifyRoute(market: string, segments: readonly string[]): GateDecision | null {
	const config = CHANNEL_MAP[market];
	if (!config) return null;

	const rest = segments.slice(1);
	if (rest.length === 0) return null;

	// /{market}/{slug} — but only when the segment is not a real route. This is
	// the check that stops the gate asking Saleor about "poradna".
	//
	// The root is shared between products and categories since category URLs lost
	// their `/categories/` segment, so this has to tell them apart BEFORE deciding
	// which family to ask Saleor about. Get it wrong and the gate looks up
	// `product(slug: "stresne-nosice")`, is told "absent" — truthfully, there is no
	// such product — and 404s every category on the site the day the gate is armed.
	// The gate is off today, which is exactly why this would have been found late.
	if (rest.length === 1) {
		if (isMarketRootSegment(rest[0])) return null;
		const slug = safeDecode(rest[0]);
		if (slug === undefined) return null;
		// A localized root (`/cz/stresni-nosice`) is the same category under its Czech spelling.
		// Saleor is asked by base slug: `category(slug: "stresni-nosice")` answers null, and an
		// armed gate would 404 the canonical category URL of every foreign market.
		if (isLocalizedRootSegment(market, slug)) {
			return { family: "category", slug: categoryBaseSlug(market, slug), channel: config.saleorSlug };
		}
		const family: RouteFamily = isCategorySlug(slug) ? "category" : "product";
		return { family, slug, channel: config.saleorSlug };
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
	if (!family) return null;

	const slug = safeDecode(rest[1]);
	if (slug === undefined) return null;
	// Same for a listing category's localized spelling (`/cz/categories/nordrive-stresni-nosice`).
	return {
		family,
		slug: family === "category" ? categoryBaseSlug(market, slug) : slug,
		channel: config.saleorSlug,
	};
}
