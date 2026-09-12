import "server-only";

import { cache } from "react";
import { CHANNEL_MAP } from "@/lib/channel-map";
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

/**
 * May this market be served from the snapshot that is loaded?
 *
 * The snapshot carries exactly ONE language. CFM published nine translations on
 * 2026-09-12 and said plainly that their existence is not permission to index them:
 * that waits on a locale-aware loader, hreflang, and a per-market sitemap policy.
 *
 * So the rule is the narrow one — a market is served only when the snapshot's language
 * IS that market's language. A Slovak snapshot furnishes `sk` and nothing else; it does
 * not quietly become the German catalogue because German is live. Until the loader
 * becomes locale-aware that means Slovak only, which is the intended state.
 *
 * It lives here, beside the loader, because the sitemap and the pages must not answer
 * this differently: a sitemap advertising URLs the page declines to render is worse than
 * either behaviour on its own.
 *
 * `market` is the friendly slug (`sk`, `de`) — NOT `params.channel`, which is `sk-eur`.
 */
export function catalogServesMarket(view: CatalogView, market: string): boolean {
	if (!view.ready) return false;
	const language = CHANNEL_MAP[market]?.locale.split("-")[0];
	return Boolean(language) && view.status.language === language;
}
