import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { catalogLanguageForMarket } from "@/lib/catalog-content/language";
import { categoryRoutePath, isCategorySlug, isLiveCategorySlug } from "./categories";
import { KARGO_BASE_SLUG, KARGO_CATEGORY_ID, KARGO_CATEGORY_SLUGS, KARGO_PREVIOUS_SLUG } from "./kargo-slugs";

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
 * ## Snow chains and snow socks (2026-11-08)
 *
 * `snehove-retaze` (Category:9, no parent) is the shelf of the 145 chains and socks, sold in Slovakia since 2026-11-07.
 * CFM writes them to the nine EU markets together with the category's translations, whose slugs are in the row below
 * (`SNEHOVE_RETAZE_CATEGORY_L10N_MANIFEST`, file sha256 `33a86b3a…f6e4`). Without a row, the product page's category link
 * built from the translated slug Saleor returns goes to `/de/categories/schneeketten` while the base slug answers at
 * `/de/snehove-retaze`: one category, two public addresses, and a Slovak word in the German shop. Austria reads the
 * German translation, so it shares Germany's segment and needs no `marketSegments`.
 *
 * The USA and Canada are not part of that run: CFM writes no English translation of this category, so the English
 * markets keep the base slug as their address (their `en` segment IS the base slug, which the table reads as "no
 * localized spelling"). The day CFM writes an English one, the row gets its segment here and nowhere else.
 *
 * ## Roof-rack parts and feet (2026-11-15)
 *
 * `diely-stresnych-nosicov` (Category:35, a child of the roof-rack root) and its child `patky-stresnych-nosicov`
 * (Category:36) hold the parts sold on their own: the first four are Nordrive Evos foot packs, sold in Slovakia and in
 * the nine EU markets since 2026-11-15. CFM wrote both categories' translations in that run, with the slugs in the two
 * rows below (`DIELY_CATEGORY_L10N_MANIFEST`, file sha256 `0b4c5d2f…def4`, 18 translations). Without the rows the
 * German shop answered the feet at `/de/patky-stresnych-nosicov`, a Slovak word, and the product page's category link,
 * built from the translated slug Saleor returns, went to `/de/categories/fusssaetze-fuer-dachtraeger`. Austria has
 * texts of its own (`DE_AT`), so it is spelled apart from Germany (`marketSegments`), as Kargo is.
 *
 * The USA and Canada are not part of that run: no English translation exists, so their `en` segment is the base slug.
 *
 * ## A category the table has no row for (2026-11-15)
 *
 * The owner wants no address with `/categories/` anywhere, for every category to come, so the rows above are no
 * longer the only way to a localized address. `lib/live-categories.ts` reads each category's translated slug in the
 * language every foreign market reads (Austria `DE_AT`, Canada `EN_CA`), keeps the ones that no product, route,
 * market, cart word or other category holds in that market, and publishes them here (`publishLearnedCategories`).
 * A category CFM translates tomorrow therefore has `/de/<translated slug>` with no row and no release, and the
 * `/categories/…` form and the Slovak spelling answer a permanent redirect to it, as they do for the rows.
 *
 * The table wins wherever it spells a category in a market. Saleor fills in only what it leaves as the base slug
 * (snow chains in the USA and Canada until now), and only for a category it names at all: the rows stay for what
 * they carry that a translation cannot (Austria spelled apart from Germany before `DE_AT` existed, `legacySegments`,
 * the vehicle tree CFM publishes under the language's root).
 *
 * A category is told from the table's row by its Saleor ID, not by its slug: Saleor still holds the Kargo shelf under
 * the slug of its first night while the row is named `kargo-…`, and the nine translations Saleor holds for it are the
 * row's `legacySegments`. The first deploy of this read (2026-11-15 18:00 UTC) compared slugs, took the shelf's own
 * translations for another category's spellings and logged nine refusals that were nothing of the kind.
 *
 * A translated slug that does not become the address (a product or another category holds it, two categories claim
 * it, or it is not the one the table spells) is still the slug Saleor hands a page when it names that category, so
 * it is kept as an ALIAS: `categoryBaseSlug` finds the category by it, and the link or the `/categories/…` form
 * lands on the address the category does have. An alias is never routed at the root: the product that holds the
 * slug keeps it.
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
	/**
	 * Spellings this category had in a market before its row looked like this: the translated slug Saleor held
	 * (`dachtraeger-und-dachkoerbe-fuer-transporter`) while the page was still reached under `/categories/`. They are
	 * addresses that exist in links, bookmarks and indexes, so each one answers a 301 to the canonical root.
	 */
	readonly legacySegments?: Readonly<Partial<Record<string, readonly string[]>>>;
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

const SNOW_CHAIN_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "snehove-retaze",
	cs: "snehove-retezy",
	de: "schneeketten",
	pl: "lancuchy-sniegowe",
	hu: "holancok",
	it: "catene-da-neve",
	fr: "chaines-a-neige",
	es: "cadenas-de-nieve",
	ro: "lanturi-de-zapada",
	// No English translation is written yet (the USA and Canada are not part of the run): the base slug stays.
	en: "snehove-retaze",
};

const RACK_PART_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "diely-stresnych-nosicov",
	cs: "dily-stresnich-nosicu",
	de: "einzelteile-fuer-dachtraeger",
	pl: "czesci-bagaznikow-dachowych",
	hu: "tetocsomagtarto-alkatreszek",
	it: "componenti-per-portapacchi-da-tetto",
	fr: "pieces-pour-barres-de-toit",
	es: "piezas-para-barras-de-techo",
	ro: "piese-pentru-bare-de-acoperis",
	// No English translation is written yet (the USA and Canada are not part of the run): the base slug stays.
	en: "diely-stresnych-nosicov",
};

