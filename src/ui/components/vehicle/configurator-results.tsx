"use client";

/**
 * The configurator's result cards.
 *
 * Everything shown here — price, availability, set contents, properties — comes from the
 * server payload. Nothing is computed in the browser, and the add-to-cart action
 * re-verifies the variant server-side before it touches the cart, so a card that has
 * gone stale in an open tab produces an error rather than a bad cart line.
 *
 * Missing properties are omitted rather than filled with a placeholder: an invented
 * "75 kg" is worse than a blank, because a roof load limit is a safety number.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { formatPrice } from "@/config/locale";
import { addConfiguredSetToCart } from "@/lib/fitment/cart-actions";
import { type FitmentOffer } from "@/lib/fitment/offers";

const INCLUDES_KEY: Record<string, string> = {
	bars: "includesBars",
	feet: "includesFeet",
	"fitting-kit": "includesFittingKit",
};

export function ConfiguratorResults({
	channel,
	locale,
	offers,
}: {
	channel: string;
	locale: string;
	offers: FitmentOffer[];
}) {
	const t = useTranslations("configurator");
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [errorId, setErrorId] = useState<string | null>(null);

	const add = (offer: FitmentOffer) => {
		setBusyId(offer.saleorVariantId);
		setErrorId(null);
		startTransition(async () => {
			const result = await addConfiguredSetToCart({
				channel,
				saleorProductId: offer.saleorProductId,
				saleorVariantId: offer.saleorVariantId,
			});
			setBusyId(null);
			if (!result.ok) {
				setErrorId(offer.saleorVariantId);
				return;
			}
			router.refresh();
		});
	};

	return (
		<ul className="grid gap-4 sm:grid-cols-2">
			{offers.map((offer) => {
				const outOfStock = offer.quantityAvailable !== null && offer.quantityAvailable < 1;
				return (
					<li
						key={offer.saleorVariantId}
						className="border-border-default flex flex-col overflow-hidden rounded-lg border"
					>
						{offer.thumbnailUrl && (
							<div className="bg-surface-muted relative aspect-4/3">
								<Image
									src={offer.thumbnailUrl}
									alt={offer.thumbnailAlt ?? offer.name}
									fill
									sizes="(min-width: 640px) 20rem, 100vw"
									className="object-contain"
								/>
							</div>
						)}

						<div className="flex flex-1 flex-col gap-3 p-4">
							<div>
								{offer.completeSetIncludes && (
									<span className="bg-fitment-fits-bg text-fitment-fits inline-block rounded px-2 py-0.5 text-xs font-medium">
										{t("completeSet")}
									</span>
								)}
								<h3 className="text-text-primary mt-1 text-sm font-semibold">{offer.name}</h3>
								{offer.categoryName && <p className="text-text-tertiary text-xs">{offer.categoryName}</p>}
							</div>

							{offer.completeSetIncludes && offer.completeSetIncludes.length > 0 && (
								<p className="text-text-secondary text-sm">
									<span className="font-medium">{t("setIncludes")}: </span>
									{offer.completeSetIncludes
										.map((part) => (INCLUDES_KEY[part] ? t(INCLUDES_KEY[part]) : null))
										.filter(Boolean)
										.join(", ")}
								</p>
							)}

							<Properties facets={offer.facets} />

							<div className="mt-auto space-y-2">
								{offer.price && (
									<p className="text-text-primary text-lg font-bold">
										{formatPrice(offer.price.amount, offer.price.currency, locale)}
									</p>
								)}

								{errorId === offer.saleorVariantId && (
									<p role="alert" className="text-fitment-no-fit text-sm">
										{t("outOfStock")}
									</p>
								)}

								<div className="flex flex-wrap gap-2">
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
										{outOfStock ? t("outOfStock") : t("addToCart")}
									</Button>
									<LinkWithChannel
										href={`/${offer.slug}`}
										className="border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition-colors"
									>
										{t("viewProduct")}
									</LinkWithChannel>
								</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * Known facet VALUES are translated, not printed raw.
 *
 * The provider supplies stable codes; "aluminium" and "square" are English on a Slovak
 * page, which reads as an unfinished translation rather than as data. A code we do not
 * recognise is still shown as supplied — dropping it would hide a real product property
 * — but naming it is the provider's job.
 */
const FACET_VALUE_KEY: Record<string, string> = {
	aero: "facetAero",
	square: "facetSquare",
	aluminium: "facetAluminium",
	steel: "facetSteel",
};

/** Only properties the data actually carries. Nothing is inferred or defaulted. */
function Properties({ facets }: { facets: Record<string, string | number | boolean> | null }) {
	const t = useTranslations("configurator");
	if (!facets) return null;

	const facetLabel = (raw: string) => (FACET_VALUE_KEY[raw] ? t(FACET_VALUE_KEY[raw]) : raw);

	const rows: { label: string; value: string }[] = [];
	if (typeof facets.barShape === "string")
		rows.push({ label: t("propertyBarShape"), value: facetLabel(facets.barShape) });
	if (typeof facets.barMaterial === "string")
		rows.push({ label: t("propertyBarMaterial"), value: facetLabel(facets.barMaterial) });
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
