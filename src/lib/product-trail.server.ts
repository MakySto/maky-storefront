import "server-only";

import { getTranslations } from "next-intl/server";

import { baseSlugForCategoryId, categoryUrlFor } from "@/config/category-routes";
import { getLocaleFromChannel } from "@/config/locale";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { catalogLanguageForChannel } from "@/lib/catalog-content/language";
import { loadCatalogView } from "@/lib/catalog-content/resolve";
import {
	type TrailStep,
	commonVehicleNode,
	vehiclePageAddress,
	vehiclePageLinkable,
	vehicleTrailSteps,
} from "@/lib/catalog-content/vehicle-trail";
import { manufacturerOf } from "@/lib/fitment/offers";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { isSourceLocale } from "@/lib/saleor/exact-locale";
import { withinDeadline } from "@/ui/components/fitment/within-deadline";
import { type TrailCategory, categoryTrail, shortProductName, vehiclesOfProduct } from "./product-trail";

/** The vehicle half asks the catalogue release; the breadcrumb must never be what a product page waits for. */
const VEHICLE_TRAIL_WAIT_MS = 1_500;

/** The shelf the whole vehicle tree hangs under. */
const ROOF_RACKS_SLUG = "stresne-nosice";

type TrailProduct = {
	name: string;
	category?: TrailCategory | null;
	attributes?: Parameters<typeof manufacturerOf>[0];
	id: string;
};

/**
 * The breadcrumb of a product page, the same for every visitor and for every crawler.
 *
 * - A product documented for a vehicle goes through it, from the shelf of roof racks down to the page
 *   that lists its sets: "Strešné nosiče > BMW > Rad 5 Touring > G61 (od 2024) > Nordrive Silenzio
 *   Silver". Every step opens the listing of that car, which is where the shopper came from.
 * - Anything else goes through its shelves: "Nosiče bicyklov > Na ťažné zariadenie > Thule EasyFold XT 3".
 *
 * The vehicle comes from the product's own identity in the fitment export (never from the car saved in
 * the header, never from its name or slug), and a product made for several vehicles stands under the one
 * page they share, or under its shelves when they share none.
 *
 * The trail starts at the shelf, not at "Domov": the logo leads home, and a phone has no room to spare.
 */
export async function loadProductTrail(input: {
	channel: string;
	product: TrailProduct;
}): Promise<TrailStep[]> {
	const { channel, product } = input;
	const locale = getLocaleFromChannel(channel);
	const shelves = shelvesOf(channel, locale, product);
	const brand = manufacturerOf(product.attributes ?? null);

	const vehicle = await withinDeadline(
		vehicleTrail(channel, locale, product, brand),
		VEHICLE_TRAIL_WAIT_MS,
	).catch((error: unknown) => {
		console.warn(
			`[product-trail] vehicle path left out for ${product.id}:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	});
	if (vehicle) return vehicle;

	return [...shelves, { label: shortProductName(product.name, { brand }) }];
}

function shelvesOf(channel: string, locale: string, product: TrailProduct): TrailStep[] {
	if (!product.category) return [];
	return categoryTrail(product.category, {
		sourceLocale: isSourceLocale(locale),
		// By id where the table knows it: abroad `slug` is whatever Saleor's translation says.
		hrefOf: (id, slug) => marketHref(channel, categoryUrlFor(channel, baseSlugForCategoryId(id) ?? slug)),
	});
}

async function vehicleTrail(
	channel: string,
	locale: string,
	product: TrailProduct,
	brand: string | null,
): Promise<TrailStep[] | null> {
	const language = catalogLanguageForChannel(channel);
	if (!language) return null;

	const { dataset } = await loadFitmentDataset();
	const generationIds = vehiclesOfProduct(dataset, product.id);
	if (generationIds.length === 0) return null;

	const view = await loadCatalogView(language, REVERSE_MAP[channel] ?? channel);
	if (!view.ready) return null;
	const node = commonVehicleNode(view.tree, generationIds);
	if (!node) return null;

	const [tNav, tFitment] = await Promise.all([
		getTranslations({ locale, namespace: "nav" }),
		getTranslations({ locale, namespace: "fitment" }),
	]);
	const steps = vehicleTrailSteps(view.tree, node, {
		hrefOf: (step) => vehiclePageAddress(channel, step),
		linkable: (step) => vehiclePageLinkable(channel, step),
		years: (from, to) =>
			to === null ? tFitment("yearFromOnly", { from }) : tFitment("yearRange", { from, to }),
		linkLast: true,
	});

	return [
		{ label: tNav("roofRacks"), href: marketHref(channel, categoryUrlFor(channel, ROOF_RACKS_SLUG)) },
		...steps,
		{ label: shortProductName(product.name, { brand, dataset, generationIds, language }) },
	];
}
