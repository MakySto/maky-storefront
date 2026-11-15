import { getBaseUrl } from "./config";

/**
 * `ItemList` structured data for a page that IS a list of products (a tyre-size page): the names and addresses of
 * what it lists, in the order it lists them.
 *
 * Only names and URLs. Prices and availability belong to each product's own page, which carries its `Product` data
 * from the same Saleor read that paints it; repeating them here would be a second copy that can disagree.
 * `null` for a list of fewer than two: a list of one says nothing a link does not.
 */
export function buildItemListJsonLd(items: readonly { name: string; href: string }[]) {
	if (items.length < 2) return null;
	const base = getBaseUrl();
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		numberOfItems: items.length,
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			url: item.href.startsWith("http") ? item.href : `${base}${item.href}`,
		})),
	};
}
