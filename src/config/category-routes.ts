import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import { categoryRoutePath, isCategorySlug } from "./categories";
import { KARGO_BASE_SLUG, KARGO_PREVIOUS_SLUG } from "./kargo-slugs";

export { KARGO_BASE_SLUG, KARGO_CATEGORY_SLUGS, KARGO_PREVIOUS_SLUG } from "./kargo-slugs";

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
 * `nordrive-stresne-nosice` (Category:5) is its child, with a root URL of its own since
 * 2026-10-06 (it was a listing under `/categories/` until then), and the category every Nordrive
 * product names. They must never share a segment in one language — the Nordrive segment is
 * `nordrive-<root>` as the shared contract proposes.
 *
 * ## Car fridges (2026-10-08)
 *
 * `autochladnicky` (Category:10) has a row of its own. Its segments are not vehicle-page roots: they
 * are the slugs CFM writes as the category's translated slug (the market-config pack of the CoolZ
 * translations, `COOLZ_L10N_MANIFEST`), which is also what the product page's category link carries
 * abroad. Without the row that link went to `/de/categories/kuehlboxen-fuers-auto` while the menu and
 * the home page went to `/de/autochladnicky`: one category, two public addresses. The row is checked
 * against what Saleor holds once CFM has written the translations, not against the pack.
 *
 * ## Thule roof racks (2026-10-11)
 *
 * `thule-stresne-nosice` (Category:6, a child of the root) is the shelf of every Thule set. CFM writes the Thule
 * sets to the foreign markets together with the category's translations, whose slug is `thule-<localized root>`
 * in each language: the rule Nordrive's row follows too. Without a row, a link built from the translated slug
 * Saleor returns goes to `/de/categories/thule-dachtraeger` (an unmapped slug keeps its `/categories/` form)
 * while the base slug answers at `/de/thule-stresne-nosice`: one category, two public addresses. The row is
 * checked against what Saleor holds once CFM has written them.
 *
 * The first run covered the nine markets that read the eight languages (`THULE_CATEGORY_L10N_MANIFEST`, CFM
 * 3348ecc6). The USA and Canada followed in a second run (CFM d221edc9) with the English translation: `EN` for
 * `us-usd` and `EN_CA` for `ca-cad`, both with the slug `thule-roof-racks`, so one `en` segment serves both.
 *
 * ## Nordrive Kargo (2026-10-30)
 *
 * `kargo-stresne-nosice-a-stresne-kose-na-dodavky` (Category:34, a child of the root) holds the roof bars and baskets
 * for vans. The owner named it "Kargo strešné nosiče a strešné koše na dodávky" (2026-10-30) and chose the Kargo
 * spelling for every market, with Austria and Canada spelled apart from Germany and the USA (`marketSegments`): the
 * German shop says Transporter, the Austrian one Lieferwagen; the American one cargo vans, the Canadian one
 * commercial vans. The slugs are the ones CFM writes as the category's translations. The row is checked against
 * what Saleor holds once CFM has written them.
 *
 * The category had the slug `stresne-nosice-a-kose-na-dodavky` for its first night on the Slovak shop. Saleor and
 * the shop cannot change at the same instant, so `KARGO_PREVIOUS_SLUG` is still accepted wherever a product's
 * category decides something (the shelf, the quote button), and the old root answers a 301 to the new one once
 * Saleor holds the new slug (`proxy.ts`).
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

export interface LocalizedCategory {
	/** Saleor base slug: the identity for queries, cache tags and the fitment shelf. */
	readonly baseSlug: string;
	/** Saleor global id, read anonymously on 2026-09-16. Checked by `pnpm check:category-routes`. */
	readonly saleorId: string;
	/** Canonical URL segment per catalogue language. `sk` is the base slug, unless the row says otherwise. */
	readonly segments: Readonly<Record<CatalogLanguage, string>>;
	/**
	 * Markets that read a language but spell the category differently: Austria against Germany, Canada against
	 * the USA (Kargo, 2026-10-30). Keyed by market (`at`, `ca`); every other market reads `segments`.
	 */
	readonly marketSegments?: Readonly<Partial<Record<string, string>>>;
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

const CAR_FRIDGE_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "autochladnicky",
	cs: "autochladnicky",
	de: "kuehlboxen-fuers-auto",
	pl: "lodowki-samochodowe",
	hu: "autos-hutoladak",
	it: "frigoriferi-portatili",
	fr: "glacieres-pour-voiture",
	es: "neveras-de-coche",
	ro: "frigidere-auto",
	en: "portable-refrigerators-freezers",
};

const KARGO_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "kargo-stresne-nosice-a-stresne-kose-na-dodavky",
	cs: "kargo-stresni-nosice-a-stresni-kose-na-dodavky",
	de: "kargo-dachtraeger-und-dachkoerbe-fuer-transporter",
	pl: "kargo-bagazniki-dachowe-i-kosze-dachowe-do-samochodow-dostawczych",
	hu: "kargo-tetocsomagtartok-es-tetokosarak-kisteherautokra",
	it: "kargo-barre-portatutto-e-ceste-portacarico-per-furgoni",
	fr: "kargo-barres-et-galeries-de-toit-pour-utilitaires",
	es: "kargo-barras-de-techo-y-portaequipajes-para-furgonetas",
	ro: "kargo-bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare",
	en: "kargo-roof-racks-and-crossbars-for-vans",
};

