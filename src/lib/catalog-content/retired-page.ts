import "server-only";

import { loadFitmentDataset } from "@/lib/fitment/provider";
import { successorOf } from "@/lib/fitment/retired-ids";
import { loadCatalogView, vehiclePathFromSegments, catalogLanguageForChannel } from "./resolve";
import { vehiclePageHref } from "./vehicle-href";

/**
 * Where a link to a vehicle page CFM has since merged away should land, or `null` when the path is
 * not such a page.
 *
 * CFM keeps a retired vehicle page in the content export with the id it had (`tree.orphanPages`),
 * and the dataset says what became of that id (`retired-ids.ts`). Joined on the ID — never on a
 * name or a guessed address — the old link finds the page of the generation that remained, in the
 * market and language the visitor is in; a dissolved summary label lands on its model's page, which
 * lists the generations to choose from. A successor this market would not serve (no page, held back,
 * itself a redirect) is `null` too: better the not-found a retired page always gave than a hop to a
 * page that is not there.
 */
export async function retiredVehiclePageHref(
	channel: string,
	categorySlug: string,
	segments: readonly string[],
): Promise<string | null> {
	const language = catalogLanguageForChannel(channel);
	if (!language) return null;
	const view = await loadCatalogView(language);
	if (!view.ready) return null;

	const retiredId = view.tree.orphanPages.get(vehiclePathFromSegments(categorySlug, segments));
	if (!retiredId) return null;

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;
	const successor = successorOf(dataset, retiredId);
	return successor ? vehiclePageHref(channel, successor) : null;
}
