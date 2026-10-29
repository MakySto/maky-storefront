import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/config/locale";
import { quoteInsteadOfPrice } from "@/config/quote-only";
import { type FitmentOffer } from "@/lib/fitment/offers";
import type { SetTitle } from "@/lib/fitment/set-title";
import {
	ACTION_ROW,
	CARD,
	FACTS_COLUMN,
	MEDIA_BOX,
	MEDIA_COLUMN,
	PRIMARY_LINK,
	PRICE_ROW,
	SPECS_BLOCK,
	TITLE,
} from "@/ui/components/listing/card-layout";
import { setKicker } from "@/ui/components/listing/kicker";
import { ListingMedia } from "@/ui/components/listing/listing-media";
import { ListingSpecs, type ListingSpec } from "@/ui/components/listing/listing-specs";
import { ListingAddToCart } from "@/ui/components/plp/listing-add-to-cart";
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
	/** "Vyžiadať ponuku": in place of a price the market does not show (`config/quote-only.ts`). */
	requestQuote: string;
	availability: { inStock: string; onOrder: string; outOfStock: string; notPurchasable: string };
};

/**
 * One set on a vehicle page: its photograph, maker, name, the roof and years it is made for, the
 * parameters that tell it from its neighbours, the price and what the catalogue says about
 * availability, and one clear way on — to the set's own page.
 *
 * This page lists a whole generation and no car has been matched to anyone, so the card says what
 * the SET is for and never that it fits: no green promise, no "compatible" on a card.
 *
 * The action is the category card's own one-click add (`ListingAddToCart`) where nothing is left
 * to choose — the page names one roof, so the set printed on the card is the set for that roof —
 * and the set is orderable. Where the page mixes roofs the shopper still has to say which one
 * theirs is, so the same green button opens the set's page instead. The garage plays no part in
 * either: an empty one does not stop an unambiguous set from being bought.
 */
export function OfferCard({
	offer,
	href,
	fit,
	specs,
	includes,
	complete,
	title,
	labels,
	locale,
	priority = false,
	directAdd = null,
}: {
	offer: FitmentOffer;
	href: string;
	/** The roof and the years from the set's own application; null when there is not exactly one. */
	fit: { roof: string | null; years: string } | null;
	specs: readonly ListingSpec[];
	/** What CFM documents the set to contain, in words; null when it does not say. */
	includes: string | null;
	complete: boolean;
	/** The name taken apart (product, car), when it can be; null prints the name whole. */
	title?: SetTitle | null;
	labels: OfferCardLabels;
	locale: string;
	priority?: boolean;
	/** The market to add in, when this card may add to the cart itself; null opens the set's page. */
	directAdd?: { channel: string } | null;
}) {
	// A set this market does not sell, in a category that asks for a quote instead of a price: no price,
	// and the card is the link to the product page, which carries the button.
	const quoteOnly = quoteInsteadOfPrice({
		isPurchasable: offer.isPurchasable,
		categorySlug: offer.categorySlug,
	});
	const availability = quoteOnly
		? null
		: !offer.isPurchasable
			? { text: labels.availability.notPurchasable, tone: "text-text-secondary" }
			: offer.availability === "in-stock"
				? { text: labels.availability.inStock, tone: "text-status-success" }
				: offer.availability === "on-demand"
					? { text: labels.availability.onOrder, tone: "text-status-info" }
					: offer.availability === "out-of-stock"
						? { text: labels.availability.outOfStock, tone: "text-text-secondary" }
						: null;

	// Orderable now: published and sold in this market, a variant to put in the cart, not a demo set,
	// and not sold out.
	const canAddDirectly =
		offer.isPurchasable === true &&
		!offer.isDemo &&
		Boolean(offer.saleorVariantId) &&
		offer.availability !== "out-of-stock";

	// The maker and the shelf, on a phone only: there the line sits right under the photograph and
	// says who made the set. From `sm` the model name already begins with the maker, and the line
	// would say "Nordrive" twice in a card that is meant to say everything once.
	const kicker = setKicker(offer.brand, offer.categoryName);

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
				{kicker.brand || kicker.category ? (
					<p
						className="text-text-tertiary line-clamp-1 text-xs leading-snug sm:hidden"
						data-testid="offer-kicker"
					>
						{kicker.brand ? (
							<span className="text-text-secondary font-semibold tracking-wider uppercase">
								{kicker.brand}
							</span>
						) : null}
						{kicker.brand && kicker.category ? <span aria-hidden="true"> · </span> : null}
						{kicker.category}
					</p>
				) : null}
				{/* A set's model name is one short line: no second line is held back for it (the category card keeps one, its names vary). */}
				<h3 className={cn(TITLE, "sm:mt-0 sm:min-h-0", kicker.brand || kicker.category ? "" : "mt-0")}>
					<Link
						href={href}
						className="text-text-primary decoration-brand/40 underline-offset-[3px] hover:underline focus-visible:outline-hidden"
					>
						<span className="absolute inset-0" aria-hidden="true" />
						{title ? title.model : offer.name}
					</Link>
				</h3>
				{title && fit ? (
					// The car and the years on one line, the roof under it: said once, where the long name
					// used to say them and the line under it said them again.
					<>
						<p
							className="text-text-secondary mt-1 line-clamp-2 text-[0.8125rem] leading-snug"
							data-testid="offer-vehicle"
						>
							{title.vehicle}
							<span aria-hidden="true"> · </span>
							{fit.years}
						</p>
						{fit.roof ? (
							<p
								className="text-text-primary mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug font-medium"
								data-testid="offer-roof"
							>
								{fit.roof}
							</p>
						) : null}
					</>
				) : fit ? (
					<p
						className="text-text-secondary mt-1 line-clamp-2 text-[0.8125rem] leading-snug"
						data-testid="offer-fit"
					>
						{fit.roof ? `${labels.roof(fit.roof)} · ` : ""}
						{labels.years(fit.years)}
					</p>
				) : null}
			</div>

			<div className={SPECS_BLOCK}>
				<ListingSpecs specs={specs} className="border-border-subtle border-t pt-2.5" />
				{includes ? (
					<p
						className="text-text-secondary mt-2 line-clamp-2 text-[0.8125rem] leading-snug"
						data-testid="offer-includes"
					>
						{includes}
					</p>
				) : null}
			</div>

			<div className={PRICE_ROW}>
				{quoteOnly ? (
					<span className="text-text-primary text-base leading-tight font-semibold">
						{labels.requestQuote}
					</span>
				) : offer.price ? (
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
				{canAddDirectly && directAdd ? (
					<ListingAddToCart channel={directAdd.channel} variantId={offer.saleorVariantId} />
				) : (
					<Link href={href} className={PRIMARY_LINK}>
						{labels.viewSet}
					</Link>
				)}
			</div>
		</li>
	);
}
