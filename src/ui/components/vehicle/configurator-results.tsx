"use client";

/**
 * The configurator's result cards.
 *
 * Everything here comes from the server payload, and the add-to-cart action re-verifies
 * the vehicle, the fitment and the variant server-side before touching the cart — so a
 * card that has gone stale in an open tab produces an error rather than a bad line.
 *
 * Three corrections over the first version:
 *
 *   - Mounting conditions live on the CARD, next to the set they constrain, instead of
 *     being pooled into one panel above a list of different sets.
 *   - A demo card says it is a simulation and does not offer to buy. The server refuses
 *     the mutation regardless; the UI simply stops pretending.
 *   - Failure is not all "out of stock". A rejected mutation, a changed vehicle, an
 *     unverified fit and a real stock-out are four different messages.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HelpCircle, Info, Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import {
	ACTION_ROW,
	CARD,
	CARD_GRID,
	FACTS_COLUMN,
	MEDIA_BOX,
	MEDIA_COLUMN,
	PRICE_ROW,
	TITLE,
} from "@/ui/components/listing/card-layout";
import { ListingMedia } from "@/ui/components/listing/listing-media";
import { ListingSpecs } from "@/ui/components/listing/listing-specs";
import { ListingViewRoot } from "@/ui/components/listing/listing-view";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { describeIncludes, isCompleteSet, offerSpecs } from "@/lib/fitment/offer-specs";
import { formatPrice } from "@/config/locale";
import { addConfiguredSetToCart } from "@/lib/fitment/cart-actions";
import { type AddSetFailure } from "@/lib/fitment/cart-result";
import { type FitmentOffer } from "@/lib/fitment/offers";
import { type FitmentVerdict } from "@/lib/fitment/contract";
import { fitStatementFor, presentCardFailure } from "./configurator-card-state";

export type ResultCard = {
	offer: FitmentOffer;
	/** The roof and the years of the application this set was matched through; null when it names none. */
	fit?: { roof: string | null; years: string } | null;
	/** Already-translated condition texts for THIS set. */
	conditions: string[];
	/** Conditions that exist but could not be stated in this locale. */
	unresolvedConditions: number;
	/**
	 * The verdict THIS set earned. Offerable covers two of them, and they are not the
	 * same claim: only VERIFIED_FIT may be called verified.
	 */
	verdict: FitmentVerdict;
	/** Whose application data this fit rests on, when the verdict is the manufacturer's. */
	supplier: string | null;
};

