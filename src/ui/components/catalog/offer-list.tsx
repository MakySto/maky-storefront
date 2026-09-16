import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, formatPrice } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { type FitmentOffers } from "@/lib/fitment/offers";

/**
 * A set's price, in the market's own format — except in Slovakia, where it stays exactly
 * what the live page has shown since the vehicle pages launched (`72.00 EUR`).
 *
 * The Slovak string is kept on purpose, not by oversight: the COMMERCE-2 brief forbids
 * changing live Slovak copy as a side effect of localizing the other eleven markets, and
 * `formatPrice` would turn it into `72,00 €`. Whether Slovakia should match the PDP is a
 * decision for its own change. Elsewhere `toFixed` printed `1234.00 HUF`, which is not how
 * any of those markets writes a price.
 */
export function formatOfferPrice(amount: number, currency: string, locale: string): string {
	if (locale === DEFAULT_LOCALE) return `${amount.toFixed(2)} ${currency}`;
	return formatPrice(amount, currency, locale);
}

/**
 * The products a generation page offers.
 *
 * Three outcomes are kept apart, because collapsing them is how a shop tells a customer
 * something untrue:
 *
 *   offers          products verified for this vehicle and buyable in this channel
 *   nothing yet     rows exist but none is a verified, purchasable set — NOT "nothing fits"
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
}: {
	offers: FitmentOffers;
	channel: string;
	locale: string;
}) {
	const t = await getTranslations({ locale });

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
					{t("catalog.noVerifiedSet")}{" "}
					{offers.compatibleCount > 0
						? t("catalog.noVerifiedSetUnverified")
						: t("catalog.noVerifiedSetAskUs")}
				</p>
			</section>
		);
	}

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

			<ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
				{offers.offers.map((offer) => (
					<li key={offer.saleorVariantId}>
						<Link
							href={offer.slug ? marketHref(channel, `/${offer.slug}`) : marketHref(channel)}
							className="border-border-default hover:border-action-primary bg-surface-primary flex h-full flex-col rounded-lg border p-4 transition-colors"
						>
							<span className="text-text-primary font-medium break-words">{offer.name}</span>
							{offer.price ? (
								<span className="text-price-regular mt-2 font-semibold">
									{formatOfferPrice(offer.price.amount, offer.price.currency, locale)}
								</span>
							) : null}
							<span className="text-text-tertiary mt-1 text-sm">
								{offer.availability === "on-demand" ? t("common.onOrder") : null}
								{offer.availability === "out-of-stock" ? t("configurator.outOfStock") : null}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
