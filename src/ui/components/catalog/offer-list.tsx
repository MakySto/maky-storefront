import Link from "next/link";
import { marketHref } from "@/lib/channel-map";
import { type FitmentOffers } from "@/lib/fitment/offers";

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
 */
export function CatalogOfferList({ offers, channel }: { offers: FitmentOffers; channel: string }) {
	if (offers.lookupFailed && offers.offers.length === 0) {
		return (
			<section className="mt-8">
				<h2 className="text-text-primary text-lg font-semibold">Kompatibilné zostavy</h2>
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
					Ponuku sa teraz nepodarilo načítať. Skúste to prosím o chvíľu — nie je to informácia o tom, že na
					vaše vozidlo nič nepasuje.
				</p>
			</section>
		);
	}

	if (offers.offers.length === 0) {
		return (
			<section className="mt-8">
				<h2 className="text-text-primary text-lg font-semibold">Kompatibilné zostavy</h2>
				<p className="text-text-secondary mt-3 text-sm">
					Pre toto vozidlo zatiaľ nemáme overenú zostavu.{" "}
					{offers.compatibleCount > 0
						? "Nejaké záznamy existujú, ale zatiaľ nie sú overené."
						: "Neznamená to, že naň nič nepasuje — napíšte nám a overíme to."}
				</p>
			</section>
		);
	}

	return (
		<section className="mt-8">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-text-primary text-lg font-semibold">Kompatibilné zostavy</h2>
				<p className="text-text-tertiary text-sm">{offers.offers.length} zostáv</p>
			</div>

			{offers.isDemo ? (
				<p className="bg-status-warning-bg text-status-warning border-status-warning-border mt-3 rounded-md border px-3 py-2 text-sm">
					Testovacia ukážka. Ide o simulované údaje, nie o skutočnú ponuku ani o overenú kompatibilitu.
				</p>
			) : null}

			{offers.lookupFailed ? (
				<p className="text-text-tertiary mt-3 text-sm">
					Časť ponuky sa nepodarilo načítať, zoznam preto nemusí byť úplný.
				</p>
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
									{offer.price.amount.toFixed(2)} {offer.price.currency}
								</span>
							) : null}
							<span className="text-text-tertiary mt-1 text-sm">
								{offer.availability === "on-demand" ? "Na objednávku" : null}
								{offer.availability === "out-of-stock" ? "Momentálne nedostupné" : null}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
