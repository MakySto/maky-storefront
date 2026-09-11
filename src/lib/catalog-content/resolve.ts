import "server-only";

import { cache } from "react";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { type CatalogContentStatus, loadCatalogContent } from "./snapshot";
import { type CatalogNode, type CatalogTree, buildCatalogTree } from "./tree";

/**
 * One assembled view of the catalogue, built once per request and shared.
 *
 * Building the tree walks 1 475 nodes and 1 102 applications. That is cheap once and
 * wasteful per component, so it is wrapped in React `cache()` and sits on top of the
 * two loaders, which have their own cross-request memos.
 */
export type CatalogView =
	| { readonly ready: true; readonly tree: CatalogTree; readonly status: CatalogContentStatus }
	| { readonly ready: false; readonly reason: string; readonly status: CatalogContentStatus };

export const loadCatalogView = cache(async function loadCatalogView(): Promise<CatalogView> {
	const [content, fitment] = await Promise.all([loadCatalogContent(), loadFitmentDataset()]);

	if (!content.snapshot) {
		return {
			ready: false,
			reason: content.status.unavailableReason ?? "no content snapshot",
			status: content.status,
		};
	}

	// A missing fitment dataset is NOT fatal: the editorial pages still exist and are
	// still worth reading. What it costs is the tree and the offers, so the page says so
	// rather than rendering an empty listing that looks like "nothing fits".
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
 */
export function resolveVehiclePath(
	tree: CatalogTree,
	categorySlug: string,
	segments: readonly string[],
): CatalogNode | null {
	if (segments.length === 0 || segments.length > 3) return null;
	return tree.byUrlPath.get(vehiclePathFromSegments(categorySlug, segments)) ?? null;
}
