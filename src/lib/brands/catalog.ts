import { cacheLife, cacheTag } from "next/cache";
import { answered, faulted, rememberBriefly, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
import { BrandValuesDocument, TypedDocumentString } from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { runDetached } from "@/lib/async/detached";
import { executePublicGraphQL } from "@/lib/graphql";
import { getCmsBrands, type CmsBrand } from "@/lib/cms/brands";
import { liveMarkets } from "@/lib/market-state";

/**
 * The shop's brands for one market: Saleor's makers that this channel sells, dressed with the
 * owner's entries from Payload where there is one (`lib/cms/brands.ts`).
 *
 * Saleor is the source of WHICH brands exist — the `manufacturer` attribute every product
 * carries, filled by CFM — so a brand page can never list products the catalogue does not tie
 * to it. Payload is the source of how a brand PRESENTS: logo, description, banner. A maker with
 * no products in this channel has no page here; "Neznačkové" (unbranded) is never a brand.
 *
 * `approved` marks the makers CLAUDE.md §6 clears for the homepage. Every stocked maker gets a
 * page — it is catalogue navigation, like the maker's name on its product cards — but only the
 * approved ones are promoted in the homepage strip.
 */

export interface Brand {
	readonly slug: string;
	readonly name: string;
	readonly productCount: number;
	readonly approved: boolean;
	readonly logo: CmsBrand["logo"];
	readonly heroImage: CmsBrand["heroImage"];
	readonly shortDescription: string | null;
}

/** CLAUDE.md §6: the makers the homepage may show, by their Saleor slug, in the strip's order. */
export const HOMEPAGE_BRAND_SLUGS: readonly string[] = [
	"thule",
	"yakima",
	"menabo",
	"nordrive",
	"peruzzo",
	"pro-user",
	"spinder",
	"green-valley",
	"snowdrive",
	"dac",
];

const VALUE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Not a maker: the catalogue's value for products without one. */
const NOT_A_BRAND: ReadonlySet<string> = new Set(["neznackove"]);

/** The list of makers is one cheap attribute read. */
const MAKERS_DEADLINE_MS = 2_500;
/**
 * The counts are the heavy half: one aliased `products(filter: …) { totalCount }` per maker, which
 * Saleor answers in seconds when it is busy. They used to go out through `executeRawGraphQL`, which
 * has no deadline of the caller's, no retry and no place in the request queue, so at a cold start —
 * every market asking at once while the sitemap warm-up and the deploy's own checks keep Saleor busy
 * — each of them ran until the transport's 15 s ceiling and then failed as "BrandCounts: Failed to
 * execute". One failing read of an optional list must not be allowed to cost a page or a cart action
 * 15 s, so the read has a deadline of its own and goes through the queue like every other read.
 */
const COUNTS_DEADLINE_MS = 6_000;

/**
 * How long an answer kept in the process stands in for asking again (the boot warm-up fills it). Past
 * it the kept answer is still SHOWN, and a fresh one is fetched behind it (see `readSaleorBrands`).
 */
const FRESH_MS = 10 * 60_000;

/**
 * How long a market that could not be counted is left alone. Counting is the heaviest read the shop
 * makes (Saleor runs a COUNT per maker, and a client deadline does not cancel it there): asking again
 * on every render of a slow Saleor is what turns a slow minute into a long one. Within the pause a
 * market with no kept answer is a fault at once, without a request.
 */
const FAULT_PAUSE_MS = 60_000;

/**
 * Makers per counting request. One request with a hundred aliases is a hundred COUNTs that Saleor
 * runs back to back on one connection, longer than any deadline we can give it; twelve at a time fit
 * the deadline when Saleor is healthy, and when it is not, the first chunk that fails ends the
 * market's attempt instead of the last.
 */
const COUNTS_CHUNK = 12;

/** Markets being counted at once, boot warm-up and visitors together. */
const MAX_COUNTING_MARKETS = 2;

/** The pause between two markets at boot, so Saleor is asked for one market's counts at a time with room between. */
const WARMUP_GAP_MS = 3_000;

type Maker = { slug: string; name: string; productCount: number };
type Kept = { readonly makers: readonly Maker[]; readonly at: number };
type Loaded =
	| { readonly ok: true; readonly makers: Maker[] }
	| { readonly ok: false; readonly message: string };

/**
 * The last answer Saleor gave for each channel, kept in the process. It serves two purposes:
 *
 *   - after a fault, the shop shows the makers it knew a minute ago instead of none at all, the way
 *     `market-assortment.ts` keeps its last answer; and
 *   - at boot, `prewarmBrandMakers` fills it one market at a time, so the first visitors after a
 *     restart find the lists ready instead of every market asking Saleor for its counts together.
 *
 * Not a second cache layer for the page: Next's `"use cache"` entry below still decides what a
 * prerender contains and when it is regenerated.
 */
const kept = new Map<string, Kept>();
const loading = new Map<string, Promise<Loaded>>();
/** Markets whose last count failed, and until when they are left alone. */
const paused = new Map<string, { readonly until: number; readonly message: string }>();

let counting = 0;
const waitingToCount: Array<() => void> = [];

/** For tests. */
export function __forgetBrandMakers(): void {
	kept.clear();
	loading.clear();
	paused.clear();
	counting = 0;
	waitingToCount.length = 0;
}

/** At most `MAX_COUNTING_MARKETS` markets are counted at once, however many ask. */
async function whileCounting<T>(job: () => Promise<T>): Promise<T> {
	if (counting >= MAX_COUNTING_MARKETS) await new Promise<void>((resolve) => waitingToCount.push(resolve));
	else counting += 1;
	try {
		return await job();
	} finally {
		const next = waitingToCount.shift();
		if (next) next();
		else counting -= 1;
	}
}

/**
 * Saleor's makers with products in this channel, once at a time per channel. Never throws. A market
 * whose last attempt failed is not asked again until `FAULT_PAUSE_MS` has passed.
 */
function loadMakers(channel: string): Promise<Loaded> {
	const running = loading.get(channel);
	if (running) return running;
	const pause = paused.get(channel);
	if (pause && pause.until > Date.now()) return Promise.resolve({ ok: false, message: pause.message });

	const job = whileCounting(() => askSaleorForMakers(channel))
		.catch(
			(error: unknown): Loaded => ({
				ok: false,
				message: `[Brands] ${error instanceof Error ? error.message : String(error)}`,
			}),
		)
		.then((loaded) => {
			if (loaded.ok) paused.delete(channel);
			else paused.set(channel, { until: Date.now() + FAULT_PAUSE_MS, message: loaded.message });
			return loaded;
		})
		.finally(() => loading.delete(channel));
	loading.set(channel, job);
	return job;
}

/** The counting document for one chunk of makers: `query BrandCounts { b0: products(…) { totalCount } … }`. */
function countsDocument(chunk: readonly { slug: string }[]) {
	const query = `query BrandCounts($channel: String!) {\n${chunk
		.map(
			(maker, index) =>
				`\tb${index}: products(channel: $channel, first: 1, filter: { attributes: [{ slug: "manufacturer", values: ["${maker.slug}"] }] }) { totalCount }`,
		)
		.join("\n")}\n}`;
	return new TypedDocumentString<Record<string, { totalCount: number | null } | null>, { channel: string }>(
		query,
	);
}

async function askSaleorForMakers(channel: string): Promise<Loaded> {
	const values = await executePublicGraphQL(BrandValuesDocument, {
		revalidate: 0,
		retry: false,
		signal: AbortSignal.timeout(MAKERS_DEADLINE_MS),
	});
	if (!values.ok) return { ok: false, message: `[Brands] makers unavailable: ${values.error.message}` };

	const makers = (values.data.attribute?.choices?.edges ?? [])
		.map(({ node }) => ({ slug: node.slug ?? "", name: node.name ?? "" }))
		.filter((maker) => maker.slug && maker.name && !NOT_A_BRAND.has(maker.slug));

	// The slugs come from Saleor and are checked against the slug shape before they are written into
	// the query. The counts go out a chunk at a time, one chunk after the other: the first one that
	// fails ends the attempt, so a Saleor that is struggling is asked once, not once per chunk.
	const safe = makers.filter((maker) => VALUE_SLUG.test(maker.slug));
	// A catalogue with no maker at all is an answer, not a query: `query BrandCounts { }` is a
	// syntax error that Saleor refuses.
	if (safe.length === 0) return { ok: true, makers: [] };

	const counted: Maker[] = [];
	for (let from = 0; from < safe.length; from += COUNTS_CHUNK) {
		const chunk = safe.slice(from, from + COUNTS_CHUNK);
		const counts = await executePublicGraphQL(countsDocument(chunk), {
			variables: { channel },
			revalidate: 0,
			retry: false,
			signal: AbortSignal.timeout(COUNTS_DEADLINE_MS),
		});
		if (!counts.ok) return { ok: false, message: `[Brands] counts unavailable: ${counts.error.message}` };
		chunk.forEach((maker, index) => {
			counted.push({ ...maker, productCount: counts.data[`b${index}`]?.totalCount ?? 0 });
		});
	}
	const stocked = counted.filter((maker) => maker.productCount > 0);
	kept.set(channel, { makers: stocked, at: Date.now() });
	return { ok: true, makers: stocked };
}

/**
 * Saleor's makers with products in this channel. A fault THROWS to the caller, so an outage is
 * never taken for "this shop has no brands"; inside the cache it is a value that is remembered for
 * seconds only, see `@/lib/cache-fault`. Where the process holds an earlier answer, that answer
 * stands in for the fault (and is remembered for seconds only, too).
 */
async function saleorBrands(channel: string): Promise<Maker[]> {
	return valueOrThrow(await readSaleorBrands(channel));
}

async function readSaleorBrands(channel: string): Promise<CachedRead<Maker[]>> {
	"use cache";
	cacheLife("hours");
	cacheTag("brands", `brands:${channel}`);

	const earlier = kept.get(channel);
	if (earlier && Date.now() - earlier.at < FRESH_MS) return answered([...earlier.makers]);

	if (earlier) {
		// Stale-while-revalidate: the visitor gets the answer the process holds NOW and does not wait for
		// Saleor to count again; the new one is fetched behind it (once per market, and not at all within
		// the pause after a failure). The entry is remembered for seconds only, so that the next render
		// after the refresh picks the fresh answer up instead of the old one for the entry's whole hour.
		runDetached(() => void loadMakers(channel));
		rememberBriefly();
		return answered([...earlier.makers]);
	}

	const loaded = await loadMakers(channel);
	if (loaded.ok) return answered(loaded.makers);
	return faulted(loaded.message);
}

/**
 * Builds every live market's list once, one market at a time with a pause between them, so that a
 * restart does not send all of them to Saleor together with the first visitors. The first market that
 * cannot be built ends the warm-up: Saleor is struggling, and the rest are built by the requests that
 * need them, each at most once a minute. Never rejects.
 */
export async function prewarmBrandMakers({
	gapMs = WARMUP_GAP_MS,
}: { readonly gapMs?: number } = {}): Promise<void> {
	const started = Date.now();
	const channels = [
		...new Set(
			liveMarkets()
				.map((market) => CHANNEL_MAP[market]?.saleorSlug)
				.filter((channel): channel is string => Boolean(channel)),
		),
	];
	let built = 0;
	for (const channel of channels) {
		let ok = false;
		try {
			ok = (await loadMakers(channel)).ok;
		} catch {
			// loadMakers does not throw; nothing here may stop the warm-up.
		}
		if (!ok) break;
		built += 1;
		if (gapMs > 0 && built < channels.length) await new Promise((resolve) => setTimeout(resolve, gapMs));
	}
	console.log(
		`[brands] warm-up: ${built} of ${channels.length} maker lists built in ${Math.round(
			(Date.now() - started) / 1000,
		)} s${built < channels.length ? " (stopped at the first market that could not be built)" : ""}`,
	);
}

/**
 * The makers this channel sells, from Saleor alone — for the questions that need no logo or
 * description: is there a brand page worth linking at all, and may a claim name a maker here.
 * Throws on a fault, like `getBrands`; the caller decides what an unknown answer means.
 */
export async function stockedBrandSlugs(channel: string): Promise<ReadonlySet<string>> {
	return new Set((await saleorBrands(channel)).map((maker) => maker.slug));
}

/** Pure half of `getBrands`, exported for its test. */
export function mergeBrands(
	makers: readonly { slug: string; name: string; productCount: number }[],
	entries: readonly CmsBrand[],
): Brand[] {
	const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
	return makers
		.map((maker) => {
			const entry = bySlug.get(maker.slug);
			return {
				slug: maker.slug,
				// Saleor's spelling: it is what the product cards print.
				name: maker.name,
				productCount: maker.productCount,
				approved: HOMEPAGE_BRAND_SLUGS.includes(maker.slug),
				logo: entry?.logo ?? null,
				heroImage: entry?.heroImage ?? null,
				shortDescription: entry?.shortDescription ?? null,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, "sk", { sensitivity: "base" }));
}

/**
 * This market's brands, alphabetically. Saleor's fault throws (the page shows its error state);
 * Payload's is survived — the brands appear as wordmarks until the CMS answers again.
 */
export async function getBrands(channel: string): Promise<Brand[]> {
	const [makers, entries] = await Promise.all([
		saleorBrands(channel),
		getCmsBrands(channel).catch((error: unknown) => {
			console.warn("[Brands] CMS entries left out:", error instanceof Error ? error.message : error);
			return [] as CmsBrand[];
		}),
	]);
	return mergeBrands(makers, entries);
}

/** One brand of this market, or `null` when the channel sells nothing of it. */
export async function getBrand(channel: string, slug: string): Promise<Brand | null> {
	return (await getBrands(channel)).find((brand) => brand.slug === slug) ?? null;
}
