import "server-only";

import { isCatalogPreviewEnabled, visibilityOf } from "@/lib/catalog-content/publication";
import { retiredVehiclePageHref } from "@/lib/catalog-content/retired-page";
import {
	catalogLanguageForChannel,
	loadCatalogView,
	resolveVehiclePath,
} from "@/lib/catalog-content/resolve";

/**
 * What a visitor asking for `/{market}/{category}/{make}[/{model}[/{generation}]]` will be shown, decided
 * BEFORE the status line is committed.
 *
 * ## The defect
 *
 * `categories/[slug]/[...vehicle]` calls `notFound()` for a path that names no published page, and a PPR
 * route has already flushed its shell with HTTP 200 by then — so a brand, model or generation the fitment
 * tree knows but CFM has not written a page for answered 200 with the not-found body: title "MAKY.STORE",
 * no H1, `noindex`, no canonical (measured on `/sk/stresne-nosice/volkswagen/transporter` and 242 more
 * models, 2026-11-07). Marek's rule: no empty pages. Until the page exists the address is a 404, in every
 * market — and in the markets whose catalogue has no text yet as much as any other.
 *
 * Same constraint, and the same remedy, as the retired-page and category redirects in `proxy.ts`: the
 * status can only be chosen there. The proxy asks this over loopback (`vehicle-page-preflight.ts`), so the
 * decision is made by the page's own resolution — the very functions the route calls — and not by a second
 * copy of the rules.
 *
 * `undetermined` is the answer when the catalogue itself could not be read: that is an outage, not an
 * absence, and the proxy lets the request through exactly as it did before.
 */
export type VehiclePageOutcome =
	| { readonly status: "found" }
	| { readonly status: "absent"; readonly reason: "no-language" | "no-page" | "withheld" }
	| { readonly status: "redirect"; readonly href: string }
	| { readonly status: "undetermined" };

export async function vehiclePageOutcome(
	channel: string,
	categorySlug: string,
	segments: readonly string[],
): Promise<VehiclePageOutcome> {
	const language = catalogLanguageForChannel(channel);
	// A market whose catalogue has no language has no vehicle pages at all.
	if (!language) return { status: "absent", reason: "no-language" };

	const view = await loadCatalogView(language);
	if (!view.ready) return { status: "undetermined" };

	const node = resolveVehiclePath(view.tree, categorySlug, segments);
	if (node?.page) {
		// The same two tests the page applies: published, or an explicit server-side preview.
		if (visibilityOf(node.page).visible || isCatalogPreviewEnabled()) return { status: "found" };
		return { status: "absent", reason: "withheld" };
	}

	// A page CFM merged into another keeps answering for its old link, as a redirect to the page that
	// remained (`retired-page.ts`) — now with the status it was always meant to have.
	const moved = await retiredVehiclePageHref(channel, categorySlug, segments);
	if (moved) return { status: "redirect", href: moved };

	return { status: "absent", reason: "no-page" };
}
