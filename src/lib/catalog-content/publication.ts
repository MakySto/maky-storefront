import { type CatalogContentPage } from "./contract";

/**
 * Two separate decisions: may a visitor SEE this page, and may Google INDEX it.
 *
 * They are separate because CFM models them separately, and because the useful
 * middle state exists: a published page that is deliberately kept out of the
 * index. Collapsing them into one flag would make `published` mean "in the
 * sitemap", which is not what the field says.
 *
 * ## A missing field is not a yes
 *
 * The schema's `required` list is `publicId, kind, urlPath, intro, top, body,
 * hasEditorialText`. `state`, `indexable` and `vehicleId` are NOT required, so a
 * page can validate perfectly and still say nothing about whether it may go out.
 * Absence therefore refuses, and says which field was missing — the alternative
 * is a snapshot that publishes itself by omission.
 *
 * Measured on the 2026-09-11 export: all 1475 pages are `draft`, all 1475 are
 * `indexable: true`. So nothing in it is publicly visible yet, and the `indexable`
 * flag is already the value it will need when publication happens — nobody has to
 * rewrite it, which is exactly why it must not be rewritten as a side effect of
 * publishing.
 */

export type VisibilityDecision =
	| { readonly visible: true }
	| { readonly visible: false; readonly reason: string };

export type IndexDecision =
	| { readonly indexable: true }
	| { readonly indexable: false; readonly reason: string };

/**
 * May a visitor open this page?
 *
 * Note what does NOT appear here: `hasEditorialText`. A vehicle page with no
 * editorial text is still a real vehicle with a real product listing, and two of
 * them are LINKED from other articles' bodies (measured: `/stresne-nosice/lynk-co/01`
 * and `/stresne-nosice/seat/ateca`). Hiding them would manufacture two 404s inside
 * published copy. They are kept reachable and kept out of the index instead.
 */
export function visibilityOf(page: CatalogContentPage): VisibilityDecision {
	if (page.state === undefined || page.state === null) {
		return { visible: false, reason: "state is absent — a page does not publish itself by omission" };
	}
	if (page.state !== "published") {
		return { visible: false, reason: `state is ${page.state}` };
	}
	return { visible: true };
}

/**
 * May Google index it?
 *
 * Requires visibility first — an unpublished page cannot be indexable — then an
 * explicit `indexable: true`, and then actual text. A page with a listing but no
 * editorial copy is a thin page; asking for it to be indexed is asking for it to
 * be judged.
 */
export function indexabilityOf(page: CatalogContentPage): IndexDecision {
	const visibility = visibilityOf(page);
	if (!visibility.visible) {
		return { indexable: false, reason: `not publicly visible: ${visibility.reason}` };
	}
	if (page.indexable === undefined || page.indexable === null) {
		return { indexable: false, reason: "indexable is absent — absence is not consent" };
	}
	if (page.indexable !== true) {
		return { indexable: false, reason: "indexable is false" };
	}
	if (!page.hasEditorialText) {
		return { indexable: false, reason: "page has no editorial text — thin page, kept out of the index" };
	}
	return { indexable: true };
}

/** Convenience for the places that only need the boolean. */
export const isPubliclyVisible = (page: CatalogContentPage): boolean => visibilityOf(page).visible;
export const isIndexable = (page: CatalogContentPage): boolean => indexabilityOf(page).indexable;

/**
 * A page may be PREVIEWED outside normal routing even when it is not visible.
 *
 * Preview is a separate, explicit server-side mode. It is deliberately not a query
 * parameter: a public parameter that turns off a publication gate is not a gate.
 * `noindex` is not an access control either, so this stays off unless the
 * environment says otherwise.
 */
export function isCatalogPreviewEnabled(): boolean {
	return process.env.MAKY_CATALOG_PREVIEW === "enabled";
}
