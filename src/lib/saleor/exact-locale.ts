import { DEFAULT_LOCALE } from "@/config/locale";

export const SOURCE_LOCALE = DEFAULT_LOCALE;

type Translation = {
	name?: string | null;
	slug?: string | null;
	description?: string | null;
	seoTitle?: string | null;
	seoDescription?: string | null;
	title?: string | null;
};

type TranslatableNamed = {
	name?: string | null;
	slug?: string | null;
	translation?: Translation | null;
};

type ProductAttribute = {
	attribute: TranslatableNamed & { externalReference?: string | null; inputType?: string | null };
	values: readonly (TranslatableNamed & { value?: string | null })[];
};

type ProductLike = TranslatableNamed & {
	description?: string | null;
	seoTitle?: string | null;
	seoDescription?: string | null;
	category?: TranslatableNamed | null;
	attributes?: readonly ProductAttribute[] | null;
	thumbnail?: { url: string; alt?: string | null } | null;
	media?: readonly { url: string; alt?: string | null; type?: string | null }[] | null;
	variants?: readonly {
		media?: readonly { url: string; alt?: string | null; type?: string | null }[] | null;
		selectionAttributes?: readonly ProductAttribute[] | null;
		nonSelectionAttributes?: readonly ProductAttribute[] | null;
	}[] | null;
};

type CategoryLike = TranslatableNamed & {
	description?: string | null;
	seoTitle?: string | null;
	seoDescription?: string | null;
};

type MenuItemLike = {
	name: string;
	translation?: Translation | null;
	category?: TranslatableNamed | null;
	collection?: TranslatableNamed | null;
	page?: { title: string; slug: string; translation?: Translation | null } | null;
	children?: readonly MenuItemLike[] | null;
};

