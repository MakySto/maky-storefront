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
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { formatPrice } from "@/config/locale";
import { addConfiguredSetToCart } from "@/lib/fitment/cart-actions";
import { type AddSetFailure } from "@/lib/fitment/cart-result";
import { type FitmentOffer } from "@/lib/fitment/offers";

export type ResultCard = {
	offer: FitmentOffer;
	/** Already-translated condition texts for THIS set. */
	conditions: string[];
	/** Conditions that exist but could not be stated in this locale. */
	unresolvedConditions: number;
};

const INCLUDES_KEY: Record<string, string> = {
	bars: "includesBars",
	feet: "includesFeet",
	"fitting-kit": "includesFittingKit",
};

const FACET_VALUE_KEY: Record<string, string> = {
	aero: "facetAero",
	square: "facetSquare",
	aluminium: "facetAluminium",
	steel: "facetSteel",
};

const FAILURE_KEY: Record<AddSetFailure, string> = {
	simulation: "errorSimulation",
	"provider-unavailable": "errorProviderUnavailable",
	"vehicle-changed": "errorVehicleChanged",
	"not-verified": "errorNotVerified",
	"not-available": "errorNotAvailable",
	"out-of-stock": "__common.outOfStock",
	"catalogue-unavailable": "errorCatalogueUnavailable",
	"cart-rejected": "errorCartRejected",
	"lookup-failed": "errorLookupFailed",
	"invalid-input": "errorGeneric",
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
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [errors, setErrors] = useState<Record<string, AddSetFailure>>({});

	const add = (offer: FitmentOffer) => {
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
		<ul className="grid gap-4 sm:grid-cols-2">
			{cards.map(({ offer, conditions, unresolvedConditions }) => {
				const outOfStock = offer.availability === "out-of-stock";
				const failure = errors[offer.saleorVariantId];
				const includes = (offer.completeSetIncludes ?? [])
					.map((part) => (INCLUDES_KEY[part] ? t(INCLUDES_KEY[part]) : null))
					.filter((v): v is string => Boolean(v));

				return (
					<li
						key={offer.saleorVariantId}
						className="border-border-default flex flex-col overflow-hidden rounded-lg border"
					>
						{offer.thumbnailUrl ? (
							// Saleor 3.23 prepares media asynchronously, so a freshly imported
							// thumbnail can answer 503 for a moment. The shared component shows a
							// placeholder and retries once; a bare <Image> would leave a broken card.
							<div className="bg-surface-muted relative aspect-4/3">
								<ResilientProductImage
									src={offer.thumbnailUrl}
									alt={offer.thumbnailAlt ?? offer.name}
									fill
									sizes="(min-width: 640px) 20rem, 100vw"
									className="object-contain"
								/>
							</div>
						) : (
							// A demo set has no photograph, and it must never borrow one from a
							// real product. A neutral placeholder is the honest stand-in.
							<div className="bg-surface-muted text-text-tertiary flex aspect-4/3 items-center justify-center text-xs">
								{offer.isDemo ? t("demoPlaceholder") : null}
							</div>
						)}

						<div className="flex flex-1 flex-col gap-3 p-4">
							<div>
								<div className="flex flex-wrap items-center gap-1.5">
									{offer.completeSetIncludes && (
										<span className="bg-fitment-fits-bg text-fitment-fits inline-block rounded px-2 py-0.5 text-xs font-medium">
											{t("completeSet")}
										</span>
									)}
									{offer.isDemo && (
										<span className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed inline-block rounded px-2 py-0.5 text-xs font-medium">
											{t("demoBadge")}
										</span>
									)}
								</div>
								<h3 className="text-text-primary mt-1 text-sm font-semibold">{offer.name}</h3>
								{offer.categoryName && <p className="text-text-tertiary text-xs">{offer.categoryName}</p>}
							</div>

							{/* The fit statement belongs to THIS set, not to the page. */}
							<p
								className={
									unresolvedConditions > 0
										? "text-fitment-unconfirmed text-sm font-medium"
										: "text-fitment-fits text-sm font-medium"
								}
							>
								{unresolvedConditions > 0 ? t("cardQualifiedFit") : t("cardVerifiedFit")}
							</p>

							{includes.length > 0 && (
								<p className="text-text-secondary text-sm">
									<span className="font-medium">{t("setIncludes")}: </span>
									{includes.join(", ")}
								</p>
							)}

							<Properties facets={offer.facets} />

							{conditions.length > 0 && (
								<ul className="text-text-secondary list-disc space-y-1 pl-4 text-sm">
									{conditions.map((text) => (
										<li key={text}>{text}</li>
									))}
								</ul>
							)}

							{unresolvedConditions > 0 && (
								<p className="text-fitment-unconfirmed flex items-start gap-1.5 text-sm">
									<Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
									{t("cardConditionsIncomplete")}
								</p>
							)}

							<div className="mt-auto space-y-2">
								{offer.price ? (
									<p className="text-text-primary text-lg font-bold">
										{formatPrice(offer.price.amount, offer.price.currency, locale)}
									</p>
								) : (
									// Never another variant's price standing in for this one.
									<p className="text-text-tertiary text-sm">{t("priceUnavailable")}</p>
								)}

								{offer.availability === "on-demand" && (
									<p className="text-status-info text-sm">{tc("onDemand")}</p>
								)}

								{failure === "lookup-failed" ? (
									// Deliberately not an error, and not red: we do not know that it
									// failed, and a refusal-looking message invites a second click on a
									// mutation that is not idempotent. Same presentation as the listing's
									// cart form for the same outcome.
									<p role="status" className="text-text-secondary flex items-start gap-1.5 text-sm">
										<HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
										{t(FAILURE_KEY[failure])}
									</p>
								) : (
									failure && (
										<p role="alert" className="text-fitment-no-fit text-sm">
											{FAILURE_KEY[failure].startsWith("__common.")
												? tc(FAILURE_KEY[failure].slice("__common.".length))
												: t(FAILURE_KEY[failure])}
										</p>
									)
								)}

								<div className="flex flex-wrap gap-2">
									{offer.isDemo ? (
										<Button type="button" variant="outline-solid" disabled className="flex-1">
											{t("demoNoPurchase")}
										</Button>
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
	);
}

/** Only properties the data actually carries. Nothing is inferred or defaulted. */
function Properties({ facets }: { facets: Record<string, string | number | boolean> | null }) {
	const t = useTranslations("configurator");
	if (!facets) return null;

	const label = (raw: string) => (FACET_VALUE_KEY[raw] ? t(FACET_VALUE_KEY[raw]) : raw);

	const rows: { label: string; value: string }[] = [];
	if (typeof facets.barShape === "string")
		rows.push({ label: t("propertyBarShape"), value: label(facets.barShape) });
	if (typeof facets.barMaterial === "string")
		rows.push({ label: t("propertyBarMaterial"), value: label(facets.barMaterial) });
	// A load rating is a safety number: absent means absent, never a default.
	if (typeof facets.maxLoadKg === "number")
		rows.push({ label: t("propertyMaxLoad"), value: `${facets.maxLoadKg} kg` });
	if (typeof facets.lockable === "boolean")
		rows.push({ label: t("propertyLockable"), value: facets.lockable ? t("valueYes") : t("valueNo") });

	if (rows.length === 0) return null;

	return (
		<dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
			{rows.map((row) => (
				<div key={row.label} className="contents">
					<dt className="text-text-tertiary">{row.label}</dt>
					<dd className="text-text-primary">{row.value}</dd>
				</div>
			))}
		</dl>
	);
}
