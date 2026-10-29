import { getTranslations } from "next-intl/server";
import { marketHref } from "@/lib/channel-map";
import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { ROOF_GROUP_ORDER, describeOfferFit, groupRoofOf, type OfferFit } from "@/lib/fitment/offer-fit";
import { describeIncludes, isCompleteSet, offerSpecs } from "@/lib/fitment/offer-specs";
import { type RoofType } from "@/lib/fitment/contract";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { CARD_GRID } from "@/ui/components/listing/card-layout";
import { ListingViewRoot, ListingViewToggle } from "@/ui/components/listing/listing-view";
import { OfferCard, type OfferCardLabels } from "./offer-card";

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
	vehicleName,
	title,
}: {
	offers: FitmentOffers;
	channel: string;
	locale: string;
	/** The vehicle the URL names ("Audi A6 Avant C8"): what the lead sentence says the sets are for. */
	vehicleName?: string;
	/** Replaces the default heading; a model page with one generation names the generation here. */
	title?: string;
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
		availability: {
			inStock: t("common.inStock"),
			onOrder: t("common.onOrder"),
			outOfStock: tc("outOfStock"),
			notPurchasable: t("cart.addUnavailable"),
		},
	};
	const toggleLabels = { group: tl("viewLabel"), grid: tl("viewGrid"), list: tl("viewList") };

	// Only the first card of the page asks for a preload: it is the one LCP candidate.
	const card = (offer: FitmentOffer, priority: boolean) => {
		const described = fits ? describeOfferFit(fits.get(offer.saleorProductId), tFit, ROOF_LABEL_KEY) : null;
		return (
			<OfferCard
				key={offer.saleorVariantId}
				offer={offer}
				href={offer.slug ? marketHref(channel, `/${offer.slug}`) : marketHref(channel)}
				fit={described}
				specs={offerSpecs(offer.facets, tc)}
				includes={describeIncludes(offer.completeSetIncludes, tc)}
				complete={isCompleteSet(offer.completeSetIncludes)}
				labels={labels}
				locale={locale}
				priority={priority}
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
							<h2 className="text-text-primary text-lg font-semibold">{t("configurator.resultsTitle")}</h2>
							<p className="text-text-tertiary text-sm">
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

	// With facts: grouped by roof where the page mixes several, newest window last within a group.
	type Row = { offer: FitmentOffer; roof: RoofType | null; from: number };
	const rows: Row[] = offers.offers.map((offer) => {
		const own = fits.get(offer.saleorProductId);
		return { offer, roof: groupRoofOf(own), from: own?.[0]?.yearFrom ?? 0 };
	});
	const order = (roof: RoofType | null) =>
		roof === null ? ROOF_GROUP_ORDER.length : ROOF_GROUP_ORDER.indexOf(roof);
	const groups = [...new Set(rows.map((row) => row.roof))]
		.sort((a, b) => order(a) - order(b))
		.map((roof) => ({
			roof,
			rows: rows.filter((row) => row.roof === roof).sort((a, b) => a.from - b.from),
		}));
	const grouped = groups.length > 1;

	return (
		<ListingViewRoot>
			<section className="mt-8" data-testid="catalog-offers">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 className="text-text-primary text-lg font-semibold">
							{title ??
								(vehicleName
									? t("configurator.resultsFor", { vehicle: vehicleName })
									: t("catalog.offersTitleGeneration"))}
						</h2>
						<p className="text-text-tertiary text-sm">
							{t("configurator.resultsCount", { count: offers.offers.length })}
						</p>
					</div>
					<ListingViewToggle labels={toggleLabels} />
				</div>
				<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("catalog.offersBrowseNote")}</p>

				{notices}

				{groups.map((group, groupIndex) => (
					<div key={group.roof ?? "none"} className="mt-6">
						{grouped ? (
							<h3 className="text-text-primary text-base font-semibold">
								{group.roof ? tFit(ROOF_LABEL_KEY[group.roof]) : t("catalog.offersGroupOther")}
								<span className="text-text-tertiary ml-2 text-sm font-normal">
									{t("configurator.resultsCount", { count: group.rows.length })}
								</span>
							</h3>
						) : null}
						<ul className={`${CARD_GRID} ${grouped ? "mt-3" : "mt-4"}`}>
							{group.rows.map((row, index) => card(row.offer, groupIndex === 0 && index === 0))}
						</ul>
					</div>
				))}
			</section>
		</ListingViewRoot>
	);
}
