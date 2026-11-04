import table from "./product-redirects.json";

/**
 * Retired product addresses, and the product address that replaces each one.
 *
 * CFM changes a product's public address in two ways: it renames the slug of a product that stays
 * (the Kargo roof versions, 2026-10-30: about 800 products), and it folds several products into one
 * (about 460 Kargo products). In both cases the old address stops serving in Saleor, so without an
 * entry here it answers 404 and whatever linked to it, or had indexed it, is lost.
 *
 * ## Data
 *
 * `product-redirects.json` is keyed by MARKET (`sk`, `cz`, …), because a product slug is a market's
 * own: Slovakia reads the base slug, a foreign market its translated one. Each entry is one old slug
 * to one new slug, no path and no market prefix. An empty table is the resting state.
 * `scripts/product-redirects-from-table.mjs` writes the file from CFM's delivery.
 *
 * ## When a redirect may happen
 *
 * Not from this table alone. The proxy sends a visitor on only when Saleor says the OLD slug is gone
 * AND the NEW one exists in that channel (`retiredProductSlug` in `proxy.ts`). Until CFM has written
 * the change into Saleor the old address is the one that serves, and a redirect would take a working
 * product page away or land on a 404. So this support can be deployed BEFORE CFM merges the products,
 * and does nothing until the merge has happened. An upstream that does not answer leaves the request alone.
 *
 * Targets are final: no target is itself a source (tested), so nobody is sent through two hops.
 *
 * No I/O and no `server-only`: the proxy imports this, and the proxy runs before every request.
 */

type Table = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface ProductRedirectTable {
	readonly release: string;
	readonly source: string;
	readonly exact: Table;
}

export const PRODUCT_REDIRECTS: ProductRedirectTable = table;

let index: ReadonlyMap<string, ReadonlyMap<string, string>> = build(PRODUCT_REDIRECTS.exact);

function build(exact: Table): ReadonlyMap<string, ReadonlyMap<string, string>> {
	return new Map(Object.entries(exact).map(([market, slugs]) => [market, new Map(Object.entries(slugs))]));
}

/** The slug that replaces `slug` in `market`, or `null` when the table does not retire it. */
export function productRedirectTarget(market: string, slug: string): string | null {
	return index.get(market)?.get(slug) ?? null;
}

/** Test seam: a table the test brings, and the shipped one back. */
export function setProductRedirectsForTests(exact: Table | null): void {
	index = build(exact ?? PRODUCT_REDIRECTS.exact);
}
