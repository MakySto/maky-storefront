import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { vehicleViewQuery, type VehicleView } from "@/lib/fitment/vehicle-view";
import { OfferCard, type OfferCardLabels } from "./offer-card";
import { OfferYearSelect } from "./offer-year-select";

/**
 * What the page's address narrows the list to, and what it can be narrowed to.
 *
 * `year` is already applied by the caller: `offers` and `fits` hold the sets of that year only, so
 * the counts beside each roof are that year's. `roof` is applied here. Every control is a link to
 * `path` with other parameters: the address is the state (see `lib/fitment/vehicle-view.ts`).
 */
export type OfferListView = VehicleView & {
	/** The years with at least one set, newest first. */
	years: readonly number[];
	/** This page without parameters, market prefix included. */
	path: string;
};

/** The shop's pill, as the category chips above its listings. */
const chip = (selected: boolean) =>
	cn(
		"inline-flex h-10 items-center justify-center gap-2 rounded-xs border px-4 text-sm font-semibold whitespace-nowrap shadow-xs transition-colors",
		"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
		selected
			? "border-brand bg-brand text-brand-text"
			: "border-border-default bg-surface-card text-text-primary hover:border-brand hover:text-brand",
	);

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
	view,
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
	/**
	 * The year and the roof the address names. With it the roofs are links that narrow the list, the
	 * year can be chosen, and a set of the chosen roof adds to the cart from its card. Without it the
	 * list is every set, with nothing to narrow it by.
	 */
	view?: OfferListView;
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

	// A year with nothing in it says so, and offers the way back to every year. The sentences below
	// are about the car as a whole and would be untrue of it: other years may well have sets.
	if (offers.offers.length === 0 && view && view.year !== null) {
		return (
			<section className="mt-8" data-testid="catalog-offers">
				<h2 className="text-text-primary text-lg font-semibold">{t("configurator.resultsTitle")}</h2>
				<p className="text-text-secondary mt-3 text-sm">
					{t("catalog.viewYearEmpty", { year: view.year })}{" "}
					<Link
						href={`${view.path}${vehicleViewQuery({ year: null, roof: view.roof })}`}
						scroll={false}
						className="text-text-primary font-medium underline underline-offset-2"
					>
						{t("catalog.viewAllYears")}
					</Link>
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
	// adds to the cart itself. A page that mixes roofs sends the shopper to the set, to say which is
	// theirs, until the address names the roof: then every set shown is one made for it.
	const oneRoof = groups.length === 1 && groups[0]!.key !== "none";
	const active = view?.roof ?? null;
	const shown = active ? sorted.filter((row) => row.roofs.includes(active)) : sorted;
	const direct = oneRoof || active !== null;

	const hrefFor = (next: VehicleView) => `${view?.path ?? ""}${vehicleViewQuery(next)}`;
	// The roofs to choose from: the ones this year has sets for, and the one the address names even
	// when it has none, so the shopper sees what is chosen and can leave it.
	const roofChips = groups.filter((group) => group.key !== "none");
	if (active && !roofChips.some((group) => group.key === active)) {
		roofChips.unshift({ key: active, label: tFit(ROOF_LABEL_KEY[active]), count: 0 });
	}
	const chooseRoof = view && (groups.length > 1 || active !== null);
	const chooseYear = view && (view.years.length > 1 || view.year !== null);

	return (
		<ListingViewRoot>
			<section className="mt-8" data-testid="catalog-offers">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						{/* The page's own H1 names the car; this heading is for the outline, the toolbar shows the count. */}
						<h2 className="sr-only">{title ?? t("catalog.offersTitleGeneration")}</h2>
						<p className="text-text-primary text-sm font-medium">
							{t("configurator.resultsCount", { count: shown.length })}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						{chooseYear ? (
							<OfferYearSelect
								label={t("catalog.viewYearLabel")}
								value={view.year === null ? "" : String(view.year)}
								options={[
									{
										value: "",
										label: t("catalog.viewAllYears"),
										href: hrefFor({ year: null, roof: active }),
									},
									// A year from the address that has no set of its own stays in the list while it is chosen.
									...[...new Set([...(view.year === null ? [] : [view.year]), ...view.years])]
										.sort((a, b) => b - a)
										.map((year) => ({
											value: String(year),
											label: String(year),
											href: hrefFor({ year, roof: active }),
										})),
								]}
							/>
						) : null}
						<ListingViewToggle labels={toggleLabels} />
					</div>
				</div>
				<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("catalog.offersBrowseNote")}</p>

				{notices}

				{chooseRoof ? (
					<nav
						aria-label={tl("roofFilterLabel")}
						className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
					>
						<Link
							href={hrefFor({ year: view.year, roof: null })}
							scroll={false}
							prefetch={false}
							aria-current={active === null ? "true" : undefined}
							className={chip(active === null)}
						>
							{tl("roofFilterAll")}
							<span className="text-[0.8125rem] font-medium tabular-nums opacity-80">{sorted.length}</span>
						</Link>
						{roofChips.map((group) => (
							<Link
								key={group.key}
								href={hrefFor({ year: view.year, roof: group.key as RoofType })}
								scroll={false}
								prefetch={false}
								aria-current={active === group.key ? "true" : undefined}
								className={chip(active === group.key)}
							>
								{group.label}
								<span className="text-[0.8125rem] font-medium tabular-nums opacity-80">{group.count}</span>
							</Link>
						))}
					</nav>
				) : null}

				{shown.length > 0 ? (
					<ul className={`${CARD_GRID} mt-4`}>
						{shown.map((row, index) => card(row.offer, index === 0, direct))}
					</ul>
				) : (
					// The roof the address names has no set here (for this year). Said in those words, with
					// the other roofs and their counts one row above, never as "nothing fits your car".
					<p className="text-text-secondary mt-4 max-w-prose text-sm">
						{active && view?.year != null
							? t("catalog.viewRoofYearEmpty", { roof: tFit(ROOF_LABEL_KEY[active]), year: view.year })
							: active
								? t("catalog.viewRoofEmpty", { roof: tFit(ROOF_LABEL_KEY[active]) })
								: null}{" "}
						{t("catalog.viewEmptyHint")}{" "}
						<Link
							href={marketHref(channel, "/kontakt")}
							className="text-text-primary font-medium underline underline-offset-2"
						>
							{tFit("selector.roofMissingContact")}
						</Link>
					</p>
				)}
			</section>
		</ListingViewRoot>
	);
}
