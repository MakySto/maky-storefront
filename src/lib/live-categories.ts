import { CATEGORY_SLUGS, LIVE_CATEGORY_SLUGS_KEY } from "@/config/categories";
import { isLocalizedRootSegment } from "@/config/category-routes";
import { CHANNEL_MAP, FRIENDLY_SLUGS, SALEOR_SLUGS, cartSegment } from "./channel-map";
import { MARKET_ROOT_SEGMENTS } from "./routing.generated";

/**
 * Which slugs at `/{market}/{slug}` are categories — learned from Saleor, not typed in.
 *
 * ## The decision (owner, 2026-10-06)
 *
 * Every category Saleor holds has a root URL, and a category created tomorrow gets one with no
 * edit and no deploy. Until now the proxy told a category from a product with a list in
 * `src/config/categories.ts`, and a category that list did not name kept its `/categories/…`
 * URL until somebody added it and shipped a build. That list is now the FLOOR of the set, and
 * this module adds the rest from Saleor.
 *
 * ## Why a set that is loaded, and not a question asked per URL
 *
 * The root is shared with ~9,600 product slugs per market, and the proxy runs before every page.
 * Asking Saleor "is this slug a category?" for every root URL it cannot place would put a request
 * on the path of the site's most visited route, once a minute per product. One query for all
 * categories, in memory and refreshed in the background, answers the same question at the cost of
 * a set lookup. A build-time list generated from Saleor was the other option; it still needs a
 * deploy per category, and a deploy is three and a half minutes of downtime.
 *
 * ## What it can never do
 *
 * - **Never wait on the request path.** The proxy only calls `keepLiveCategoriesFresh`, which
 *   starts a refresh when the set is a minute old and returns at once. A fresh process loads the
 *   set at boot (`instrumentation.ts` holds the start for it, for a moment at most); a request
 *   that gets ahead of a slow Saleor is answered from the floor, which is today's behaviour.
 * - **Never know fewer than the floor.** The floor is checked first and never removed, so a failed
 *   or partial load costs a new category its URL for a minute and costs no existing one anything.
 * - **Never take a URL that already means something else.** A slug is admitted only if it is a
 *   plain lower-case slug, is not the name of a real route (`/products`, `/cart`, `/poradna`, …) or
 *   of a market, is not a localized spelling of a mapped category, and no product in ANY channel
 *   held it. The last one is the check `pnpm check:nav` made by hand when somebody added a slug to
 *   the list; it is made here, once, when a category is first seen (a product given the slug of
 *   an admitted category later is `check:nav`'s to find, exactly as for the floor). A category
 *   that fails stays at `/{market}/categories/{slug}`, which works, and is asked about again at
 *   every load — so the day the product is renamed it moves to the root by itself.
 * - **Never be fooled by a bad answer.** HTTP 200, no `errors`, and a connection of the right
 *   shape, or the load counts as failed: a partial list is not allowed to remove anything, and a
 *   failed load backs off (15 s, doubling to 5 min) instead of hammering a Saleor that is unwell.
 *
 * The state lives on `globalThis`, like `route-existence.ts`' and for the same reason: the proxy
 * and the route handlers are separate bundles in one process. This module therefore imports
 * nothing that pulls in the generated GraphQL documents — it speaks to Saleor with one bare
 * `fetch` and two small queries, as the existence gate does.
 */

// --- tuning ---------------------------------------------------------------------

/** A loaded set is trusted this long; the first request after it starts a refresh in the background. */
const TTL_MS = 60_000;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 300_000;
/** A forced refresh (a category event) is skipped when one started this recently. */
const FORCE_MIN_INTERVAL_MS = 2_000;
/** Off the request path, so generous — but a Saleor that does not answer must not pin a slot. */
const FETCH_TIMEOUT_MS = 4_000;
/** How long boot holds the first request for the first load. */
const BOOT_WAIT_MS = 2_500;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
/** New slugs examined per load; the rest wait for the next one. Saleor holds 30 today. */
const MAX_PROBES_PER_LOAD = 10;

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHANNEL_SHAPE = /^[a-z]{2}-[a-z]{3}$/;

// --- state ------------------------------------------------------------------------

interface LiveState {
	/** When the last conclusive load finished. 0 = none yet. */
	loadedAt: number;
	/** When the last load started — only what a forced refresh measures itself against. */
	startedAt: number;
	/** No new load before this moment: the back-off after a failed one. */
	notBefore: number;
	failures: number;
	inFlight: Promise<void> | null;
	/**
	 * A forced refresh arrived while a load was running. That load may have read the list before the
	 * change the event announced, so it is followed by one more, and the caller waits for both.
	 */
	again: boolean;
	/** The slugs admitted beyond the floor. `globalThis[LIVE_CATEGORY_SLUGS_KEY]` is a copy of it. */
	admitted: ReadonlySet<string>;
	/** Slug → why it was not admitted, so a refusal is logged when it appears and not every minute. */
	refused: ReadonlyMap<string, string>;
}

