import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatPrice } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { ROOF_GROUP_ORDER, describeOfferFit, groupRoofOf, type OfferFit } from "@/lib/fitment/offer-fit";
import { type RoofType } from "@/lib/fitment/contract";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";

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
}: {
	offers: FitmentOffers;
	channel: string;
	locale: string;
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

	const card = (offer: FitmentOffer) => {
		const described =
			tf && fits ? describeOfferFit(fits.get(offer.saleorProductId), tf, ROOF_LABEL_KEY) : null;
		return (
			<li key={offer.saleorVariantId}>
				<Link
					href={offer.slug ? marketHref(channel, `/${offer.slug}`) : marketHref(channel)}
					className="border-border-default hover:border-action-primary bg-surface-primary flex h-full flex-col rounded-lg border p-4 transition-colors"
				>
					<span className="text-text-primary font-medium break-words">{offer.name}</span>
					{described && tf ? (
						// The roof and the years the set is made for, from its application. A statement
						// about the SET: this page has no car, so nothing here says it fits one.
						<span className="text-text-secondary mt-1 text-sm" data-testid="offer-fit">
							{described.roof ? `${tf("cardRoof", { roof: described.roof })} · ` : ""}
							{tf("cardYears", { years: described.years })}
						</span>
					) : null}
					{offer.price ? (
						// The market's own format in every market, Slovakia included —
						// `147,00 €`, as on the product page. Slovakia printed
						// `147.00 EUR` here until the owner decided on 2026-09-22.
						<span className="text-price-regular mt-2 font-semibold">
							{formatPrice(offer.price.amount, offer.price.currency, locale)}
						</span>
					) : null}
					<span className="text-text-tertiary mt-1 text-sm">
						{!offer.isPurchasable
							? t("cart.addUnavailable")
							: offer.availability === "on-demand"
								? t("common.onOrder")
								: offer.availability === "out-of-stock"
									? t("configurator.outOfStock")
									: null}
					</span>
				</Link>
			</li>
		);
	};

	// Without facts the list is what it always was.
	if (!fits || !tf) {
		return (
			<section className="mt-8">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="text-text-primary text-lg font-semibold">{t("configurator.resultsTitle")}</h2>
					<p className="text-text-tertiary text-sm">
						{t("catalog.offersCount", { count: offers.offers.length })}
					</p>
				</div>

				{offers.isDemo ? (
					<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
						{t("catalog.offersDemo")}
					</p>
				) : null}

				{offers.lookupFailed ? (
					<p className="text-text-tertiary mt-3 text-sm">{t("catalog.offersPartial")}</p>
				) : null}

				<ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{offers.offers.map(card)}</ul>
			</section>
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
		<section className="mt-8" data-testid="catalog-offers">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-text-primary text-lg font-semibold">{t("catalog.offersTitleGeneration")}</h2>
				<p className="text-text-tertiary text-sm">
					{t("configurator.resultsCount", { count: offers.offers.length })}
				</p>
			</div>
			<p className="text-text-secondary mt-2 max-w-prose text-sm">{t("catalog.offersBrowseNote")}</p>

			{offers.isDemo ? (
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
					{t("catalog.offersDemo")}
				</p>
			) : null}

			{offers.lookupFailed ? (
				<p className="text-text-tertiary mt-3 text-sm">{t("catalog.offersPartial")}</p>
			) : null}

			{groups.map((group) => (
				<div key={group.roof ?? "none"} className="mt-5">
					{grouped ? (
						<h3 className="text-text-primary text-base font-semibold">
							{group.roof ? tf(ROOF_LABEL_KEY[group.roof]) : t("catalog.offersGroupOther")}
							<span className="text-text-tertiary ml-2 text-sm font-normal">
								{t("configurator.resultsCount", { count: group.rows.length })}
							</span>
						</h3>
					) : null}
					<ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${grouped ? "mt-3" : "mt-4"}`}>
						{group.rows.map((row) => card(row.offer))}
					</ul>
				</div>
			))}
		</section>
	);
}
