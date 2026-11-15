import "server-only";

import { fittingCodes } from "./choice";
import { tyreCodesOfFamily, tyreFamilies, tyreFamilyByKey, tyreFamilyOf, type TyreFamily } from "./families";
import { perTyreLists } from "./active-lists";
import { tyreSizeIndex } from "./size-index";
import { isPlausibleTyreSize } from "./size-lookup";

/**
 * The snow-chain shelf seen as pages a search can land on: one page for a tyre size
 * (`/sk/snehove-retaze/205-60-r16`) and one for a rim diameter (`/sk/snehove-retaze/r16`).
 *
 * A shopper asks a search engine for "snehové reťaze 205/60 R16", and until now the shop had no address that
 * answers it: the narrowed listing lives behind `?tyreSize=`, whose canonical is the shelf. These pages are not
 * Saleor categories and nobody writes them: they are read from the sealed size list (`size-index`), so a page
 * exists exactly for a size the list holds, and it shows exactly the products the list names for it.
 *
 * What is a page, and what is not:
 *
 *   - **Only a standard size** (`205/60 R16`: width, profile, whole-inch rim) in the range of tyres that exist
 *     (`isPlausibleTyreSize`). The list also carries old spellings (`175 R13`, `5.00-12`), half-inch truck rims
 *     and a few rows outside that range (`275/20 R20`, `120/80 R10`); the product page and the
 *     selector still answer for them, but they get no address of their own.
 *   - **The address is the list's own label and nothing else**: `205-60-r16` is `205/60 R16`. No second spelling
 *     resolves, so one size has one URL.
 *   - **Whether a page may be indexed is a fact about the shop, not about the list**: it depends on what the
 *     channel sells (`tyreSizeOffer`). The list says which codes are made for a size; a page that offers one
 *     product, or none, is still a page a shopper may open, and is kept out of the index and the sitemap.
 *
 * No I/O here. What the channel sells is handed in by the caller as the set of public codes it lists.
 */

export interface TyreSizePage {
	readonly kind: "size";
	/** The list's own label: `205/60 R16`. */
	readonly label: string;
	/** The URL segment: `205-60-r16`. */
	readonly slug: string;
	readonly width: number;
	readonly profile: number;
	/** The rim as the list writes it: `16`. */
	readonly rim: string;
}

export interface TyreRimPage {
	readonly kind: "rim";
	readonly rim: string;
	/** The URL segment: `r16`. */
	readonly slug: string;
}

/**
 * One model family (`/sk/snehove-retaze/snowdrive-r9`): the same chain or sock in each of its sizes. The shelf lists
 * 145 products and most of them are one of thirteen models in another size; this is the page that says so, and the
 * one a search for the model's name can land on.
 */
export interface TyreFamilyPage {
	readonly kind: "family";
	/** The family's key in the sealed family file, which is also its URL segment. */
	readonly key: string;
	readonly slug: string;
	/** The model's name with no noun in it: `SnowDrive R-9`, `Gran Pree`. The page says "chains" or "socks" itself. */
	readonly name: string;
	readonly product: "chain" | "sock";
}

export type TyrePage = TyreSizePage | TyreRimPage | TyreFamilyPage;

const LABEL = /^(\d{3})\/(\d{2}) R(\d{2})$/;
const SIZE_SLUG = /^(\d{3})-(\d{2})-r(\d{2})$/;
const RIM_SLUG = /^r(\d{2})$/;

/**
 * A page that lists fewer products than this is not offered to a search engine: with one product the product's own
 * page is the better answer to the same question, and two pages saying one thing compete with each other.
 */
export const MIN_PRODUCTS_TO_INDEX = 2;

interface Pages {
	readonly bySlug: ReadonlyMap<string, TyreSizePage>;
	readonly byLabel: ReadonlyMap<string, TyreSizePage>;
	/** Rim → its sizes, ascending by width and then profile. Rims ascending. */
	readonly byRim: ReadonlyMap<string, readonly TyreSizePage[]>;
}

