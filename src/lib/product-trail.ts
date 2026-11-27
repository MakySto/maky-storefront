import { type FitmentDataset } from "@/lib/fitment/contract";
import { datasetMakeNames, splitSetTitle } from "@/lib/fitment/set-title";
import { setVehicleOf } from "@/lib/fitment/set-vehicle";
import { type TrailStep } from "@/lib/catalog-content/vehicle-trail";

/**
 * The pure half of a product page's breadcrumb: which vehicles it is made for, what it is called in
 * one short line, and the shelves above it. `product-trail.server.ts` loads what these read.
 */

/**
 * The vehicles (generation ids) a product is documented for: positive rows the source accepts AND
 * will sell against, the same rows the "Určené pre" box lists (`intendedVehiclesFor`), without that
 * box's freshness rule. An out-of-date export still knows which car a set was made for, and a path
 * is not a statement that it fits anybody's car.
 */
export function vehiclesOfProduct(dataset: FitmentDataset | null, saleorProductId: string): string[] {
	if (!dataset) return [];
	const ids = new Set<string>();
	for (const application of dataset.applications) {
		if (application.negative) continue;
		const ref = application.products.find((p) => p.saleorProductId === saleorProductId);
		if (ref && ref.qaStatus === "accepted" && ref.eligibility.sellable) ids.add(application.generationId);
	}
	return [...ids];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The last step of a trail: the maker and what it is called, without the product type the shelf before
 * it already names and without the car the trail has just walked through.
 *
 * - A set made for a car: "Nordrive Silenzio Silver" (the card's own split of the name, `splitSetTitle`).
 * - Another product whose name carries its maker: from the maker on ("Thule EasyFold XT 3").
 * - Anything else: the whole name, exactly as the catalogue wrote it. Never a guess.
 *
 * It is a label for a trail, not a name: the heading below says the whole one.
 */
export function shortProductName(
	name: string,
	options: {
		brand?: string | null;
		dataset?: FitmentDataset | null;
		generationIds?: readonly string[];
		language?: string | null;
	},
): string {
	const whole = name.trim();
	const dataset = options.dataset ?? null;
	if (dataset && options.generationIds && options.generationIds.length > 0) {
		const vehicles = options.generationIds
			.map((id) => setVehicleOf(dataset, id, options.language))
			.filter((vehicle): vehicle is NonNullable<typeof vehicle> => vehicle !== null);
		const split = splitSetTitle(whole, {
			brand: options.brand,
			makes: datasetMakeNames(dataset),
			vehicles,
		});
		if (split?.model) return split.model;
	}
	const brand = options.brand?.trim();
	if (brand) {
		const hit = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(brand)})(?![\\p{L}\\p{N}])`, "iu").exec(whole);
		if (hit) {
			const from = hit.index + hit[1]!.length;
			// The maker at the very start already is the short form; a maker on its own is no label.
			if (from > 0 && whole.slice(from).length > brand.length) return whole.slice(from).trim();
		}
	}
	return whole;
}

export type TrailCategory = {
	id: string;
	name: string;
	slug: string;
	translation?: { name?: string | null; slug?: string | null } | null;
	parent?: TrailCategory | null;
};

/**
 * The shelves a product stands on, outermost first, ending with its own: "Nosiče bicyklov > Na ťažné
 * zariadenie". Each in the market's words: a shelf with no translation for a foreign market is left
 * out together with everything above it, because a Slovak word in a German trail is worse than a
 * shorter one. The product's own category is already localized by the product lookup (`category`),
 * so it is taken as it comes.
 */
export function categoryTrail(
	category: TrailCategory,
	options: { sourceLocale: boolean; hrefOf: (id: string, slug: string) => string },
): TrailStep[] {
	const steps: TrailStep[] = [{ label: category.name, href: options.hrefOf(category.id, category.slug) }];
	let up = category.parent ?? null;
	// The product lookup localizes the category itself; its parents arrive raw and are read here.
	for (let depth = 0; up && depth < 4; depth += 1) {
		const label = options.sourceLocale ? up.name : up.translation?.name;
		if (!label?.trim()) break;
		steps.unshift({ label: label.trim(), href: options.hrefOf(up.id, up.slug) });
		up = up.parent ?? null;
	}
	return steps;
}