const RACK_FOOT_SEGMENTS: Readonly<Record<CatalogLanguage, string>> = {
	sk: "patky-stresnych-nosicov",
	cs: "patky-stresnich-nosicu",
	de: "fusssaetze-fuer-dachtraeger",
	pl: "stopy-bagaznikow-dachowych",
	hu: "tetocsomagtarto-talpak",
	it: "piedi-per-portapacchi-da-tetto",
	fr: "pieds-pour-barres-de-toit",
	es: "pies-para-barras-de-techo",
	ro: "picioare-pentru-bare-de-acoperis",
	// As above: no English translation yet.
	en: "patky-stresnych-nosicov",
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
		saleorId: KARGO_CATEGORY_ID,
		segments: KARGO_SEGMENTS,
		marketSegments: {
			at: "kargo-dachtraeger-und-dachkoerbe-fuer-lieferwagen",
			ca: "kargo-van-roof-racks-and-crossbars",
		},
		// The slugs of the category's first translations, read from Saleor on 2026-11-02 (Category:34, still
		// named "Strešné nosiče a koše na dodávky"). Slovakia, the USA and Canada have none.
		legacySegments: {
			cz: ["stresni-nosice-a-kose-na-dodavky"],
			de: ["dachtraeger-und-dachkoerbe-fuer-transporter"],
			at: ["dachtraeger-und-dachkoerbe-fuer-transporter"],
			pl: ["bagazniki-dachowe-i-kosze-do-samochodow-dostawczych"],
			hu: ["tetocsomagtartok-es-tetokosarak-kisteherautokra"],
			ro: ["bare-transversale-si-cosuri-portbagaj-pentru-autoutilitare"],
			fr: ["barres-de-toit-et-galeries-pour-utilitaires"],
			it: ["barre-portatutto-e-cesti-per-furgoni"],
			es: ["barras-de-techo-y-bacas-para-furgonetas"],
		},
	},
	{
		baseSlug: "snehove-retaze",
		saleorId: "Q2F0ZWdvcnk6OQ==",
		segments: SNOW_CHAIN_SEGMENTS,
	},
	{
		baseSlug: "diely-stresnych-nosicov",
		saleorId: "Q2F0ZWdvcnk6MzU=",
		segments: RACK_PART_SEGMENTS,
		marketSegments: { at: "dachtraeger-einzelteile" },
	},
	{
		baseSlug: "patky-stresnych-nosicov",
		saleorId: "Q2F0ZWdvcnk6MzY=",
		segments: RACK_FOOT_SEGMENTS,
		marketSegments: { at: "traegerfuesse-fuer-dachtraeger" },
	},
];