const required = (value: string | null | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

export function isSourceLocale(locale: string): boolean {
	return locale === SOURCE_LOCALE;
}

function localizeNamed<T extends TranslatableNamed>(resource: T, locale: string): T | null {
	if (isSourceLocale(locale)) {
		return required(resource.name) ? resource : null;
	}

	const translation = resource.translation;
	if (!translation || !required(translation.name)) return null;

	return {
		...resource,
		name: translation.name,
		// A localized slug is preferred, but a base slug is explicitly allowed as
		// a URL fallback. It is never used as visible content.
		...(required(translation.slug) ? { slug: translation.slug } : {}),
	};
}

export function resolveExactLocaleCategorySummary<T extends TranslatableNamed>(
	category: T | null | undefined,
	locale: string,
): T | null {
	return category ? localizeNamed(category, locale) : null;
}

function localizeAttribute(attribute: ProductAttribute, locale: string): ProductAttribute | null {
	if (isSourceLocale(locale)) return attribute;

	const localizedAttribute = localizeNamed(attribute.attribute, locale);
	if (!localizedAttribute) return null;

	const localizedValues = attribute.values.map((value) => localizeNamed(value, locale));
	if (localizedValues.some((value) => value === null)) return null;

	return {
		...attribute,
		attribute: localizedAttribute,
		values: localizedValues as ProductAttribute["values"],
	};
}

function localizedMedia<T extends { url: string; alt?: string | null }>(
	media: readonly T[] | null | undefined,
	productName: string,
): readonly T[] | null | undefined {
	if (!media) return media;
	return media.map((item, index) => ({ ...item, alt: index === 0 ? productName : "" }));
}

/**
 * The only boundary allowed to expose Saleor product copy to a route.
 *
 * Foreign routes require one exact translation carrying every customer-facing
 * product field. Nothing in this function falls back to the Slovak base row.
 * Incomplete translated attributes make the product ineligible too, preventing
 * a translated heading above a Slovak specification table.
 */
export function resolveExactLocaleProduct<T extends ProductLike>(
	product: T | null | undefined,
	locale: string,
): T | null {
	if (!product || !required(product.name) || !required(product.slug)) return null;
	if (isSourceLocale(locale)) return product;

	const translation = product.translation;
	if (
		!translation ||
		!required(translation.name) ||
		!required(translation.description) ||
		!required(translation.seoDescription)
	) {
		return null;
	}
	const localizedName = translation.name;

	const category = product.category ? localizeNamed(product.category, locale) : null;
	if (product.category && !category) return null;

	const attributes = (product.attributes ?? []).map((attribute) => localizeAttribute(attribute, locale));
	if (attributes.some((attribute) => attribute === null)) return null;

	const variants = (product.variants ?? []).map((variant) => {
		const selectionAttributes = (variant.selectionAttributes ?? []).map((attribute) =>
			localizeAttribute(attribute, locale),
		);
		const nonSelectionAttributes = (variant.nonSelectionAttributes ?? []).map((attribute) =>
			localizeAttribute(attribute, locale),
		);
		if (
			selectionAttributes.some((attribute) => attribute === null) ||
			nonSelectionAttributes.some((attribute) => attribute === null)
		) {
			return null;
		}
		return {
			...variant,
			media: localizedMedia(variant.media, localizedName),
			selectionAttributes: selectionAttributes as ProductAttribute[],
			nonSelectionAttributes: nonSelectionAttributes as ProductAttribute[],
		};
	});
	if (variants.some((variant) => variant === null)) return null;

	return {
		...product,
		name: localizedName,
		slug: required(translation.slug) ? translation.slug : product.slug,
		description: translation.description,
		// A missing foreign SEO title may fall back only to the exact translated
		// name. Falling through to product.seoTitle would leak Slovak copy.
		seoTitle: required(translation.seoTitle) ? translation.seoTitle : localizedName,
		seoDescription: translation.seoDescription,
		category,
		attributes: attributes as ProductAttribute[],
		thumbnail: product.thumbnail ? { ...product.thumbnail, alt: localizedName } : product.thumbnail,
		media: localizedMedia(product.media, localizedName),
		variants: variants as NonNullable<T["variants"]>,
	} as T;
}

export function resolveExactLocaleProducts<T extends ProductLike>(
	products: readonly T[],
	locale: string,
): { products: T[]; dropped: number } {
	const localized = products
		.map((product) => resolveExactLocaleProduct(product, locale))
		.filter((product): product is T => product !== null);
	return { products: localized, dropped: products.length - localized.length };
}

function resolveExactLocaleTaxonomy<T extends CategoryLike>(
	resource: T | null | undefined,
	locale: string,
): T | null {
	if (!resource || !required(resource.name) || !required(resource.slug)) return null;
	if (isSourceLocale(locale)) return resource;

	const translation = resource.translation;
	if (
		!translation ||
		!required(translation.name) ||
		!required(translation.description) ||
		!required(translation.seoTitle) ||
		!required(translation.seoDescription)
	) {
		return null;
	}

	return {
		...resource,
		name: translation.name,
		slug: required(translation.slug) ? translation.slug : resource.slug,
		description: translation.description,
		seoTitle: translation.seoTitle,
		seoDescription: translation.seoDescription,
	};
}

export function resolveExactLocaleCategory<T extends CategoryLike>(
	category: T | null | undefined,
	locale: string,
): T | null {
	return resolveExactLocaleTaxonomy(category, locale);
}

export function resolveExactLocaleCollection<T extends CategoryLike>(
	collection: T | null | undefined,
	locale: string,
): T | null {
	return resolveExactLocaleTaxonomy(collection, locale);
}

function resolveMenuItem<T extends MenuItemLike>(item: T, locale: string): T | null {
	if (isSourceLocale(locale)) return required(item.name) ? item : null;
	if (!item.translation || !required(item.translation.name)) return null;

	const category = item.category ? localizeNamed(item.category, locale) : null;
	const collection = item.collection ? localizeNamed(item.collection, locale) : null;
	const page = item.page
		? item.page.translation && required(item.page.translation.title)
			? {
					...item.page,
					title: item.page.translation.title,
					slug: required(item.page.translation.slug) ? item.page.translation.slug : item.page.slug,
				}
			: null
		: null;

	if ((item.category && !category) || (item.collection && !collection) || (item.page && !page)) return null;

	const children = (item.children ?? [])
		.map((child) => resolveMenuItem(child, locale))
		.filter((child): child is MenuItemLike => child !== null);

	return {
		...item,
		name: item.translation.name,
		category,
		collection,
		page,
		children,
	} as T;
}

export function resolveExactLocaleMenu<T extends MenuItemLike>(items: readonly T[], locale: string): T[] {
	return items.map((item) => resolveMenuItem(item, locale)).filter((item): item is T => item !== null);
}