const STATE_KEY = Symbol.for("maky.live-categories.state.v1");

function state(): LiveState {
	const shared = globalThis as typeof globalThis & { [STATE_KEY]?: LiveState };
	shared[STATE_KEY] ??= {
		loadedAt: 0,
		startedAt: 0,
		notBefore: 0,
		failures: 0,
		inFlight: null,
		again: false,
		admitted: new Set(),
		refused: new Map(),
	};
	return shared[STATE_KEY];
}

function publish(admitted: ReadonlySet<string>): void {
	(globalThis as typeof globalThis & { [LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string> })[
		LIVE_CATEGORY_SLUGS_KEY
	] = new Set(admitted);
}

/** Test seam — the live list is process state by design. */
export function resetLiveCategoriesForTests(): void {
	const shared = globalThis as typeof globalThis & {
		[STATE_KEY]?: LiveState;
		[LIVE_CATEGORY_SLUGS_KEY]?: ReadonlySet<string>;
	};
	delete shared[STATE_KEY];
	delete shared[LIVE_CATEGORY_SLUGS_KEY];
}

export function liveCategoriesStats(): {
	loaded: boolean;
	loadedAt: number;
	failures: number;
	inFlight: boolean;
	admitted: readonly string[];
	refused: Readonly<Record<string, string>>;
} {
	const s = state();
	return {
		loaded: s.loadedAt !== 0,
		loadedAt: s.loadedAt,
		failures: s.failures,
		inFlight: s.inFlight !== null,
		admitted: [...s.admitted].sort(),
		refused: Object.fromEntries(s.refused),
	};
}

// --- talking to Saleor -----------------------------------------------------------

const LIST_QUERY =
	"query C($after:String){categories(first:" +
	PAGE_SIZE +
	",after:$after){pageInfo{hasNextPage endCursor} edges{node{slug}}}}";

function endpoint(): string | undefined {
	return process.env.NEXT_PUBLIC_SALEOR_API_URL || undefined;
}

/**
 * One GraphQL call. `data`, or null for anything that is not a trustworthy answer: a timeout, a
 * non-200, malformed JSON, `errors` (a partial response is not a trustworthy list OR a trustworthy
 * "no such product").
 */
async function ask(
	url: string,
	query: string,
	variables: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query, variables }),
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			cache: "no-store",
		});
		if (!response.ok) return null;
		const body: unknown = await response.json();
		if (typeof body !== "object" || body === null) return null;
		const payload = body as { data?: unknown; errors?: unknown };
		if (payload.errors) return null;
		return typeof payload.data === "object" && payload.data !== null
			? (payload.data as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function parseConnection(value: unknown): { slugs: string[]; next: string | null } | null {
	if (typeof value !== "object" || value === null) return null;
	const { edges, pageInfo } = value as {
		edges?: unknown;
		pageInfo?: { hasNextPage?: unknown; endCursor?: unknown } | null;
	};
	if (!Array.isArray(edges) || typeof pageInfo !== "object" || pageInfo === null) return null;

	const slugs: string[] = [];
	for (const edge of edges) {
		const slug = (edge as { node?: { slug?: unknown } } | null)?.node?.slug;
		// One malformed row makes the whole page untrustworthy.
		if (typeof slug !== "string") return null;
		slugs.push(slug);
	}
	const more = pageInfo.hasNextPage === true;
	if (more && typeof pageInfo.endCursor !== "string") return null;
	return { slugs, next: more ? (pageInfo.endCursor as string) : null };
}

interface Listing {
	readonly slugs: readonly string[];
	/** False when a later page failed or the walk hit its page cap: usable, but it may not remove anything. */
	readonly complete: boolean;
}

/** Every category Saleor holds, by base slug. Null when not even the first page could be read. */
async function listCategories(url: string): Promise<Listing | null> {
	const slugs: string[] = [];
	let after: string | null = null;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const data = await ask(url, LIST_QUERY, { after });
		const connection = parseConnection(data?.categories);
		if (!connection) return page === 0 ? null : { slugs, complete: false };
		slugs.push(...connection.slugs);
		if (!connection.next) return { slugs, complete: true };
		after = connection.next;
	}
	return { slugs, complete: false };
}

type Collision = { verdict: "clear" } | { verdict: "taken"; channel: string } | { verdict: "unknown" };