const STATIC_BY_BASE = new Map(LOCALIZED_CATEGORIES.map((category) => [category.baseSlug, category]));
const STATIC_BY_ID = new Map(LOCALIZED_CATEGORIES.map((category) => [category.saleorId, category]));
const KARGO_ROW = STATIC_BY_BASE.get(KARGO_BASE_SLUG)!;

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

/** The segment a category has in this market: the market's own spelling when the row has one, else its language's. */
function segmentIn(category: LocalizedCategory, market: string, language: CatalogLanguage): string {
	return category.marketSegments?.[market] ?? category.segments[language];
}

// --- what the running server has learned from Saleor ---------------------------------------------------------

/**
 * Where `src/lib/live-categories.ts` publishes what it read from Saleor's category translations, on `globalThis`.
 * A key and not an import, for the reason `LIVE_CATEGORY_SLUGS_KEY` is one: the proxy and the route handlers are
 * separate bundles of one process, and this file reaches the browser, where the key is simply absent and the table
 * below answers alone.
 */
export const LEARNED_CATEGORIES_KEY: unique symbol = Symbol.for("maky.category-routes.learned.v1");

/**
 * One category as Saleor holds it: its id, and per market the slug of the translation that market reads.
 *
 * `segments` names only the markets where the slug differs from the base slug, so an absent market means "no
 * localized spelling". The server checks each segment before it publishes it (a product, a route, a market or
 * another category must not hold it); this file takes what it is given.
 *
 * `aliases` are the other translated slugs Saleor holds for the category, by market: the ones that did not become its
 * address. They are never routed; they only let `categoryBaseSlug` find the category from the slug Saleor hands a page.
 * `baseSlug` is the slug Saleor holds NOW, which is not the table's for a category the table names differently.
 */
export interface LearnedCategory {
	readonly baseSlug: string;
	readonly saleorId: string;
	readonly segments: Readonly<Record<string, string>>;
	readonly aliases?: Readonly<Record<string, readonly string[]>>;
}

function learnedRows(): readonly LearnedCategory[] | undefined {
	return (globalThis as typeof globalThis & { [LEARNED_CATEGORIES_KEY]?: readonly LearnedCategory[] })[
		LEARNED_CATEGORIES_KEY
	];
}

/** Hand the table the localized spellings the running server has read from Saleor. Replaces what was published before. */
export function publishLearnedCategories(rows: readonly LearnedCategory[]): void {
	(globalThis as typeof globalThis & { [LEARNED_CATEGORIES_KEY]?: readonly LearnedCategory[] })[
		LEARNED_CATEGORIES_KEY
	] = rows.map((row) => ({ ...row, segments: { ...row.segments } }));
}

/** Test seam: process state by design. */
export function clearLearnedCategories(): void {
	delete (globalThis as typeof globalThis & { [LEARNED_CATEGORIES_KEY]?: readonly LearnedCategory[] })[
		LEARNED_CATEGORIES_KEY
	];
}

