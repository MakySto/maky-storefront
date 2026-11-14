import { type CatalogContentPage } from "./contract";
import { isPubliclyVisible } from "./publication";

/**
 * Whether a vehicle address in THIS language answers a page rather than a 404.
 *
 * The vehicle route answers 404 for an address whose node has no published page in the visitor's language
 * (`vehicle-page-outcome.ts`, decided in the proxy). The fitment tree is language-agnostic, so it still holds
 * the nodes CFM has written no text for in a market (measured 2026-11-10: `/de/dachtraeger/mercedes-benz`
 * tiled Sprinter Van and Citan Van, whose pages answer 404 in DE, AT, CZ and PL). A link to such a node is a
 * dead link, so tiles and breadcrumbs offer an address only when this says it opens.
 */
export function hasOpenablePage(node: { readonly page: CatalogContentPage | null }): boolean {
	return node.page !== null && isPubliclyVisible(node.page);
}
