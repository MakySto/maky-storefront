"use server";

import { REVERSE_MAP } from "@/lib/channel-map";
import { catalogLanguageForChannel, loadCatalogView } from "./resolve";
import { vehiclePageHref } from "./vehicle-href";

/**
 * The address of the page that lists a generation's sets in this market, or null when the market
 * has none a visitor can open.
 *
 * Asked by the vehicle selector after a car is confirmed: where there is such a page, the shopper
 * lands on it with the year and the roof in the address (`lib/fitment/vehicle-view.ts`), which is an
 * address they can save and send. Whether the market serves the page is `vehiclePageHref`'s answer,
 * the one the product page's links already rest on. One more condition is this action's own: the
 * generation has applications, because a page with nothing to list is not where a shopper who has
 * just named their car should land.
 *
 * A read that fails is null as well: where the shopper lands is a convenience, never a reason to
 * fail the confirmation they just made.
 */
export async function loadVehiclePagePath(
	channel: string | undefined,
	generationId: string,
): Promise<string | null> {
	if (!channel) return null;
	try {
		const language = catalogLanguageForChannel(channel);
		if (!language) return null;
		const view = await loadCatalogView(language, REVERSE_MAP[channel] ?? channel);
		if (!view.ready) return null;
		if ((view.tree.applicationsOf.get(generationId)?.length ?? 0) === 0) return null;
		return await vehiclePageHref(channel, generationId);
	} catch {
		return null;
	}
}
