import "server-only";

import { getTranslations } from "next-intl/server";

import { KARGO_CATEGORY_SLUGS } from "@/config/kargo-slugs";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import type { ProductCardData } from "@/ui/components/plp/product-card";
import { isFitmentRefSellable, type FitmentCondition, type FitmentDataset } from "./contract";
import { pickConditionText } from "./conditions";
import { describeOfferFit, productFitIndex } from "./offer-fit";
import type { ListingSpec } from "@/ui/components/listing/listing-specs";
import { describeIncludes, offerSpecs, withNameSize, type NameSizeLabels } from "./offer-specs";
import { loadFitmentDataset } from "./provider";
import { isDatasetStale } from "./resolve";
import { productSetFacts } from "./set-facts";
import { datasetMakeNames, splitSetTitle } from "./set-title";
import { setVehicleOf, type SetVehicle } from "./set-vehicle";

/** The condition a van's application carries for the version it is made for ("dĺžka L4, vysoká strecha"). */
const VAN_VERSION = "van-version";

type VersionRows = { applications: number; versions: FitmentCondition[] };

const VERSIONS = new WeakMap<FitmentDataset, ReadonlyMap<string, VersionRows>>();

/** Per product: how many positive applications speak for it, and the version condition each one carries. */
function versionIndex(dataset: FitmentDataset): ReadonlyMap<string, VersionRows> {
	let index = VERSIONS.get(dataset);
	if (!index) {
		const built = new Map<string, VersionRows>();
		for (const application of dataset.applications) {
			if (application.negative) continue;
			const versions = application.conditions.filter((condition) => condition.code === VAN_VERSION);
			for (const ref of application.products) {
				if (!isFitmentRefSellable(ref)) continue;
				const rows = built.get(ref.saleorProductId) ?? { applications: 0, versions: [] };
				rows.applications += 1;
				rows.versions.push(...versions);
				built.set(ref.saleorProductId, rows);
			}
		}
		index = built;
		VERSIONS.set(dataset, index);
	}
	return index;
}

/**
 * The version of a van the set is made for, in the source's own words for this market, or null.
 *
 * Said only where every application that speaks for the set carries exactly one version condition and the
 * conditions read the same: a set made for both a short and a long van (two applications, two versions) says
 * nothing here, and the product page, where the shopper's own vehicle decides, says which. A condition the
 * source has no text of for this market's language is not said, and never put in another language's words.
 */
function versionNoteOf(rows: VersionRows | undefined, locale: string): string | null {
	if (!rows || rows.applications === 0 || rows.versions.length !== rows.applications) return null;
	const texts = new Set(rows.versions.map((condition) => pickConditionText(condition.text, locale)));
	const [text] = [...texts];
	return texts.size === 1 && text ? text : null;
}

/** A card of the Nordrive Kargo category, whether or not the dataset has a row for its product. */
const isKargoCard = (card: ProductCardData) =>
	card.category ? KARGO_CATEGORY_SLUGS.includes(card.category.slug) : false;

/**
 * The rows a card has once its name's own size is added in front, or null when the name adds none.
 * A basket's size is in its name and nowhere else the card reads: the dataset carries no facets for it, and
 * taking the name apart for a set drops it with the rest of the tail.
 */
function sizedRows(held: readonly ListingSpec[], name: string, labels: NameSizeLabels): ListingSpec[] | null {
	const sized = withNameSize(held, name, labels);
	return sized.length > held.length || sized[0] !== held[0] ? sized : null;
}

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
	if (!dataset || isDatasetStale(dataset, now)) {
		// The name's size needs no export: a Kargo card still says it, a card of any other shelf stays as it was.
		if (!cards.some(isKargoCard)) return [...cards];
		const tNames = await getTranslations({ locale, namespace: "listing" });
		const names = { dimensions: tNames("specDimensions"), bars: tNames("specBars") };
		return cards.map((card) => {
			const specs = isKargoCard(card) ? sizedRows(card.specs ?? [], card.name, names) : null;
			return specs ? { ...card, specs } : card;
		});
	}
	const language = locale.split("-")[0]?.toLowerCase() || null;

	const fitIndex = productFitIndex(dataset);
	const factsIndex = productSetFacts(dataset);
	const makes = datasetMakeNames(dataset);
	const versions = versionIndex(dataset);
	const [tFit, tSpecs, tListing] = await Promise.all([
		getTranslations({ locale, namespace: "fitment" }),
		getTranslations({ locale, namespace: "configurator" }),
		getTranslations({ locale, namespace: "listing" }),
	]);

	return cards.map((card) => {
		const fits = fitIndex.get(card.id);
		const fit = describeOfferFit(fits, tFit, ROOF_LABEL_KEY);
		const facts = factsIndex.get(card.id);
		const specs: ListingSpec[] = facts ? offerSpecs(facts.facets, tSpecs) : [];
		const includes = facts ? describeIncludes(facts.includes, tSpecs) : null;
		const versionNote = fit ? versionNoteOf(versions.get(card.id), locale) : null;
		// The car and the years are said once, under a short name, only for a set whose roof and years
		// come from its own application — those lines are what replaces the long name's tail.
		const vehicles = (fits?.[0]?.generationIds ?? [])
			.map((generationId) => setVehicleOf(dataset, generationId, language))
			.filter((vehicle): vehicle is SetVehicle => vehicle !== null);
		const setTitle = fit ? splitSetTitle(card.name, { brand: card.brand, makes, vehicles }) : null;
		// A set the dataset names, and any card of the Kargo shelf, says the size its own name states, first,
		// unless the card's own attributes already give one.
		const held = specs.length > 0 ? specs : card.specs ?? [];
		const withSize =
			fit || isKargoCard(card)
				? sizedRows(held, card.name, { dimensions: tListing("specDimensions"), bars: tListing("specBars") })
				: null;
		return {
			...card,
			...(fit ? { fit } : {}),
			...(setTitle ? { setTitle } : {}),
			...(withSize ? { specs: withSize } : specs.length > 0 ? { specs } : {}),
			...(includes ? { includes } : {}),
			...(versionNote ? { versionNote } : {}),
		};
	});
}
