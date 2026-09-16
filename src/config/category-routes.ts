import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import { categoryRoutePath, isCategorySlug } from "./categories";

/**
 * Localized category URLs — the one table that ties a market to its category segments.
 *
 * ## The decision (COMMERCE-2, 2026-09-16)
 *
 * In a foreign market the category has a LOCALIZED canonical URL: `/cz/stresni-nosice`,
 * `/at/dachtraeger`, `/us/roof-racks`. Slovakia keeps `/sk/stresne-nosice`. The segments are
 * not invented here: they are the roots CFM's content artifacts already publish their 1 475
 * vehicle pages under, measured on `…-{lang}-20260915.2.json`, and `category-routes.acceptance`
 * checks them against those files.
 *
 * ## Identity is the base slug, never the URL
 *
 * Saleor is asked by base slug (`stresne-nosice`), cache tags are built from it, and the
 * fitment shelf is looked up by it. The localized segment is only ever the public spelling.
 * CFM will write category translations with a translated `slug`, and the storefront could
 * resolve a category by that — but then a translation typo in Saleor would silently move a
 * URL. The contract says the opposite: identity through the stable ID and base slug, and
 * this map. `pnpm check:category-routes` compares what Saleor holds against it.
 *
 * ## Two entities, two rows
 *
 * `stresne-nosice` (Category:2) owns a root URL and the vehicle tree below it.
 * `nordrive-stresne-nosice` (Category:5) is its child, a listing under `/categories/`, and the
 * category every Nordrive product names. They must never share a segment in one language —
 * the Nordrive segment is `nordrive-<root>` as the shared contract proposes.
 *
 * ## What this does NOT move
 *
 * Product slugs, model and generation slugs, and the three RELEASE-4 pages each foreign
 * artifact still publishes under the Slovak root (`borrowed-routes.json`) keep their URLs.
 * Every other category keeps its base slug in every market until it gets a row here.
 */

/** The languages CFM publishes a catalogue in — what a market reads, not what it is called. */
export type CatalogLanguage = "sk" | "cs" | "de" | "pl" | "hu" | "it" | "fr" | "es" | "ro" | "en";

export const CATALOG_LANGUAGES: readonly CatalogLanguage[] = [
	"sk",
	"cs",
	"de",
	"pl",
	"hu",
	"it",
	"fr",
	"es",
	"ro",
	"en",
];

export type CategoryPlacement = "root" | "listing";

export interface LocalizedCategory {
	/** Saleor base slug: the identity for queries, cache tags and the fitment shelf. */
	readonly baseSlug: string;
	/** Saleor global id, read anonymously on 2026-09-16. Checked by `pnpm check:category-routes`. */
	readonly saleorId: string;
	/** `root` owns `/{market}/{segment}`; `listing` lives at `/{market}/categories/{segment}`. */
	readonly placement: CategoryPlacement;
	/** Canonical URL segment per catalogue language. `sk` is always the base slug. */
	readonly segments: Readonly<Record<CatalogLanguage, string>>;
}

const ROOF_RACK_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "stresne-nosice",
	cs: "stresni-nosice",
	de: "dachtraeger",
	pl: "bagazniki-dachowe",
	hu: "tetocsomagtartok",
	it: "barre-portatutto",
	fr: "barres-de-toit",
	es: "barras-de-techo",
	ro: "bare-transversale",
	en: "roof-racks",
};

export const LOCALIZED_CATEGORIES: readonly LocalizedCategory[] = [
	{
		baseSlug: "stresne-nosice",
		saleorId: "Q2F0ZWdvcnk6Mg==",
		placement: "root",
		segments: ROOF_RACK_SEGMENTS,
	},
	{
		baseSlug: "nordrive-stresne-nosice",
		saleorId: "Q2F0ZWdvcnk6NQ==",
		placement: "listing",
		segments: Object.fromEntries(
			CATALOG_LANGUAGES.map((language) => [
				language,
				language === "sk" ? "nordrive-stresne-nosice" : `nordrive-${ROOF_RACK_SEGMENTS[language]}`,
			]),
		) as Record<CatalogLanguage, string>,
	},
];

const BY_BASE = new Map(LOCALIZED_CATEGORIES.map((category) => [category.baseSlug, category]));

/** `language → segment → category`, for the localized spellings only (not the base slugs). */
const BY_SEGMENT = new Map<string, Map<string, LocalizedCategory>>(
	CATALOG_LANGUAGES.map((language) => [
		language,
		new Map(LOCALIZED_CATEGORIES.map((category) => [category.segments[language], category])),
	]),
);