/** Built once per list, and again for a list that replaces it (`perTyreLists`). */
const build = perTyreLists(({ index }): Pages => {
	// Which sizes have a page is CFM's to say (`pages` in the list). Until the list says, the shop's own rule
	// stands in: a standard size in the range of tyres that exist.
	const named = index.pages ? new Set(index.pages) : null;
	const byLabel = new Map<string, TyreSizePage>();
	for (const product of Object.values(index.products)) {
		for (const [label] of product.sizes) {
			if (byLabel.has(label)) continue;
			if (named ? !named.has(label) : !isPlausibleTyreSize(label)) continue;
			// The address is built from the standard spelling and from nothing else; a size named in any other
			// spelling has no address the shop could give it, and gets none.
			const match = LABEL.exec(label);
			if (!match) continue;
			byLabel.set(label, {
				kind: "size",
				label,
				slug: `${match[1]}-${match[2]}-r${match[3]}`,
				width: Number(match[1]),
				profile: Number(match[2]),
				rim: match[3],
			});
		}
	}
	const sorted = [...byLabel.values()].sort(
		(a, b) => Number(a.rim) - Number(b.rim) || a.width - b.width || a.profile - b.profile,
	);
	const bySlug = new Map<string, TyreSizePage>();
	const byRim = new Map<string, TyreSizePage[]>();
	for (const page of sorted) {
		bySlug.set(page.slug, page);
		byRim.set(page.rim, [...(byRim.get(page.rim) ?? []), page]);
	}
	return { bySlug, byLabel, byRim };
});

/**
 * The family file writes two sock families with the Slovak noun in the label ("SnowDrive textilné ponožky"). A page
 * in twelve languages says the noun itself, so the name it prints is the label without it.
 */
const LABEL_NOUN = / textilné ponožky$/;

function familyPage(family: TyreFamily): TyreFamilyPage {
	return {
		kind: "family",
		key: family.key,
		slug: family.key,
		// CFM's own name for the model when the file carries one; the label with the noun cut off until it does.
		name: family.name ?? family.label.replace(LABEL_NOUN, ""),
		product: family.kind,
	};
}

/**
 * The page a path below the shelf names, or `null` when it names none: one segment, spelled exactly as the shop
 * spells it. `205-60-R16`, `205-60-r16/x` and a size the list does not hold are not pages.
 */
export function tyrePageOf(segments: readonly string[]): TyrePage | null {
	if (segments.length !== 1) return null;
	const segment = segments[0];
	if (typeof segment !== "string") return null;
	if (SIZE_SLUG.test(segment)) return build().bySlug.get(segment) ?? null;
	const rim = RIM_SLUG.exec(segment)?.[1];
	if (rim !== undefined) return build().byRim.has(rim) ? { kind: "rim", rim, slug: segment } : null;
	const family = tyreFamilyByKey(segment);
	return family ? familyPage(family) : null;
}

/** Every family page, ascending by key. */
export function tyreFamilyPages(): readonly TyreFamilyPage[] {
	return tyreFamilies().map(familyPage);
}

/** The page of the family a code belongs to, or `null` for a code that is not on the list. */
export function tyreFamilyPageOf(code: string | null | undefined): TyreFamilyPage | null {
	const family = tyreFamilyOf(code);
	return family ? familyPage(family) : null;
}

export interface TyreFamilyOffer {
	/** The family's codes the channel sells, ascending. */
	readonly codes: readonly string[];
	/** How many different tyre sizes those codes are listed for, old spellings included. */
	readonly sizes: number;
	/** The rims with a page that those codes are listed for, ascending. */
	readonly rims: readonly string[];
	/** At least `MIN_PRODUCTS_TO_INDEX` products: the page may be indexed and listed in the sitemap. */
	readonly indexable: boolean;
}

/** What the channel offers of a family: its codes that are on sale, and what the list says they cover. */
export function tyreFamilyOffer(key: string, onSale: ReadonlySet<string>): TyreFamilyOffer {
	const codes = tyreCodesOfFamily(key).filter((code) => onSale.has(code));
	const labels = new Set<string>();
	const rims = new Set<string>();
	const products = tyreSizeIndex().products;
	for (const code of codes) {
		for (const [label] of products[code]?.sizes ?? []) {
			labels.add(label);
			const page = build().byLabel.get(label);
			if (page) rims.add(page.rim);
		}
	}
	return {
		codes,
		sizes: labels.size,
		rims: [...rims].sort((a, b) => Number(a) - Number(b)),
		indexable: codes.length >= MIN_PRODUCTS_TO_INDEX,
	};
}

/** The page of a size, by the list's label, or `null` for a size that has none (an old spelling, a half-inch rim). */
export function tyreSizePageOf(label: string | null | undefined): TyreSizePage | null {
	return typeof label === "string" ? build().byLabel.get(label) ?? null : null;
}

/** Every size that has a page, ascending by rim, width and profile. */
export function tyreSizePages(): readonly TyreSizePage[] {
	return [...build().bySlug.values()];
}