/**
 * Does a product in ANY channel hold this slug?
 *
 * One request, one aliased `product(slug:, channel:)` per channel — the question `pnpm check:nav`
 * asks, 12 at a time. `clear` needs every channel to answer null; a missing answer is `unknown`,
 * never `clear`, so a Saleor that is unwell cannot admit a category by not answering.
 */
async function productCollision(url: string, slug: string): Promise<Collision> {
	const channels = Object.values(CHANNEL_MAP)
		.map((config) => config.saleorSlug)
		.filter((channel) => CHANNEL_SHAPE.test(channel));
	if (channels.length === 0) return { verdict: "unknown" };

	const fields = channels.map((channel, index) => `c${index}:product(slug:$s,channel:"${channel}"){id}`);
	const data = await ask(url, `query P($s:String!){${fields.join(" ")}}`, { s: slug });
	if (!data) return { verdict: "unknown" };

	let unanswered = false;
	for (const [index, channel] of channels.entries()) {
		const key = `c${index}`;
		if (!(key in data)) unanswered = true;
		else if (data[key] !== null) return { verdict: "taken", channel };
	}
	return unanswered ? { verdict: "unknown" } : { verdict: "clear" };
}

// --- admission ---------------------------------------------------------------------

/**
 * Why a slug Saleor holds must NOT become a root URL, or null when nothing stands in the way.
 *
 * The first four are the same collisions `categories.test.ts` forbids in the floor; here the
 * slug comes from a database, so the test cannot see it and the check has to run at load time.
 */
function refusalReason(slug: string): string | null {
	if (!SLUG_SHAPE.test(slug)) return "not a plain lower-case slug";
	if (MARKET_ROOT_SEGMENTS.has(slug)) return "the name of a real route";
	if (FRIENDLY_SLUGS.has(slug) || SALEOR_SLUGS.has(slug)) return "the name of a market";
	for (const market of FRIENDLY_SLUGS) {
		if (cartSegment(market) === slug) return "a market's cart route";
		if (isLocalizedRootSegment(market, slug)) return `a localized category segment in ${market}`;
	}
	return null;
}

// --- the load ------------------------------------------------------------------------

function log(message: string): void {
	console.log(`[live-categories] ${message}`);
}

function fail(s: LiveState, now: number): void {
	s.failures += 1;
	const wait = Math.min(RETRY_BASE_MS * 2 ** (s.failures - 1), RETRY_MAX_MS);
	s.notBefore = now + wait;
	// Once per run of failures: a Saleor that is down for an hour must not write sixty lines.
	if (s.failures === 1) {
		log(
			`could not read the category list from Saleor; keeping ${CATEGORY_SLUGS.size + s.admitted.size} ` +
				`known categories, trying again in ${Math.round(wait / 1000)} s`,
		);
	}
}

async function load(url: string): Promise<void> {
	const s = state();
	const listing = await listCategories(url);
	const now = Date.now();
	if (!listing) {
		fail(s, now);
		return;
	}

	const listed = new Set(listing.slugs);
	// Admitted before and still held keeps its place without another question. A COMPLETE list that
	// no longer names one retires it (the category was deleted); an incomplete one never removes.
	const admitted = new Set([...s.admitted].filter((slug) => listed.has(slug) || !listing.complete));
	const refused = new Map<string, string>();

	let probes = 0;
	for (const slug of listing.slugs) {
		if (CATEGORY_SLUGS.has(slug) || admitted.has(slug)) continue;

		const reason = refusalReason(slug);
		if (reason) {
			refused.set(slug, reason);
			continue;
		}
		// Past the budget: neither admitted nor refused, asked again at the next load.
		if (probes >= MAX_PROBES_PER_LOAD) continue;
		probes += 1;

		const answer = await productCollision(url, slug);
		if (answer.verdict === "clear") admitted.add(slug);
		else if (answer.verdict === "taken") refused.set(slug, `a product holds this slug in ${answer.channel}`);
		// `unknown`: not admitted yet, and asked again at the next load.
	}

	const added = [...admitted].filter((slug) => !s.admitted.has(slug));
	const removed = [...s.admitted].filter((slug) => !admitted.has(slug));
	const newlyRefused = [...refused].filter(([slug, reason]) => s.refused.get(slug) !== reason);

	if (added.length > 0 || removed.length > 0 || s.loadedAt === 0) publish(admitted);
	if (s.failures > 0) log(`Saleor answered again after ${s.failures} failed load(s)`);
	if (added.length > 0)
		log(`now routing ${added.length} new categor${added.length === 1 ? "y" : "ies"}: ${added.join(", ")}`);
	if (removed.length > 0)
		log(`no longer routing ${removed.length}: ${removed.join(", ")} (gone from Saleor)`);
	for (const [slug, reason] of newlyRefused) {
		// JSON-quoted: a slug that fails the shape check is the one a log line must not trust.
		const quoted = JSON.stringify(slug);
		console.warn(
			`[live-categories] Saleor holds the category ${quoted} but it is NOT routed at the root: ${reason}`,
		);
	}

	s.admitted = admitted;
	s.refused = refused;
	s.failures = 0;
	s.notBefore = 0;
	s.loadedAt = now;
}