/** `sk` or `sk-eur` → `sk`. Both key spaces are disjoint, so one helper serves pages and the proxy. */
function marketOf(marketOrChannel: string): string | null {
	if (CHANNEL_MAP[marketOrChannel]) return marketOrChannel;
	return REVERSE_MAP[marketOrChannel] ?? null;
}

function languageOf(marketOrChannel: string): CatalogLanguage | null {
	const market = marketOf(marketOrChannel);
	const language = market ? catalogLanguageForMarket(market) : null;
	return language && (CATALOG_LANGUAGES as readonly string[]).includes(language)
		? (language as CatalogLanguage)
		: null;
}

/**
 * The base slug a URL segment names in this market, or `null` when it names no mapped category.
 *
 * Accepts the market's own localized segment AND the base slug — the base slug is how the
 * three borrowed Slovak pages are addressed abroad, and it is what Saleor hands back for a
 * category it has no translated slug for.
 */
export function mappedCategoryFor(marketOrChannel: string, segment: string): LocalizedCategory | null {
	const language = languageOf(marketOrChannel);
	if (!language) return null;
	return BY_SEGMENT.get(language)?.get(segment) ?? BY_BASE.get(segment) ?? null;
}

/**
 * The Saleor base slug behind a category URL segment in this market.
 *
 * An unmapped segment is returned unchanged: every other category is still addressed by its
 * base slug, and a translated slug Saleor holds but this table does not is left for
 * `lookupBySlug` to resolve rather than guessed at.
 */
export function categoryBaseSlug(marketOrChannel: string, segment: string): string {
	return mappedCategoryFor(marketOrChannel, segment)?.baseSlug ?? segment;
}

/** The canonical public segment of a category in this market. Unmapped slugs pass through. */
export function categorySegment(marketOrChannel: string, slug: string): string {
	const category = mappedCategoryFor(marketOrChannel, slug);
	const language = languageOf(marketOrChannel);
	return category && language ? category.segments[language] : slug;
}

/**
 * Public, channel-relative URL of a category in a market — the localized twin of `categoryUrl`.
 *
 * `slug` may be the base slug or any spelling Saleor returned (the exact-locale boundary
 * swaps in a translated slug when one exists). In Slovakia this is identical to
 * `categoryUrl(slug)` for every category, which `category-routes.test.ts` pins.
 */
export function categoryUrlFor(marketOrChannel: string, slug: string): string {
	const base = categoryBaseSlug(marketOrChannel, slug);
	const segment = categorySegment(marketOrChannel, base);
	return isCategorySlug(base) ? `/${segment}` : categoryRoutePath(segment);
}

/**
 * Is this the first segment of a mapped ROOT category's localized URL in this market?
 *
 * Only the market's own localized spelling answers `true` — the base slug is already known
 * to the proxy through `isCategorySlug`, and another language's spelling (`/cz/dachtraeger`)
 * is not a URL this market has.
 */
export function isLocalizedRootSegment(market: string, segment: string): boolean {
	const language = languageOf(market);
	const category = language ? BY_SEGMENT.get(language)?.get(segment) : undefined;
	return Boolean(category && category.placement === "root" && category.baseSlug !== segment);
}

export interface CategoryRouteRow {
	readonly market: string;
	readonly channel: string;
	readonly locale: string;
	readonly language: CatalogLanguage;
	readonly baseSlug: string;
	readonly saleorId: string;
	readonly placement: CategoryPlacement;
	readonly segment: string;
	/** Market-prefixed canonical path, e.g. `/cz/stresni-nosice`. */
	readonly path: string;
}

/**
 * Every market × mapped category, in `CHANNEL_MAP` order — the table as one reads it in the
 * contract: friendly prefix, Saleor channel, market locale, editorial language, identity and
 * canonical URL. Derived, so it cannot drift from the lookups above.
 */
export function categoryRouteTable(): readonly CategoryRouteRow[] {
	const rows: CategoryRouteRow[] = [];
	for (const [market, config] of Object.entries(CHANNEL_MAP)) {
		const language = languageOf(market);
		if (!language) continue;
		for (const category of LOCALIZED_CATEGORIES) {
			const segment = category.segments[language];
			rows.push({
				market,
				channel: config.saleorSlug,
				locale: config.locale,
				language,
				baseSlug: category.baseSlug,
				saleorId: category.saleorId,
				placement: category.placement,
				segment,
				path: `/${market}${category.placement === "root" ? `/${segment}` : categoryRoutePath(segment)}`,
			});
		}
	}
	return rows;
}