/** The rims that have a page, ascending. */
export function tyreRimPages(): readonly TyreRimPage[] {
	return [...build().byRim.keys()].map((rim) => ({ kind: "rim", rim, slug: `r${rim}` }));
}

/** The sizes of one rim, ascending by width and profile. Empty for a rim the list does not hold. */
export function tyreSizePagesOfRim(rim: string): readonly TyreSizePage[] {
	return build().byRim.get(rim) ?? [];
}

export interface TyreSizeOffer {
	/** The public codes the channel sells that fit the size, or may fit it depending on the tyres. Ascending. */
	readonly codes: readonly string[];
	readonly chains: number;
	readonly socks: number;
	/** At least `MIN_PRODUCTS_TO_INDEX` products: the page may be indexed and listed in the sitemap. */
	readonly indexable: boolean;
}

/**
 * What the channel offers for a size: the codes the list names for it (a code whose fit depends on a question about
 * the tyres counts; its card asks) that are among the codes the channel sells.
 */
export function tyreSizeOffer(label: string, onSale: ReadonlySet<string>): TyreSizeOffer {
	const codes = [...fittingCodes(label)].filter((code) => onSale.has(code)).sort();
	const socks = codes.filter((code) => tyreFamilyOf(code)?.kind === "sock").length;
	return {
		codes,
		chains: codes.length - socks,
		socks,
		indexable: codes.length >= MIN_PRODUCTS_TO_INDEX,
	};
}

/**
 * The pages a search engine may be told about in a channel that sells these codes: every family and every size with
 * enough products, and every rim that has at least one such size. Segments, in the order families first, then each
 * rim page followed by its sizes.
 */
export function indexableTyrePageSlugs(onSale: ReadonlySet<string>): string[] {
	const slugs: string[] = tyreFamilyPages()
		.filter((family) => tyreFamilyOffer(family.key, onSale).indexable)
		.map((family) => family.slug);
	for (const [rim, sizes] of build().byRim) {
		const indexable = sizes.filter((size) => tyreSizeOffer(size.label, onSale).indexable);
		if (indexable.length === 0) continue;
		slugs.push(`r${rim}`, ...indexable.map((size) => size.slug));
	}
	return slugs;
}

/**
 * Sizes many cars in Europe leave the factory on, by rim: the shortcuts the shelf names before the rim pages.
 *
 * A merchandising pick, not data: it only decides which of the list's pages get a shortcut, never whether a product
 * fits. Ranking by how many products fit a size was tried first and named sizes few people drive on while leaving
 * out 205/55 R16. Replace it with the sizes people actually search for once the search console shows them.
 */
const COMMON_TYRE_SIZES: readonly string[] = [
	"175/65 R14",
	"185/65 R14",
	"185/60 R15",
	"185/65 R15",
	"195/65 R15",
	"205/65 R15",
	"195/55 R16",
	"205/55 R16",
	"205/60 R16",
	"215/55 R16",
	"215/60 R16",
	"215/65 R16",
	"225/55 R16",
	"205/50 R17",
	"215/55 R17",
	"215/60 R17",
	"225/45 R17",
	"225/50 R17",
	"225/55 R17",
	"225/65 R17",
	"225/40 R18",
	"225/45 R18",
	"235/55 R18",
	"235/60 R18",
	"235/55 R19",
	"255/55 R19",
];

/**
 * The shelf's shortcuts: the common sizes that have a page, in the order above (rim, width, profile). With the
 * channel's codes only sizes that may be indexed there are named; without them (the shop could not be asked) the
 * list's own counts decide, since every size named has a page either way.
 */
export function popularTyreSizes(onSale: ReadonlySet<string> | null, limit: number): TyreSizePage[] {
	const named: TyreSizePage[] = [];
	for (const label of COMMON_TYRE_SIZES) {
		const page = build().byLabel.get(label);
		if (!page) continue;
		const count = onSale ? tyreSizeOffer(label, onSale).codes.length : fittingCodes(label).size;
		if (count >= MIN_PRODUCTS_TO_INDEX) named.push(page);
		if (named.length === limit) break;
	}
	return named;
}

/** The rims that have at least one size the channel offers a product for; every rim when the shop could not be asked. */
export function offeredTyreRims(onSale: ReadonlySet<string> | null): TyreRimPage[] {
	return tyreRimPages().filter(
		({ rim }) =>
			onSale === null ||
			tyreSizePagesOfRim(rim).some((size) => tyreSizeOffer(size.label, onSale).codes.length > 0),
	);
}