interface RouteView {
	readonly rows: readonly LocalizedCategory[];
	readonly byBase: ReadonlyMap<string, LocalizedCategory>;
	readonly byId: ReadonlyMap<string, LocalizedCategory>;
	/** `market → segment → category`, for the localized spellings only (not the base slugs). */
	readonly bySegment: ReadonlyMap<string, ReadonlyMap<string, LocalizedCategory>>;
	/** Saleor id → the base slug the table or the server names the category by, for every category the server read. */
	readonly baseById: ReadonlyMap<string, string>;
	/** `market → alias → base slug`: translated slugs that name a category without being the address it is routed at. */
	readonly aliases: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/** The rows above, plus what Saleor holds beyond them. The table wins wherever it has a spelling. */
function mergedRows(): readonly LocalizedCategory[] {
	const learned = learnedRows() ?? [];
	if (learned.length === 0) return LOCALIZED_CATEGORIES;
	const learnedById = new Map(learned.map((row) => [row.saleorId, row]));
	const learnedByBase = new Map(learned.map((row) => [row.baseSlug, row]));

	const rows = LOCALIZED_CATEGORIES.map((category): LocalizedCategory => {
		// By id first: Saleor can hold a table category under another slug than the row's (the Kargo shelf).
		const row = learnedById.get(category.saleorId) ?? learnedByBase.get(category.baseSlug);
		if (!row) return category;
		// A market the row spells as the base slug has no localized spelling yet (snow chains in the USA and Canada
		// before CFM writes an English translation): Saleor's translation is the spelling the day it lands.
		const filled: Record<string, string> = {};
		for (const [market, segment] of Object.entries(row.segments)) {
			const language = languageOf(market);
			if (market === "sk" || !language) continue;
			if (segmentIn(category, market, language) === category.baseSlug) filled[market] = segment;
		}
		return Object.keys(filled).length === 0
			? category
			: { ...category, marketSegments: { ...category.marketSegments, ...filled } };
	});

	for (const row of learned) {
		// A table category is never a second row, whatever slug Saleor holds it under.
		if (STATIC_BY_BASE.has(row.baseSlug) || STATIC_BY_ID.has(row.saleorId)) continue;
		const segments = Object.fromEntries(
			CATALOG_LANGUAGES.map((language) => [language, row.baseSlug]),
		) as Record<CatalogLanguage, string>;
		const marketSegments = Object.fromEntries(
			Object.entries(row.segments).filter(([market]) => market !== "sk" && languageOf(market) !== null),
		);
		// A category with aliases only has no address of its own to add: it is its base slug in every market.
		if (Object.keys(marketSegments).length === 0) continue;
		rows.push({ baseSlug: row.baseSlug, saleorId: row.saleorId, segments, marketSegments });
	}
	return rows;
}

let cachedView:
	| { readonly key: readonly LearnedCategory[] | undefined; readonly view: RouteView }
	| undefined;

/** The indexes of the table, rebuilt only when the server publishes something new. */
function routeView(): RouteView {
	const key = learnedRows();
	if (cachedView && cachedView.key === key) return cachedView.view;

	const rows = mergedRows();
	const bySegment = new Map<string, Map<string, LocalizedCategory>>();
	for (const market of Object.keys(CHANNEL_MAP)) {
		const language = languageOf(market);
		if (!language) continue;
		const segments = new Map<string, LocalizedCategory>();
		for (const category of rows) {
			for (const legacy of category.legacySegments?.[market] ?? []) segments.set(legacy, category);
		}
		// A spelling a category from the table already holds is never taken over by one learned from Saleor.
		for (const category of rows.filter((row) => STATIC_BY_BASE.has(row.baseSlug))) {
			segments.set(segmentIn(category, market, language), category);
		}
		for (const category of rows.filter((row) => !STATIC_BY_BASE.has(row.baseSlug))) {
			const segment = segmentIn(category, market, language);
			if (!segments.has(segment)) segments.set(segment, category);
		}
		bySegment.set(market, segments);
	}

	const byBase = new Map(rows.map((category) => [category.baseSlug, category]));
	const baseById = new Map(rows.map((category) => [category.saleorId, category.baseSlug]));
	const aliases = new Map<string, Map<string, string>>();
	for (const row of learnedRows() ?? []) {
		// The table's name for a category it holds wins over the slug Saleor holds it under.
		if (!baseById.has(row.saleorId)) baseById.set(row.saleorId, row.baseSlug);
		const base = baseById.get(row.saleorId)!;
		for (const [market, slugs] of Object.entries(row.aliases ?? {})) {
			const routed = bySegment.get(market);
			if (!routed) continue;
			const found = aliases.get(market) ?? new Map<string, string>();
			for (const slug of slugs) {
				// A slug some category is routed at, or any base slug, names that category already.
				if (routed.has(slug) || byBase.has(slug)) continue;
				found.set(slug, base);
			}
			if (found.size > 0) aliases.set(market, found);
		}
	}

	const view: RouteView = {
		rows,
		byBase,
		byId: new Map(rows.map((category) => [category.saleorId, category])),
		bySegment,
		baseById,
		aliases,
	};
	cachedView = { key, view };
	return view;
}

/**
 * The spelling the TABLE (not Saleor) gives a category in a market, or `null` when it has none there: the base slug,
 * and every market of Slovakia, count as none. What the server learns from Saleor is only what this does not say.
 *
 * The category is found by its Saleor id when the caller has one, and by the slug otherwise: Saleor can hold a table
 * category under a slug other than the row's, and the id is what names it then.
 */
export function tableSpelling(
	baseSlug: string,
	marketOrChannel: string,
	saleorId?: string | null,
): string | null {
	const category = (saleorId ? STATIC_BY_ID.get(saleorId) : undefined) ?? STATIC_BY_BASE.get(baseSlug);
	const market = marketOf(marketOrChannel);
	const language = languageOf(marketOrChannel);
	if (!category || !market || !language || market === "sk") return null;
	const segment = segmentIn(category, market, language);
	return segment === category.baseSlug ? null : segment;
}

/**
 * The base slug of a category named by its Saleor id, or `null`. A foreign page learns a category's slug from a
 * translation, which can be any spelling; its id never changes. Every category the server has read from Saleor
 * answers, not only the ones with an address of their own.
 */
export function baseSlugForCategoryId(id: string | null | undefined): string | null {
	return (id && routeView().baseById.get(id)) || null;
}

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
	return (
		routeView().bySegment.get(market)?.get(segment) ??
		routeView().byBase.get(segment) ??
		// The slug Kargo had for its first night. Abroad it never was an address worth keeping, so it names the row;
		// in Slovakia it is the live root until Saleor holds the new slug (`renamedCategoryTarget`).
		(segment === KARGO_PREVIOUS_SLUG && market !== "sk" ? KARGO_ROW : null)
	);
}

