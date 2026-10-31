import { getTranslations } from "next-intl/server";
import { marketHref } from "@/lib/channel-map";
import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { ROOF_GROUP_ORDER, describeOfferFit, roofsOf, type OfferFit } from "@/lib/fitment/offer-fit";
import { describeIncludes, isCompleteSet, offerSpecs, withAttributeSpecs } from "@/lib/fitment/offer-specs";
import { KARGO_CATEGORY_SLUGS } from "@/config/kargo-slugs";
import { withComposedLabels } from "@/ui/components/listing/listing-specs";
import { type RoofType } from "@/lib/fitment/contract";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { CARD_GRID } from "@/ui/components/listing/card-layout";
import { ListingViewRoot, ListingViewToggle } from "@/ui/components/listing/listing-view";
import { splitSetTitle } from "@/lib/fitment/set-title";
import { type SetFacts } from "@/lib/fitment/set-facts";
import { type SetVehicle } from "@/lib/fitment/set-vehicle";
import { OfferCard, type OfferCardLabels } from "./offer-card";
import { RoofFilteredList } from "./offer-roof-filter";

/**
 * The products a generation page offers.
 *
 * Three outcomes are kept apart, because collapsing them is how a shop tells a customer
 * something untrue:
 *
 *   offers          published, localized products verified for this vehicle
 *   catalog only    verified products whose purchase switch is off in this channel
 *   nothing yet     rows exist but none is a verified, localized set — NOT "nothing fits"
 *   lookup failed   Saleor did not answer, so this says so instead of showing an empty shelf
 *
 * The middle case is the common one today and the easiest to get wrong: an empty list with
 * no explanation reads as "we checked and your car has nothing", which is a claim the data
 * does not support.
 *
 * Copy comes from the `catalog` namespace, plus the configurator and common keys that
 * already said the same thing in all twelve languages. The Slovak values are the strings
 * this component used to hard-code, unchanged.
 */
