import "server-only";

import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { canonicalCatalogPath } from "./category-aliases";
import { isPubliclyVisible } from "./publication";
import { catalogRedirectTarget } from "./redirects";
import { catalogLanguageForChannel, loadCatalogView } from "./resolve";

/**
 * The public page of one vehicle (`veh:gn:…`) in this market, or `null` when the market does not
 * serve one — no catalogue language, no snapshot, no page in this language, a page held back, or
 * one CFM retired into a redirect.
 *
 * The same rules the vehicle pages apply to their own tiles and breadcrumbs
 * (`categories/[slug]/[...vehicle]/page.tsx`): joined on the vehicle id, never on a URL rebuilt
 * from names, and never a link to a page this application would refuse to render.
 */
export async function vehiclePageHref(channel: string, vehicleId: string): Promise<string | null> {
	const language = catalogLanguageForChannel(channel);
	if (!language) return null;
	const view = await loadCatalogView(language);
	if (!view.ready) return null;
	const node = view.tree.byVehicleId.get(vehicleId);
	if (!node?.page || !isPubliclyVisible(node.page)) return null;
	const market = REVERSE_MAP[channel] ?? channel;
	if (catalogRedirectTarget(market, node.urlPath)) return null;
	return marketHref(channel, canonicalCatalogPath(market, node.urlPath));
}
