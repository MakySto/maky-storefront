import "server-only";

import { getTranslations } from "next-intl/server";

import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import type { ProductCardData } from "@/ui/components/plp/product-card";
import { describeOfferFit, productFitIndex } from "./offer-fit";
import { describeIncludes, offerSpecs } from "./offer-specs";
import { loadFitmentDataset } from "./provider";
import { productSetFacts } from "./set-facts";
import { datasetMakeNames, splitSetTitle } from "./set-title";

/**
 * What a roof-rack set's listing card says about the SET, from CFM's export — the same words on the
 * category shelf, in search and anywhere else a Saleor product becomes a card.
 *
 *   fit       the roof and the years the set is made for, from its application
 *   setTitle  its name taken apart into the product and the car, when that can be done
 *   specs     load, material, bar shape, bar length (and colour when there is room)
 *   includes  what CFM documents the box to contain
 *
 * A product the dataset has no row for keeps the card exactly as it was, and so does every card when
 * the dataset is unavailable: a missing export removes these facts, it never invents or defaults one.
 * Statements about the SET only — never "fits", with a car chosen or without one.
 */
export async function attachSetFacts(
	cards: readonly ProductCardData[],
	locale: string,
): Promise<ProductCardData[]> {
	if (cards.length === 0) return [...cards];
	const { dataset } = await loadFitmentDataset();
	if (!dataset) return [...cards];

	const fitIndex = productFitIndex(dataset);
	const factsIndex = productSetFacts(dataset);
	const makes = datasetMakeNames(dataset);
	const [tFit, tSpecs] = await Promise.all([
		getTranslations({ locale, namespace: "fitment" }),
		getTranslations({ locale, namespace: "configurator" }),
	]);

	return cards.map((card) => {
		const fit = describeOfferFit(fitIndex.get(card.id), tFit, ROOF_LABEL_KEY);
		const facts = factsIndex.get(card.id);
		const specs = facts ? offerSpecs(facts.facets, tSpecs) : [];
		const includes = facts ? describeIncludes(facts.includes, tSpecs) : null;
		// The car and the years are said once, under a short name, only for a set whose roof and years
		// come from its own application — those lines are what replaces the long name's tail.
		const setTitle = fit ? splitSetTitle(card.name, { brand: card.brand, makes }) : null;
		return {
			...card,
			...(fit ? { fit } : {}),
			...(setTitle ? { setTitle } : {}),
			...(specs.length > 0 ? { specs } : {}),
			...(includes ? { includes } : {}),
		};
	});
}
