import "server-only";

import { getTranslations } from "next-intl/server";

import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import type { ProductCardData } from "@/ui/components/plp/product-card";
import { describeOfferFit, productFitIndex } from "./offer-fit";
import { describeIncludes, offerSpecs } from "./offer-specs";
import { loadFitmentDataset } from "./provider";
import { isDatasetStale } from "./resolve";
import { productSetFacts } from "./set-facts";
import { datasetMakeNames, splitSetTitle } from "./set-title";
import { setVehicleOf, type SetVehicle } from "./set-vehicle";

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
 * the dataset is unavailable or past its date (the product page's rule): a missing export removes
 * these facts, it never invents or defaults one. The rows that may speak for a set are the product
 * page's too (accepted, sellable, positive), and where they disagree the card says nothing about the
 * point. Statements about the SET only — never "fits", with a car chosen or without one.
 */
export async function attachSetFacts(
	cards: readonly ProductCardData[],
	locale: string,
	/** Wall-clock ms, read without `Date` (a prerender error before uncached data); tests pass their own. */
	now: number = Math.round(performance.timeOrigin + performance.now()),
): Promise<ProductCardData[]> {
	if (cards.length === 0) return [...cards];
	const { dataset } = await loadFitmentDataset();
	if (!dataset || isDatasetStale(dataset, now)) return [...cards];
	const language = locale.split("-")[0]?.toLowerCase() || null;

	const fitIndex = productFitIndex(dataset);
	const factsIndex = productSetFacts(dataset);
	const makes = datasetMakeNames(dataset);
	const [tFit, tSpecs] = await Promise.all([
		getTranslations({ locale, namespace: "fitment" }),
		getTranslations({ locale, namespace: "configurator" }),
	]);

	return cards.map((card) => {
		const fits = fitIndex.get(card.id);
		const fit = describeOfferFit(fits, tFit, ROOF_LABEL_KEY);
		const facts = factsIndex.get(card.id);
		const specs = facts ? offerSpecs(facts.facets, tSpecs) : [];
		const includes = facts ? describeIncludes(facts.includes, tSpecs) : null;
		// The car and the years are said once, under a short name, only for a set whose roof and years
		// come from its own application — those lines are what replaces the long name's tail.
		const vehicles = (fits?.[0]?.generationIds ?? [])
			.map((generationId) => setVehicleOf(dataset, generationId, language))
			.filter((vehicle): vehicle is SetVehicle => vehicle !== null);
		const setTitle = fit ? splitSetTitle(card.name, { brand: card.brand, makes, vehicles }) : null;
		return {
			...card,
			...(fit ? { fit } : {}),
			...(setTitle ? { setTitle } : {}),
			...(specs.length > 0 ? { specs } : {}),
			...(includes ? { includes } : {}),
		};
	});
}