export function ConfiguratorResults({
	channel,
	locale,
	cards,
}: {
	channel: string;
	locale: string;
	cards: ResultCard[];
}) {
	const t = useTranslations("configurator");
	// Availability wording already exists in `common` and is used by the PDP badge —
	// reused rather than duplicated, so the two surfaces cannot drift apart.
	const tc = useTranslations("common");
	const tf = useTranslations("fitment");
	const tCart = useTranslations("cart");
	const tProduct = useTranslations("product");
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [errors, setErrors] = useState<Record<string, AddSetFailure>>({});

	const add = (offer: FitmentOffer) => {
		if (offer.isPurchasable !== true || offer.isDemo) return;
		setBusyId(offer.saleorVariantId);
		setErrors((current) => {
			const next = { ...current };
			delete next[offer.saleorVariantId];
			return next;
		});
		startTransition(async () => {
			try {
				const result = await addConfiguredSetToCart({
					channel,
					saleorProductId: offer.saleorProductId,
					saleorVariantId: offer.saleorVariantId,
				});
				if (!result.ok) {
					setErrors((current) => ({ ...current, [offer.saleorVariantId]: result.reason }));
					return;
				}
				router.refresh();
			} catch {
				// The call itself failed — a dropped connection, a stale deployment. The
				// request may or may not have reached the server, so this is the same
				// "we do not know" as an unconfirmed add: say so here, rather than let it
				// escape to the global error page, which invites a reload and a second click.
				setErrors((current) => ({ ...current, [offer.saleorVariantId]: "lookup-failed" }));
			} finally {
				setBusyId(null);
			}
		});
	};

	return (
		<ListingViewRoot>
			<ul className={CARD_GRID}>
				{cards.map(({ offer, fit, conditions, unresolvedConditions, verdict, supplier }, index) => {
					const outOfStock = offer.availability === "out-of-stock";
					const catalogOnly = offer.isPurchasable !== true;
					// Whose word this set's fit rests on. An unnamed supplier degrades to the
					// same fallback CompatibilityBox uses, never to silence and never to
					// "verified".
					const statement = fitStatementFor(verdict, supplier, unresolvedConditions > 0);
					const failure = presentCardFailure(errors[offer.saleorVariantId]);
					const message = failure
						? failure.messageKey.startsWith("__common.")
							? tc(failure.messageKey.slice("__common.".length))
							: t(failure.messageKey)
						: null;
					// The same four parameters and the same contents line the vehicle page and the
					// category shelf print for this set.
					const specs = offerSpecs(offer.facets, t);
					const includes = describeIncludes(offer.completeSetIncludes, t);

					return (
						<li key={offer.saleorVariantId} className={CARD} data-testid="configurator-card">
							<div className={MEDIA_COLUMN}>
								{/* Saleor 3.23 prepares media asynchronously, so a freshly imported thumbnail can
								    answer 503 for a moment. The shared image shows a placeholder and retries once;
								    a bare <Image> would leave a broken card. A demo set has no photograph, and it
								    must never borrow one from a real product. */}
								<div className={MEDIA_BOX}>
									<ListingMedia
										src={offer.thumbnailUrl}
										alt={offer.thumbnailAlt ?? offer.name}
										hoverSrc={offer.hoverImageUrl}
										sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 340px"
										priority={index === 0}
										emptyLabel={offer.isDemo ? t("demoPlaceholder") : tProduct("noImageAvailable")}
									/>
								</div>
								<div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
									{isCompleteSet(offer.completeSetIncludes) && (
										<span className="bg-fitment-fits-bg text-fitment-fits inline-block rounded-xs px-2 py-0.5 text-xs font-semibold">
											{t("completeSet")}
										</span>
									)}
									{offer.isDemo && (
										<span className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed inline-block rounded-xs px-2 py-0.5 text-xs font-semibold">
											{t("demoBadge")}
										</span>
									)}
								</div>
							</div>

							<div className={FACTS_COLUMN}>
								{(offer.brand || offer.categoryName) && (
									<p className="text-text-tertiary line-clamp-2 text-xs leading-snug">
										{offer.brand && (
											<span className="text-text-secondary font-bold tracking-[0.07em] uppercase">
												{offer.brand}
											</span>
										)}
										{offer.brand && offer.categoryName && <span aria-hidden="true"> · </span>}
										{offer.categoryName && <span>{offer.categoryName}</span>}
									</p>
								)}
								<h3 className={TITLE}>{offer.name}</h3>

								{/*
								  The fit statement belongs to THIS set, not to the page — and it must
								  say whose word it is. Both sentences here used to begin "Overené",
								  for every offerable card. Since MANUFACTURER_FIT became offerable
								  that claimed a check nobody performed: the manufacturer listing a
								  part for a car is the manufacturer's statement, not our
								  verification. Only VERIFIED_FIT earns the word.
								*/}
								<p
									className={
										unresolvedConditions > 0
											? "text-fitment-unconfirmed mt-2 text-sm font-medium"
											: "text-fitment-fits mt-2 text-sm font-medium"
									}
								>
									{statement.supplier === undefined
										? t(statement.key)
										: t(statement.key, { supplier: statement.supplier ?? tf("supplierFallback") })}
								</p>

								{fit && (
									<p
										className="text-text-secondary mt-1 text-[0.8125rem] leading-snug"
										data-testid="card-fit"
									>
										{fit.roof ? `${tf("cardRoof", { roof: fit.roof })} · ` : ""}
										{tf("cardYears", { years: fit.years })}
									</p>
								)}

								<ListingSpecs specs={specs} className="border-border-subtle mt-3 border-t pt-3" />

								{includes && (
									<p className="text-text-secondary mt-2.5 text-[0.8125rem] leading-snug">
										<span className="font-medium">{t("setIncludes")}: </span>
										{includes}
									</p>
								)}

								{conditions.length > 0 && (
									<ul className="text-text-secondary mt-2.5 list-disc space-y-1 pl-4 text-[0.8125rem]">
										{conditions.map((text) => (
											<li key={text}>{text}</li>
										))}
									</ul>
								)}

								{unresolvedConditions > 0 && (
									<p className="text-fitment-unconfirmed mt-2.5 flex items-start gap-1.5 text-sm">
										<Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
										{t("cardConditionsIncomplete")}
									</p>
								)}
							</div>

							<div className={PRICE_ROW}>
								{offer.price ? (
									<span className="text-price-current text-xl leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums">
										{formatPrice(offer.price.amount, offer.price.currency, locale)}
									</span>
								) : (
									// Never another variant's price standing in for this one.
									<span className="text-text-tertiary text-sm">{t("priceUnavailable")}</span>
								)}
								{offer.isPurchasable && offer.availability === "in-stock" && (
									<span className="text-status-success text-xs font-semibold">{tc("inStock")}</span>
								)}
								{offer.isPurchasable && offer.availability === "on-demand" && (
									<span className="text-status-info text-xs font-semibold">{tc("onDemand")}</span>
								)}
							</div>

							<div className={ACTION_ROW}>
								<div className="space-y-2">
									{failure?.tone === "status" ? (
										// Deliberately not an error, and not red: we do not know that it
										// failed, and a refusal-looking message invites a second click on a
										// mutation that is not idempotent. Same presentation as the listing's
										// cart form for the same outcome.
										<p role="status" className="text-text-secondary flex items-start gap-1.5 text-sm">
											<HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
											{message}
										</p>
									) : (
										failure && (
											<p role="alert" className="text-fitment-no-fit text-sm">
												{message}
											</p>
										)
									)}

									<div className="flex flex-wrap gap-2">
										{offer.isDemo ? (
											<Button type="button" variant="outline-solid" disabled className="flex-1">
												{t("demoNoPurchase")}
											</Button>
										) : catalogOnly ? (
											<Button type="button" variant="outline-solid" disabled className="flex-1">
												{tCart("addUnavailable")}
											</Button>
										) : failure?.primaryAction === "check-cart" ? (
											// The add may well have landed. The control now under the cursor
											// takes the shopper to look, rather than sending the same
											// non-idempotent mutation a second time. Adding again stays
											// available as a separate, differently-labelled decision made
											// AFTER looking, and no timer re-enables anything.
											<>
												<LinkWithChannel
													href="/cart"
													className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
												>
													<ShoppingCart className="h-4 w-4" aria-hidden="true" />
													{t("checkCart")}
												</LinkWithChannel>
												<Button
													type="button"
													variant="outline-solid"
													disabled={pending || outOfStock}
													onClick={() => add(offer)}
												>
													{busyId === offer.saleorVariantId && pending && (
														<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
													)}
													{t("addAgain")}
												</Button>
											</>
										) : (
											<Button
												type="button"
												disabled={pending || outOfStock}
												onClick={() => add(offer)}
												className="flex-1"
											>
												{busyId === offer.saleorVariantId && pending ? (
													<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
												) : (
													<ShoppingCart className="h-4 w-4" aria-hidden="true" />
												)}
												{outOfStock ? tc("outOfStock") : t("addToCart")}
											</Button>
										)}
										{offer.slug && (
											<LinkWithChannel
												href={`/${offer.slug}`}
												className="border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition-colors"
											>
												{t("viewProduct")}
											</LinkWithChannel>
										)}
									</div>
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		</ListingViewRoot>
	);
}
