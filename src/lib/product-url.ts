import { marketHref } from "@/lib/channel-map";

/**
 * PUBLIC_PRODUCT_URL_V1 — the single place a product URL is built.
 *
 * Canonical route: `/{market}/{localized-product-slug}`, e.g.
 * `/sk/stresny-box-thule-motion-3-xxl-titan-glossy-639901`.
 *
 * The slug is authored in CFM (SKU last, ASCII, hyphens only) and transported
 * to Saleor as `Product.slug`; the storefront never derives or rewrites it.
 * Every card, search hit, breadcrumb, cart line, JSON-LD and canonical tag goes
 * through here, so the day a market gets its own translated slug there is one
 * function to change instead of a dozen template literals.
 */

/** Path relative to the market prefix: `/stresny-box-...-639901`. */
export function productPath(slug: string, variantId?: string): string {
	const pathname = `/${encodeURIComponent(slug)}`;
	if (!variantId) {
		return pathname;
	}
	return `${pathname}?${new URLSearchParams({ variant: variantId }).toString()}`;
}

/**
 * Absolute in-app href including the friendly market prefix.
 * Accepts either the Saleor channel slug (`sk-eur`) or the market (`sk`).
 */
export function productHref(channel: string, slug: string, variantId?: string): string {
	return marketHref(channel, productPath(slug, variantId));
}

/** The retired `/products/<slug>` shape. Redirect source only — never link to it. */
export function legacyProductPath(slug: string): string {
	return `/products/${encodeURIComponent(slug)}`;
}