/**
 * The slug to ask Saleor for. Identity everywhere else is the base slug, but the Kargo category has two while it
 * is renamed in Saleor: the new one once the live category list holds it, the old one until then. The shop's
 * addresses follow the table either way, so the rename in Saleor needs no release.
 */
export function saleorSlugFor(baseSlug: string): string {
	if (baseSlug !== KARGO_BASE_SLUG && baseSlug !== KARGO_PREVIOUS_SLUG) return baseSlug;
	if (isLiveCategorySlug(KARGO_BASE_SLUG)) return KARGO_BASE_SLUG;
	if (isLiveCategorySlug(KARGO_PREVIOUS_SLUG)) return KARGO_PREVIOUS_SLUG;
	return baseSlug;
}

/**
 * Is there a root URL for this category in this market? Everywhere the proxy knows the slug (`isCategorySlug`);
 * abroad also a mapped category whose localized segment differs from its base slug, because that segment is
 * routed by the table alone and does not wait for Saleor to hold the slug.
 */
export function categoryRootServes(marketOrChannel: string, baseSlug: string): boolean {
	if (isCategorySlug(baseSlug)) return true;
	const market = marketOf(marketOrChannel);
	const language = languageOf(marketOrChannel);
	const category = routeView().byBase.get(baseSlug);
	return Boolean(
		market && language && market !== "sk" && category && segmentIn(category, market, language) !== baseSlug,
	);
}

/**
 * The Saleor base slug behind a category URL segment in this market.
 *
 * An unmapped segment is returned unchanged: every other category is still addressed by its
 * base slug, and a translated slug Saleor holds but this table does not is left for
 * `lookupBySlug` to resolve rather than guessed at. The exception is an ALIAS the server read from Saleor: a
 * translated slug of a category that did not become its address (a product holds it, two categories claim it). It
 * names the category, so a link built from it goes to the address the category has and not to `/categories/…`.
 */
export function categoryBaseSlug(marketOrChannel: string, segment: string): string {
	const mapped = mappedCategoryFor(marketOrChannel, segment);
	if (mapped) return mapped.baseSlug;
	const market = marketOf(marketOrChannel);
	return (market && routeView().aliases.get(market)?.get(segment)) || segment;
}

/** What a product says about its category: Saleor's id, which no translation changes, and the slug of its market. */
export interface CategoryRef {
	readonly id?: string | null;
	readonly slug?: string | null;
}

