import { cacheLife, cacheTag } from "next/cache";
import { answered, faulted, rememberBriefly, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
import { BrandValuesDocument, TypedDocumentString } from "@/gql/graphql";
import { CHANNEL_MAP } from "@/lib/channel-map";
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

/** How long an answer kept in the process stands in for asking again (the boot warm-up fills it). */
const FRESH_MS = 15 * 60_000;

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

/** For tests. */
export function __forgetBrandMakers(): void {
	kept.clear();
	loading.clear();
}

/** Saleor's makers with products in this channel, once at a time per channel. Never throws. */
function loadMakers(channel: string): Promise<Loaded> {
	const running = loading.get(channel);
	if (running) return running;
	const job = askSaleorForMakers(channel).finally(() => loading.delete(channel));
	loading.set(channel, job);
	return job;
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

	// One request for every maker's count, each an aliased `products(...) { totalCount }` —
	// instead of twenty-odd round trips per market. The slugs come from Saleor and are checked
	// against the slug shape before they are written into the query.
	const safe = makers.filter((maker) => VALUE_SLUG.test(maker.slug));
	// A catalogue with no maker at all is an answer, not a query: `query BrandCounts { }` is a
	// syntax error that Saleor refuses.
	if (safe.length === 0) return { ok: true, makers: [] };

	const query = `query BrandCounts($channel: String!) {\n${safe
		.map(
			(maker, index) =>
				`\tb${index}: products(channel: $channel, first: 1, filter: { attributes: [{ slug: "manufacturer", values: ["${maker.slug}"] }] }) { totalCount }`,
		)
		.join("\n")}\n}`;
	const counts = await executePublicGraphQL(
		new TypedDocumentString<Record<string, { totalCount: number | null } | null>, { channel: string }>(query),
		{
			variables: { channel },
			revalidate: 0,
			retry: false,
			signal: AbortSignal.timeout(COUNTS_DEADLINE_MS),
		},
	);
	if (!counts.ok) return { ok: false, message: `[Brands] counts unavailable: ${counts.error.message}` };

	const counted = safe.map((maker, index) => ({
		...maker,
		productCount: counts.data[`b${index}`]?.totalCount ?? 0,
	}));
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

	const loaded = await loadMakers(channel);
	if (loaded.ok) return answered(loaded.makers);
	if (earlier) {
		console.warn(`${loaded.message} — showing the last answer`);
		rememberBriefly();
		return answered([...earlier.makers]);
	}
	return faulted(loaded.message);
}

/**
 * Builds every live market's list once, one market at a time, so that a restart does not send all of
 * them to Saleor together with the first visitors. Never rejects; a market that could not be built is
 * built by the request that needs it.
 */
export async function prewarmBrandMakers(): Promise<void> {
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
		try {
			if ((await loadMakers(channel)).ok) built += 1;
		} catch {
			// loadMakers does not throw; nothing here may stop the warm-up.
		}
	}
	console.log(
		`[brands] warm-up: ${built} of ${channels.length} maker lists built in ${Math.round(
			(Date.now() - started) / 1000,
		)} s`,
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
