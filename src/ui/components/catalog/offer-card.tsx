import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/config/locale";
import { type FitmentOffer } from "@/lib/fitment/offers";
import {
	ACTION_ROW,
	CARD,
	DETAIL_LINK,
	FACTS_COLUMN,
	MEDIA_BOX,
	MEDIA_COLUMN,
	PRICE_ROW,
	TITLE,
} from "@/ui/components/listing/card-layout";
import { ListingMedia } from "@/ui/components/listing/listing-media";
import { ListingSpecs, type ListingSpec } from "@/ui/components/listing/listing-specs";
import { WishlistButton } from "@/ui/components/wishlist/wishlist-button";

/**
 * Words the card needs that are not data. Passed in already translated, so the card is the same
 * component for the vehicle page (server translations) and for any future caller.
 */
export type OfferCardLabels = {
	viewSet: string;
	completeSet: string;
	noPhoto: string;
	roof: (roof: string) => string;
	years: (years: string) => string;
	price: { unavailable: string };
	availability: { inStock: string; onOrder: string; outOfStock: string; notPurchasable: string };
};

/**
 * One set on a vehicle page: its photograph, maker, name, the roof and years it is made for, the
 * parameters that tell it from its neighbours, the price and what the catalogue says about
 * availability, and one clear way on — to the set's own page.
 *
 * This page lists a whole generation and no car has been matched to anyone, so the card says what
 * the SET is for and never that it fits: no green promise, no "compatible" on a card. The detail
 * link, not a cart button, is the action — adding to the cart needs the vehicle confirmed, and
 * opening a category does not choose one.
 */
export function OfferCard({
	offer,
	href,
	fit,
	specs,
	includes,
	complete,
	labels,
	locale,
	priority = false,
}: {
	offer: FitmentOffer;
	href: string;
	/** The roof and the years from the set's own application; null when there is not exactly one. */
	fit: { roof: string | null; years: string } | null;
	specs: readonly ListingSpec[];
	/** What CFM documents the set to contain, in words; null when it does not say. */
	includes: string | null;
	complete: boolean;
	labels: OfferCardLabels;
	locale: string;
	priority?: boolean;
}) {
	const availability = !offer.isPurchasable
		? { text: labels.availability.notPurchasable, tone: "text-text-secondary" }
		: offer.availability === "in-stock"
			? { text: labels.availability.inStock, tone: "text-status-success" }
			: offer.availability === "on-demand"
				? { text: labels.availability.onOrder, tone: "text-status-info" }
				: offer.availability === "out-of-stock"
					? { text: labels.availability.outOfStock, tone: "text-text-secondary" }
					: null;

	return (
		<li
			className={cn(
				CARD,
				"has-[h3_a:focus-visible]:ring-ring has-[h3_a:focus-visible]:ring-2 has-[h3_a:focus-visible]:ring-offset-2",
			)}
			data-testid="offer-card"
		>
			<div className={MEDIA_COLUMN}>
				<Link href={href} tabIndex={-1} aria-hidden="true" className={MEDIA_BOX}>
					<ListingMedia
						src={offer.thumbnailUrl}
						alt={offer.thumbnailAlt ?? offer.name}
						hoverSrc={offer.hoverImageUrl}
						sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 340px"
						priority={priority}
						emptyLabel={labels.noPhoto}
					/>
				</Link>
				{complete ? (
					<span className="bg-fitment-fits-bg text-fitment-fits absolute top-3 left-3 rounded-xs px-2 py-0.5 text-xs font-semibold">
						{labels.completeSet}
					</span>
				) : null}
				{!offer.isDemo ? (
					<WishlistButton
						productId={offer.saleorProductId}
						productName={offer.name}
						className="absolute top-2 right-2 z-10"
					/>
				) : null}
			</div>

			<div className={FACTS_COLUMN}>
				{offer.brand || offer.categoryName ? (
					<p className="text-text-tertiary line-clamp-2 text-xs leading-snug">
						{offer.brand ? (
							<span className="text-text-secondary font-bold tracking-[0.07em] uppercase">{offer.brand}</span>
						) : null}
						{offer.brand && offer.categoryName ? <span aria-hidden="true"> · </span> : null}
						{offer.categoryName ? <span>{offer.categoryName}</span> : null}
					</p>
				) : null}
				<h3 className={TITLE}>
					<Link
						href={href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						<span className="absolute inset-0" aria-hidden="true" />
						{offer.name}
					</Link>
				</h3>
				{fit ? (
					<p
						className="text-text-secondary mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug"
						data-testid="offer-fit"
					>
						{fit.roof ? `${labels.roof(fit.roof)} · ` : ""}
						{labels.years(fit.years)}
					</p>
				) : null}
				<ListingSpecs specs={specs} className="border-border-subtle mt-3 border-t pt-3" />
				{includes ? (
					<p
						className="text-text-secondary mt-2.5 line-clamp-2 text-[0.8125rem] leading-snug"
						data-testid="offer-includes"
					>
						{includes}
					</p>
				) : null}
			</div>

			<div className={PRICE_ROW}>
				{offer.price ? (
					<span className="text-price-current text-xl leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums">
						{formatPrice(offer.price.amount, offer.price.currency, locale)}
					</span>
				) : (
					// Never another variant's price standing in for this one.
					<span className="text-text-tertiary text-sm">{labels.price.unavailable}</span>
				)}
				{availability ? (
					<span className={cn("text-xs leading-snug font-semibold whitespace-nowrap", availability.tone)}>
						{availability.text}
					</span>
				) : null}
			</div>

			<div className={ACTION_ROW}>
				<Link href={href} className={DETAIL_LINK}>
					{labels.viewSet}
				</Link>
			</div>
		</li>
	);
}