export async function CatalogOfferList({
	offers,
	channel,
	locale,
	fits,
	makes,
	vehicles,
	facts,
	title,
}: {
	offers: FitmentOffers;
	channel: string;
	locale: string;
	/** Replaces the default heading. */
	title?: string;
	/**
	 * The makes the fitment export knows. With them a set's name can be shown as the product and the
	 * car on separate lines; without them the name is printed whole, as the catalogue wrote it.
	 */
	makes?: readonly string[];
	/**
	 * The car this page is about, named the way the rest of the shop names it (the dataset's names for
	 * the reading language). A set whose name says it is for that car is shown under those words.
	 */
	vehicles?: readonly SetVehicle[];
	/**
	 * What the export says about each set itself (bar shape, load, contents), keyed by Saleor product
	 * id, read by the rule the product page uses: only rows the source stands behind, and nothing where
	 * rows disagree. Replaces what the offers carry from the one row they were matched through.
	 */
	facts?: ReadonlyMap<string, SetFacts>;
	/**
	 * What each set is FOR — roof and years — from its application, keyed by Saleor product id.
	 *
	 * Passed by the generation page, which lists EVERY set of the generation: 14 on the median
	 * page and over 100 on the largest, across several roofs and several windows of years, with no
	 * car chosen. Absent, the list reads exactly as it always did. Present, each card says which
	 * roof and which years it is for, the sets are grouped by roof, and the page stops calling
	 * itself "compatible" — nothing on it has been matched to anyone's car.
	 */
	fits?: ReadonlyMap<string, readonly OfferFit[]>;
}) {
	const t = await getTranslations({ locale });
	const tf = fits ? await getTranslations({ locale, namespace: "fitment" }) : null;

	if (offers.lookupFailed && offers.offers.length === 0) {
		return (
			<section className="mt-8">
				<h2 className="text-text-primary text-lg font-semibold">{t("configurator.resultsTitle")}</h2>
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
					{t("catalog.offersLookupFailed")}
				</p>
			</section>
		);
	}

	if (offers.offers.length === 0) {
		return (
			<section className="mt-8">
				<h2 className="text-text-primary text-lg font-semibold">{t("configurator.resultsTitle")}</h2>
				<p className="text-text-secondary mt-3 text-sm">
					{offers.rejected["not-published"] > 0 && offers.purchasableCount === 0 ? (
						// Verified sets exist and the shop does not sell them (hidden, withdrawn, not
						// purchasable here). That is not "unverified" and not "nothing fits": the same
						// two sentences the configurator says for the same situation.
						<>
							{t("configurator.compatibleNotPurchasable")} {t("configurator.compatibleNotPurchasableDetail")}
						</>
					) : (
						<>
							{t("catalog.noVerifiedSet")}{" "}
							{offers.compatibleCount > 0
								? t("catalog.noVerifiedSetUnverified")
								: t("catalog.noVerifiedSetAskUs")}
						</>
					)}
				</p>
			</section>
		);
	}

	const tc = await getTranslations({ locale, namespace: "configurator" });
	const tl = await getTranslations({ locale, namespace: "listing" });
	const tFit = tf ?? (await getTranslations({ locale, namespace: "fitment" }));

	const labels: OfferCardLabels = {
		viewSet: tl("viewSet"),
		completeSet: tc("completeSet"),
		noPhoto: t("product.noImageAvailable"),
		roof: (roof) => tFit("cardRoof", { roof }),
		years: (years) => tFit("cardYears", { years }),
		price: { unavailable: tc("priceUnavailable") },
		requestQuote: t("product.requestQuote"),
		availability: {
			inStock: t("common.inStock"),
			onOrder: t("common.onOrder"),
			outOfStock: t("common.outOfStock"),
			notPurchasable: t("cart.addUnavailable"),
		},
	};
	const toggleLabels = { group: tl("viewLabel"), grid: tl("viewGrid"), list: tl("viewList") };

	// Only the first card of the page asks for a preload: it is the one LCP candidate.
	const card = (offer: FitmentOffer, priority: boolean, direct = false) => {
		const described = fits ? describeOfferFit(fits.get(offer.saleorProductId), tFit, ROOF_LABEL_KEY) : null;
		// The name is only taken apart for a set whose roof and years are known from its own
		// application: those lines replace what the long name said, so they must exist.
		const title =
			described && makes ? splitSetTitle(offer.name, { brand: offer.brand, makes, vehicles }) : null;
		const own = facts ? facts.get(offer.saleorProductId) ?? null : undefined;
		const includes = own === undefined ? offer.completeSetIncludes : own?.includes;
		const rows = offerSpecs(own === undefined ? offer.facets : own?.facets, tc);
		return (
			<OfferCard
				key={offer.saleorVariantId}
				offer={offer}
				href={offer.slug ? marketHref(channel, `/${offer.slug}`) : marketHref(channel)}
				fit={described}
				title={title}
				specs={
					offer.categorySlug && KARGO_CATEGORY_SLUGS.includes(offer.categorySlug)
						? withComposedLabels(withAttributeSpecs(rows, offer.specs ?? []), {
								dimensions: tl("specDimensions"),
								bars: tl("specBars"),
							})
						: rows
				}
				includes={describeIncludes(includes, tc)}
				complete={isCompleteSet(includes)}
				labels={labels}
				locale={locale}
				priority={priority}
				directAdd={direct && described ? { channel } : null}
			/>
		);
	};

	const notices = (
		<>
			{offers.isDemo ? (
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
					{t("catalog.offersDemo")}
				</p>
			) : null}

			{offers.lookupFailed ? (
				<p className="text-text-tertiary mt-3 text-sm">{t("catalog.offersPartial")}</p>
			) : null}
		</>
	);

	// Without facts the list is one flat run of sets.
	if (!fits) {
		return (
			<ListingViewRoot>
				<section className="mt-8">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<h2 className="sr-only">{t("configurator.resultsTitle")}</h2>
							<p className="text-text-primary text-sm font-medium">
								{t("catalog.offersCount", { count: offers.offers.length })}
							</p>
						</div>
						<ListingViewToggle labels={toggleLabels} />
					</div>
					{notices}
					<ul className={`${CARD_GRID} mt-4`}>
						{offers.offers.map((offer, index) => card(offer, index === 0))}
					</ul>
				</section>
			</ListingViewRoot>
		);
	}

	// With facts: ONE list, the roofs told apart on each card and, where the page mixes several, by
	// a filter — not by separate shelves, which left a one-card shelf standing in a field of white.
	// Within the list: the likeliest roof first, the newest window last within a roof.
	// A set made for several roofs is sorted under its likeliest roof and found under each of them.
	type Row = { offer: FitmentOffer; roofs: RoofType[]; from: number };
	const rows: Row[] = offers.offers.map((offer) => {
		const own = fits.get(offer.saleorProductId);
		return { offer, roofs: roofsOf(own), from: own?.[0]?.yearFrom ?? 0 };
	});
	const order = (row: Row) =>
		row.roofs[0] ? ROOF_GROUP_ORDER.indexOf(row.roofs[0]) : ROOF_GROUP_ORDER.length;
	const sorted = [...rows].sort((a, b) => order(a) - order(b) || a.from - b.from);
	const groups = [...ROOF_GROUP_ORDER, null]
		.map((roof) => ({
			key: roof ?? "none",
			label: roof ? tFit(ROOF_LABEL_KEY[roof]) : t("catalog.offersGroupOther"),
			count: sorted.filter((row) => (roof ? row.roofs.includes(roof) : row.roofs.length === 0)).length,
		}))
		.filter((group) => group.count > 0);

	// A page that names ONE roof leaves nothing to choose: each card is the set for that roof and
	// adds to the cart itself. A page that mixes roofs sends the shopper to the set, to say which is theirs.
	const oneRoof = groups.length === 1 && groups[0]!.key !== "none";

	return (
		<ListingViewRoot>
			<section className="mt-8" data-testid="catalog-offers">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						{/* The page's own H1 names the car; this heading is for the outline, the toolbar shows the count. */}
						<h2 className="sr-only">{title ?? t("catalog.offersTitleGeneration")}</h2>
						<p className="text-text-primary text-sm font-medium">
							{t("configurator.resultsCount", { count: offers.offers.length })}
						</p>
					</div>
					<ListingViewToggle labels={toggleLabels} />
				</div>
				<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("catalog.offersBrowseNote")}</p>

				{notices}

				{groups.length > 1 ? (
					<RoofFilteredList
						items={sorted.map((row, index) => ({
							id: row.offer.saleorVariantId,
							roofs: row.roofs.length > 0 ? row.roofs : ["none"],
							node: card(row.offer, index === 0, oneRoof),
						}))}
						groups={groups}
						labels={{ group: tl("roofFilterLabel"), all: tl("roofFilterAll") }}
					/>
				) : (
					<ul className={`${CARD_GRID} mt-4`}>
						{sorted.map((row, index) => card(row.offer, index === 0, oneRoof))}
					</ul>
				)}
			</section>
		</ListingViewRoot>
	);
}