function start(force: boolean, now: number = Date.now()): Promise<void> | null {
	const url = endpoint();
	if (!url) return null;
	const s = state();
	if (s.inFlight) {
		if (force) s.again = true;
		return s.inFlight;
	}
	if (force ? now - s.startedAt < FORCE_MIN_INTERVAL_MS : now < s.notBefore) return null;

	s.startedAt = now;
	const pending: Promise<void> = (async () => {
		for (;;) {
			s.again = false;
			await load(url);
			if (!s.again) {
				// Cleared in the same turn as the check, so a forced refresh can never slip in between
				// "nothing more to do" and "no longer in flight" and be told to wait for nothing.
				s.inFlight = null;
				return;
			}
		}
	})()
		// `load` has no throw site of its own, but a rejection here would be an unhandled one in a
		// process that serves every customer: the floor is the answer to anything unexpected.
		.catch((error: unknown) => {
			fail(s, Date.now());
			console.error(
				`[live-categories] load threw: ${error instanceof Error ? error.message : String(error)}`,
			);
		})
		.finally(() => {
			if (s.inFlight === pending) s.inFlight = null;
		});
	s.inFlight = pending;
	return pending;
}

// --- public API ---------------------------------------------------------------------

/**
 * Start a refresh in the background when the set is a minute old, and return at once.
 *
 * The one call the proxy makes, on every market URL: a few comparisons when the set is fresh,
 * a single in-flight load when it is not, and nothing at all while a failed load is backing off or
 * when no Saleor endpoint is configured.
 */
export function keepLiveCategoriesFresh(now: number = Date.now()): void {
	const s = state();
	if (s.inFlight || now < s.notBefore) return;
	if (s.loadedAt !== 0 && now - s.loadedAt < TTL_MS) return;
	void start(false, now);
}

interface RefreshOptions {
	/**
	 * Ignore the back-off and the staleness: a category event says the list has changed. A load that
	 * is already running may have read the list before the change, so it is followed by another.
	 */
	readonly force?: boolean;
	/** Give up WAITING after this long. The load itself carries on in the background. */
	readonly waitMs?: number;
}

/**
 * Load the category list now, and wait for it — at most `waitMs` when given. Never rejects.
 *
 * For the callers that can wait: a category event on `/api/revalidate` (so the list is current
 * before the next render re-fills the caches that event just expired, which would otherwise bake
 * a `/categories/…` link into them), and the sitemap.
 */
export async function refreshLiveCategories({ force = false, waitMs }: RefreshOptions = {}): Promise<void> {
	const pending = start(force);
	if (!pending) return;
	if (waitMs === undefined) {
		await pending;
		return;
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		pending,
		new Promise<void>((resolve) => {
			timer = setTimeout(resolve, waitMs);
		}),
	]).finally(() => clearTimeout(timer));
}

/** Refresh only when the set is stale, and wait at most `waitMs` for it. */
export async function ensureFreshLiveCategories({ waitMs }: { readonly waitMs: number }): Promise<void> {
	const s = state();
	const now = Date.now();
	if (s.loadedAt !== 0 && now - s.loadedAt < TTL_MS) return;
	await refreshLiveCategories({ waitMs });
}

/**
 * The first load, at boot (`instrumentation.ts`), with the boot-time line that says what the
 * process is going to route: the floor, what Saleor added to it, and what it refused.
 *
 * Boot waits for it, but only a little (BOOT_WAIT_MS): a process that starts answering before it
 * knows the set routes a new category as a product for those first requests, and bakes
 * `/categories/…` links into any cache it fills meanwhile. A Saleor that is slow or down costs the
 * start those seconds and no more — the load carries on in the background and the floor answers.
 */
export async function prewarmLiveCategories({
	waitMs = BOOT_WAIT_MS,
}: { readonly waitMs?: number } = {}): Promise<void> {
	if (!endpoint()) {
		log(`no Saleor endpoint configured: the ${CATEGORY_SLUGS.size} categories of the build are all there is`);
		return;
	}
	await refreshLiveCategories({ force: true, waitMs });
	const s = state();
	log(
		`floor=${CATEGORY_SLUGS.size} live=${s.admitted.size} refused=${s.refused.size} ` +
			`loaded=${s.loadedAt !== 0 ? "yes" : "no"}`,
	);
}
