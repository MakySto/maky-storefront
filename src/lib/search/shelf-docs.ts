import type { ShelfDoc } from "./shelf-index";
import { categorySynonyms } from "./synonyms";

/**
 * From a product as Saleor returns it (`SearchShelfProducts.graphql`) to the document the index
 * reads. PURE, so the loader and the tests build documents the same way.
 *
 * The product arrives already in the market's language: `shelf-source.ts` passes it through the
 * exact-locale boundary first, which swaps in the translated name, category and parameter values or
 * refuses the product. The category's PARENTS are not part of that boundary, so their names are
 * taken here, and abroad only from a translation: a Slovak word is never indexed for a German shop.
 */

export interface ShelfSourceCategory {
	readonly id?: string | null;
	readonly name?: string | null;
	readonly slug?: string | null;
	readonly translation?: { readonly name?: string | null } | null;
	readonly parent?: ShelfSourceCategory | null;
}

export interface ShelfSourceProduct {
	readonly id: string;
	readonly name: string;
	readonly created?: string | null;
	readonly isAvailableForPurchase?: boolean | null;
	readonly ean?: string | null;
	readonly category?: ShelfSourceCategory | null;
	readonly attributes?:
		| readonly {
				readonly attribute: { readonly slug?: string | null; readonly inputType?: string | null };
				readonly values: readonly { readonly name?: string | null }[];
		  }[]
		| null;
	readonly pricing?: {
		readonly priceRange?: { readonly start?: { readonly gross: { readonly amount: number } } | null } | null;
	} | null;
	readonly variants?: readonly { readonly sku?: string | null; readonly name?: string | null }[] | null;
}

/** The parameter that names the maker (CFM writes it on every product that has one). */
export const MANUFACTURER_ATTRIBUTE_SLUG = "manufacturer";

/** Parameter kinds whose value is not a word a customer would type. */
const SKIPPED_INPUT_TYPES: ReadonlySet<string> = new Set([
	"RICH_TEXT",
	"FILE",
	"REFERENCE",
	"SINGLE_REFERENCE",
	"BOOLEAN",
	"DATE",
	"DATE_TIME",
	"SWATCH",
]);

/** A parameter value longer than this is a sentence, not a property. */
const MAX_ATTRIBUTE_VALUE = 40;

/**
 * A product that is bought for something else, by the base slug of its category: an accessory, a
 * spare part, or a fitting kit (the part of a roof rack made for one car's roof, 239 of the 325
 * roof-rack parts of the Slovak shelf). It is found by its own words as before; where it ties with
 * the thing itself ("strešný nosič" names bars, feet and kits alike) it is listed after it.
 */
export function isAccessoryCategory(baseSlug: string | null | undefined): boolean {
	return /^(?:prislusenstvo|nahradne-diely|montazne-kity)-/.test(baseSlug ?? "");
}

export function toShelfDoc(
	product: ShelfSourceProduct,
	options: {
		/** The catalogue language of the market (`sk`, `de`…): which synonyms apply. */
		readonly language: string;
		/** A foreign market: parents are named by their translation only. */
		readonly localized: boolean;
		readonly baseSlugOf: (category: ShelfSourceCategory) => string | null;
	},
): ShelfDoc {
	const chain: ShelfSourceCategory[] = [];
	for (let category = product.category; category && chain.length < 4; category = category.parent) {
		chain.push(category);
	}
	const baseSlugs = chain.map((category) => options.baseSlugOf(category));
	const categoryNames = chain
		.map((category, depth) =>
			// The product's own category was localized with the product; its parents were not.
			depth === 0 || !options.localized ? category.name : category.translation?.name,
		)
		.filter((name): name is string => typeof name === "string" && name.trim().length > 0);

	let brand: string | null = null;
	const attributes: string[] = [];
	for (const { attribute, values } of product.attributes ?? []) {
		const names = values.map((value) => value.name?.trim() ?? "").filter(Boolean);
		if (attribute.slug === MANUFACTURER_ATTRIBUTE_SLUG) {
			brand = names[0] ?? null;
			continue;
		}
		if (attribute.inputType && SKIPPED_INPUT_TYPES.has(attribute.inputType)) continue;
		for (const name of names) {
			// A bare number ("120", "18") is a measure without its meaning: it would answer "priečniky 120"
			// with whatever weighs 120 kg.
			if (name.length <= MAX_ATTRIBUTE_VALUE && /\p{L}{3}/u.test(name)) attributes.push(name);
		}
	}

	const codes = new Set<string>();
	for (const variant of product.variants ?? []) {
		if (variant.sku) codes.add(variant.sku);
		if (variant.name) codes.add(variant.name);
	}
	if (product.ean) codes.add(product.ean);

	return {
		id: product.id,
		name: product.name,
		brand,
		categorySlug: baseSlugs[0] ?? null,
		rootCategorySlug: baseSlugs[baseSlugs.length - 1] ?? null,
		categoryNames,
		synonyms: baseSlugs.flatMap((slug) => (slug ? categorySynonyms(options.language, slug) : [])),
		codes: [...codes],
		attributes,
		accessory: isAccessoryCategory(baseSlugs[0]),
		purchasable: product.isAvailableForPurchase !== false,
		price: product.pricing?.priceRange?.start?.gross.amount ?? null,
		created: product.created ?? null,
	};
}