/**
 * The base slug of the category a product carries in this market, or `null` for a product with none. Where a surface
 * compares a category with a rule keyed by BASE slug (`quote-only.ts`, the Kargo shelf), it asks this first: abroad
 * the exact-locale boundary (`resolveExactLocaleProduct`) swaps the TRANSLATED slug into the product's category.
 *
 * The id comes first. Saleor's translated slug is whatever CFM wrote and need not be the one in the table above
 * (read 2026-11-02: Germany holds `dachtraeger-und-dachkoerbe-fuer-transporter`, the table has `kargo-dachtraeger-…`),
 * while the id is the same in every language. A category the table does not know falls back to its slug.
 */
export function baseSlugOfCategory(
	marketOrChannel: string,
	category: CategoryRef | null | undefined,
): string | null {
	if (!category) return null;
	const known = category.id ? routeView().baseById.get(category.id) : undefined;
	if (known) return known;
	return category.slug ? categoryBaseSlug(marketOrChannel, category.slug) : null;
}

/**
 * Whether a category is the Nordrive Kargo shelf, whatever slug a product carries for it in this market.
 *
 * On the Slovak shop that is the base slug. Abroad it is the translated one, and comparing that with
 * `KARGO_CATEGORY_SLUGS` answered "no" on every foreign card: the material, which only this shelf asks for, was
 * missing from all of them (2026-11-02).
 */
export function isKargoCategory(marketOrChannel: string, category: CategoryRef | null | undefined): boolean {
	const base = baseSlugOfCategory(marketOrChannel, category);
	return base !== null && KARGO_CATEGORY_SLUGS.includes(base);
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
	if (categoryRootServes(marketOrChannel, base)) return `/${segment}`;
	// Kargo in Slovakia before Saleor holds the new slug: the root that serves is the old one, not `/categories/…`.
	if (base === KARGO_BASE_SLUG && isCategorySlug(KARGO_PREVIOUS_SLUG)) return `/${KARGO_PREVIOUS_SLUG}`;
	return categoryRoutePath(segment);
}

/**
 * Is this the first segment of a mapped category's localized URL in this market?
 *
 * Only the market's own localized spelling answers `true` — the base slug is already known
 * to the proxy through `isCategorySlug`, and another language's spelling (`/cz/dachtraeger`)
 * is not a URL this market has.
 */
export function isLocalizedRootSegment(market: string, segment: string): boolean {
	const category = routeView()
		.bySegment.get(marketOf(market) ?? "")
		?.get(segment);
	return Boolean(category && category.baseSlug !== segment);
}

/**
 * Where an old Kargo category URL lives now, or `null` when it is still the live one.
 *
 * `rest` is the normalized path after the market, split into segments; the result is market-relative and keeps
 * everything below the root. Two kinds of old address:
 *
 * - the Slovak slug of the first night (`stresne-nosice-a-kose-na-dodavky`). In Slovakia it answers only once
 *   Saleor holds the new slug and no longer the old one (`isCategorySlug`, which reads the live category list):
 *   until CFM has renamed the category the old root is the one that serves, and a redirect would take a working
 *   listing away. Abroad the new root serves already (it asks Saleor for whichever slug it holds, `saleorSlugFor`),
 *   so the old one answers at once;
 * - a foreign market's first translated slug (`legacySegments`), always.
 */
export function renamedCategoryTarget(market: string, rest: readonly string[]): string | null {
	const first = rest[0];
	const key = marketOf(market);
	if (!first || !key) return null;
	const target = () => "/" + [categorySegment(market, KARGO_BASE_SLUG), ...rest.slice(1)].join("/");

	if (first === KARGO_PREVIOUS_SLUG) {
		// Slovakia keeps the old root until Saleor holds the new slug and drops the old one.
		if (key === "sk" && (!isCategorySlug(KARGO_BASE_SLUG) || isCategorySlug(KARGO_PREVIOUS_SLUG)))
			return null;
		return target();
	}
	// A foreign spelling the category had before the table named it: the canonical root, at once.
	return KARGO_ROW.legacySegments?.[key]?.includes(first) ? target() : null;
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
		for (const category of routeView().rows) {
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