export const LOCALIZED_CATEGORIES: readonly LocalizedCategory[] = [
	{
		baseSlug: "stresne-nosice",
		saleorId: "Q2F0ZWdvcnk6Mg==",
		segments: ROOF_RACK_SEGMENTS,
	},
	{
		baseSlug: "nordrive-stresne-nosice",
		saleorId: "Q2F0ZWdvcnk6NQ==",
		segments: Object.fromEntries(
			CATALOG_LANGUAGES.map((language) => [
				language,
				language === "sk" ? "nordrive-stresne-nosice" : `nordrive-${ROOF_RACK_SEGMENTS[language]}`,
			]),
		) as Record<CatalogLanguage, string>,
	},
	{
		baseSlug: "autochladnicky",
		saleorId: "Q2F0ZWdvcnk6MTA=",
		segments: CAR_FRIDGE_SEGMENTS,
	},
	{
		baseSlug: "thule-stresne-nosice",
		saleorId: "Q2F0ZWdvcnk6Ng==",
		segments: Object.fromEntries(
			CATALOG_LANGUAGES.map((language) => [
				language,
				language === "sk" ? "thule-stresne-nosice" : `thule-${ROOF_RACK_SEGMENTS[language]}`,
			]),
		) as Record<CatalogLanguage, string>,
	},
	{
		baseSlug: KARGO_BASE_SLUG,
		saleorId: "Q2F0ZWdvcnk6MzQ=",
		segments: KARGO_SEGMENTS,
		marketSegments: {
			at: "kargo-dachtraeger-und-dachkoerbe-fuer-lieferwagen",
			ca: "kargo-van-roof-racks-and-crossbars",
		},
	},
];

const BY_BASE = new Map(LOCALIZED_CATEGORIES.map((category) => [category.baseSlug, category]));

/** The segment a category has in this market: the market's own spelling when the row has one, else its language's. */
function segmentIn(category: LocalizedCategory, market: string, language: CatalogLanguage): string {
	return category.marketSegments?.[market] ?? category.segments[language];
}

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

/** `market → segment → category`, for the localized spellings only (not the base slugs). */
const BY_SEGMENT = new Map<string, Map<string, LocalizedCategory>>(
	Object.keys(CHANNEL_MAP).flatMap((market) => {
		const language = languageOf(market);
		return language
			? [
					[
						market,
						new Map(
							LOCALIZED_CATEGORIES.map((category) => [segmentIn(category, market, language), category]),
						),
					] as const,
				]
			: [];
	}),
);

/**
 * The base slug a URL segment names in this market, or `null` when it names no mapped category.
 *
 * Accepts the market's own localized segment AND the base slug — the base slug is how the
 * three borrowed Slovak pages are addressed abroad, and it is what Saleor hands back for a
 * category it has no translated slug for.
 */
export function mappedCategoryFor(marketOrChannel: string, segment: string): LocalizedCategory | null {
	const market = marketOf(marketOrChannel);
	if (!market || !languageOf(market)) return null;
	return BY_SEGMENT.get(market)?.get(segment) ?? BY_BASE.get(segment) ?? null;
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
	const market = marketOf(marketOrChannel);
	const language = languageOf(marketOrChannel);
	return category && market && language ? segmentIn(category, market, language) : slug;
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
 * Is this the first segment of a mapped category's localized URL in this market?
 *
 * Only the market's own localized spelling answers `true` — the base slug is already known
 * to the proxy through `isCategorySlug`, and another language's spelling (`/cz/dachtraeger`)
 * is not a URL this market has.
 */
export function isLocalizedRootSegment(market: string, segment: string): boolean {
	const category = BY_SEGMENT.get(marketOf(market) ?? "")?.get(segment);
	return Boolean(category && category.baseSlug !== segment);
}

/**
 * Where the old Kargo category URL lives now, or `null` while it is still the live one.
 *
 * `rest` is the normalized path after the market, split into segments; the result is market-relative and keeps
 * everything below the root. It answers only once Saleor holds the new slug and no longer the old one
 * (`isCategorySlug`, which reads the live category list): until CFM has renamed the category the old root is the
 * one that serves, and a redirect would take a working listing away.
 */
export function renamedCategoryTarget(market: string, rest: readonly string[]): string | null {
	if (rest[0] !== KARGO_PREVIOUS_SLUG) return null;
	if (!isCategorySlug(KARGO_BASE_SLUG) || isCategorySlug(KARGO_PREVIOUS_SLUG)) return null;
	return "/" + [categorySegment(market, KARGO_BASE_SLUG), ...rest.slice(1)].join("/");
}

export interface CategoryRouteRow {
	readonly market: string;
	readonly channel: string;
	readonly locale: string;
	readonly language: CatalogLanguage;
	readonly baseSlug: string;
	readonly saleorId: string;
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
			const segment = segmentIn(category, market, language);
			rows.push({
				market,
				channel: config.saleorSlug,
				locale: config.locale,
				language,
				baseSlug: category.baseSlug,
				saleorId: category.saleorId,
				segment,
				path: `/${market}/${segment}`,
			});
		}
	}
	return rows;
}
