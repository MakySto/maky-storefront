import "server-only";

import { cache } from "react";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { type CatalogContentStatus, loadCatalogContent } from "./snapshot";
import { type CatalogNode, type CatalogTree, buildCatalogTree } from "./tree";

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

	// A missing fitment dataset is NOT fatal: the editorial pages still exist and are
	// still worth reading. What it costs is the tree and the offers, so the page says so
	// rather than rendering an empty listing that looks like "nothing fits".
	return { ready: true, tree: buildCatalogTree(content.snapshot, fitment.dataset), status: content.status };
});

/**
 * Which catalogue language a market reads.
 *
 * The market's own locale, cut to its language: `sk` reads `sk-SK` → `sk`, `at` reads
 * `de-AT` → `de`, `cz` reads `cs-CZ` → `cs`. Two markets sharing a language share an
 * artifact, which is why `us` and `ca` both read `en` — CFM publishes one English text,
 * not one per country.
 *
 * Returns `null` for a market nobody has mapped, and the caller then serves no pages.
 * Guessing would be worse: it is the difference between "this market has no catalogue"
 * and "this market has someone else's".
 */
export function catalogLanguageForMarket(market: string): string | null {
	const locale = CHANNEL_MAP[market]?.locale;
	if (!locale) return null;
	return locale.split("-")[0]?.toLowerCase() || null;
}

/** Same, from the Saleor channel (`sk-eur`) rather than the market segment (`sk`). */
export function catalogLanguageForChannel(channel: string): string | null {
	return catalogLanguageForMarket(REVERSE_MAP[channel] ?? channel);
}

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
 * ⚠️ Measured 2026-09-12 across all ten artifacts: `urlPath` and `slug` are BYTE-IDENTICAL
 * in every language — only the prose is translated. So a German market serves German text
 * at the Slovak path `/de/stresne-nosice/bmw`. That is fine for a preview market and is a
 * real question before German is made live; it is CFM's to answer, not something to paper
 * over here by inventing slugs the snapshot does not contain.
 */
export function resolveVehiclePath(
	tree: CatalogTree,
	categorySlug: string,
	segments: readonly string[],
): CatalogNode | null {
	if (segments.length === 0 || segments.length > 3) return null;
	return tree.byUrlPath.get(vehiclePathFromSegments(categorySlug, segments)) ?? null;
}
