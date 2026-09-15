import "server-only";

import { cache } from "react";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { type CatalogContentStatus, loadCatalogContent } from "./snapshot";
import { type CatalogNode, type CatalogTree, buildCatalogTree } from "./tree";

// The market → language mapping lives in `./language` so the proxy can use it without
// `server-only`. Re-exported so the routes keep importing it from here.
export { catalogLanguageForChannel, catalogLanguageForMarket } from "./language";

/**
 * One assembled view of the catalogue, built once per request per language and shared.
 *
 * Building the tree walks 1 475 nodes and 1 102 applications. That is cheap once and
 * wasteful per component, so it is wrapped in React `cache()` and sits on top of the
 * two loaders, which have their own cross-request memos.
 */
export type CatalogView =
	| { readonly ready: true; readonly tree: CatalogTree; readonly status: CatalogContentStatus }
	| { readonly ready: false; readonly reason: string; readonly status: CatalogContentStatus };

export const loadCatalogView = cache(async function loadCatalogView(language: string): Promise<CatalogView> {
	const [content, fitment] = await Promise.all([loadCatalogContent(language), loadFitmentDataset()]);

	if (!content.snapshot) {
		return {
			ready: false,
			reason: content.status.unavailableReason ?? "no content snapshot",
			status: content.status,
		};
	}

	// A missing fitment dataset does not fail the view — it EMPTIES it. Every node in the
	// tree comes from the fitment artifact (`tree.ts`), so without one no vehicle page
	// resolves, no tile renders and the sitemap lists none: a probe on 2026-09-15 built a
	// tree of zero nodes. Admitting content-only pages is not the remedy. A page CFM retired
	// has exactly that shape, and it must answer through its redirect, not render.
	return { ready: true, tree: buildCatalogTree(content.snapshot, fitment.dataset), status: content.status };
});

/**
 * `("stresne-nosice", ["bmw"])` -> `/stresne-nosice/bmw`.
 *
 * The category slug is a parameter rather than a constant, and the result is only
 * ever LOOKED UP — never trusted. A path the snapshot does not contain does not
 * resolve, so `/sk/stresne-boxy/bmw` cannot borrow a roof-rack page, and a second
 * assortment needs no new route.
 */
export function vehiclePathFromSegments(categorySlug: string, segments: readonly string[]): string {
	return `/${categorySlug}/${segments.join("/")}`;
}

export interface ResolvedCatalogPage {
	readonly node: CatalogNode;
	readonly tree: CatalogTree;
}

/**
 * Find the node for a public path, or `null`.
 *
 * Lookup is by `urlPath` because that is what the visitor typed — which is a different
 * job from JOINING the two artifacts, where only `vehicleId` is allowed.
 *
 * ⚠️ `urlPath` is localized per language — `/stresni-nosice/bmw` in `cs`, `/roof-racks/bmw`
 * in `en`, measured on the 2026-09-15 artifacts — but the proxy carries only the Slovak
 * category slug onto this route. A foreign market therefore resolves only the pages that
 * borrowed the Slovak route. Routing the localized roots is separate work; inventing slugs
 * the snapshot does not contain is not it.
 */
export function resolveVehiclePath(
	tree: CatalogTree,
	categorySlug: string,
	segments: readonly string[],
): CatalogNode | null {
	if (segments.length === 0 || segments.length > 3) return null;
	return tree.byUrlPath.get(vehiclePathFromSegments(categorySlug, segments)) ?? null;
}
