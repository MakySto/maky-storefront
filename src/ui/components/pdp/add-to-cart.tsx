"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ShoppingCartIcon } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import { cn } from "@/lib/utils";
import { gateButtonKey, gateButtonLook, HELD_BACK_LABEL, useTyreSizeGate } from "./tyre-fit-box";

interface AddToCartProps {
	price: string;
	/** The availability line, rendered on the server (it needs the market's own labels). */
	availability?: ReactNode;
	compareAtPrice?: string | null;
	/**
	 * Saleor's price without VAT, formatted, where the page states it for information (EU markets, every product,
	 * `lib/informative-net-price.ts`). Printed under the gross price; never instead of it.
	 */
	netPrice?: string | null;
	discountPercent?: number | null;
	disabled?: boolean;
	disabledReason?: "no-selection" | "out-of-stock" | "unavailable";
	/** Saleor-capped availability ceiling; undefined when unknown. */
	maxQuantity?: number;
	/**
	 * Where "request a quote" goes (`lib/contact/quote-request`). Used when the product cannot be ordered in
	 * this market (`disabledReason` "unavailable"): the buy row, which could only ever be disabled, gives way
	 * to that one link. Without it that state shows the sentence alone.
	 */
	quoteHref?: string;
	/**
	 * The category asks for a quote INSTEAD of a price (`config/quote-only.ts`): in the unavailable state the
	 * price, its VAT line and the sentence are not shown, and the quote link stands alone. Ignored when the
	 * product can be ordered.
	 */
	quoteOnly?: boolean;
}

function AddToCartButton({
	disabled,
	disabledReason,
}: {
	disabled?: boolean;
	disabledReason?: "no-selection" | "out-of-stock";
}) {
	const { pending } = useFormStatus();
	const t = useTranslations("product");
	const tCommon = useTranslations("common");
	const tTyre = useTranslations("tyreSize");
	// A snow chain or sock is added with the tyre size the customer told the shop. Until that choice is complete the
	// button says what is missing (no size, a size that does not fit, a condition to confirm) and takes them to it
	// instead of submitting a form the server would refuse.
	const gate = useTyreSizeGate();
	const holdBack = !disabled && gate !== null && !gate.complete ? gate : null;
	const look = gateButtonLook(holdBack);

	const getButtonText = () => {
		if (pending) return t("addingToCart");
		if (!disabled) return holdBack ? tTyre(gateButtonKey(holdBack)) : tCommon("addToCart");
		if (disabledReason === "out-of-stock") return tCommon("outOfStock");
		return t("selectOptions");
	};

	return (
		<Button
			type={holdBack ? "button" : "submit"}
			onClick={holdBack ? (event) => holdBack.take(event.currentTarget) : undefined}
			size="lg"
			disabled={disabled || pending}
			variant={look.variant}
			aria-disabled={look["aria-disabled"]}
			// min-w-0 + truncate, mirroring the listing card's AddButton. Without it the
			// flex item keeps its default `min-width: auto` and refuses to go below the
			// label's width, so stepper + button demanded 365px inside a 328px column on
			// a 360px phone — which is what let the whole page be panned sideways.
			className={cn(
				"h-14 min-w-0 flex-1 rounded-xs text-base font-semibold shadow-md transition-all duration-200 hover:shadow-lg",
				pending && "opacity-80",
				holdBack && "px-3 sm:px-8",
				look.className,
			)}
		>
			{/* The icon goes below sm. With the stepper beside it the button has ~190px on a
			    360px phone, and icon + "Pridať do košíka" wanted ~200 — so the label ellipsised
			    to "Pridať do…". A truncated call to action is worse than no icon. */}
			<ShoppingCartIcon
				className={cn("hidden h-5 w-5 shrink-0 transition-transform sm:inline", pending && "scale-90")}
			/>
			<span className={holdBack && !pending ? HELD_BACK_LABEL : "truncate"}>{getButtonText()}</span>
		</Button>
	);
}

export function AddToCart({
	price,
	availability,
	compareAtPrice,
	netPrice,
	discountPercent,
	disabled = false,
	disabledReason,
	maxQuantity,
	quoteHref,
	quoteOnly = false,
}: AddToCartProps) {
	const t = useTranslations("product");
	const tCart = useTranslations("cart");
	// Not orderable in this market: a different page, not a disabled one. The sentence is said once, and the
	// buy row (a stepper and a button that can only be switched off) becomes the way to ask for a quote.
	const unavailable = disabledReason === "unavailable";
	const hidePrice = unavailable && quoteOnly && Boolean(quoteHref);

	return (
		<div className="space-y-6">
			{/* Price. MAKY.STORE is VAT-registered and Saleor returns a gross
			    amount, so the displayed figure already includes VAT — label it
			    rather than leaving the customer to assume. A category that asks
			    for a quote instead (`quoteOnly`) shows neither the price nor the
			    sentence: the link below stands alone. */}
			{hidePrice ? null : (
				<div>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span className="text-price-current text-[2.25rem] leading-none font-bold tracking-[-0.03em] tabular-nums sm:text-[2.625rem]">
							{price}
						</span>
						{compareAtPrice && (
							<>
								<span className="text-text-secondary text-lg tabular-nums line-through">
									{compareAtPrice}
								</span>
								{discountPercent && (
									<span className="text-price-sale text-sm font-semibold">-{discountPercent}%</span>
								)}
							</>
						)}
					</div>
					<p className="text-text-tertiary mt-2 text-[0.8125rem]">{t("priceWithVat")}</p>
					{netPrice ? (
						<p className="text-text-secondary mt-1 text-sm tabular-nums">
							{t("priceWithoutVat", { price: netPrice })}
						</p>
					) : null}
					{availability && <div className="mt-4">{availability}</div>}
					{unavailable ? (
						<p role="status" className="text-text-secondary mt-4 text-sm">
							{tCart("addUnavailable")}
						</p>
					) : null}
				</div>
			)}

			{unavailable ? (
				quoteHref ? (
					// The one action on this page, so it is the purchase colour (`bg-primary`, the green of the buy
					// button it stands in for, CLAUDE.md §4), never the brand copper. A link, not a button: it opens
					// the contact page.
					<Link
						href={quoteHref}
						className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-14 w-full items-center justify-center rounded-xs px-8 text-base font-semibold shadow-md transition-all duration-200 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						<span className="truncate">{t("requestQuote")}</span>
					</Link>
				) : null
			) : (
				/* Buy row: quantity + CTA. The stepper writes name="quantity" into the
				   surrounding form, which both this button and the sticky bar submit. */
				<div className="flex items-stretch gap-3">
					<QuantityStepper name="quantity" max={maxQuantity} disabled={disabled} size="large" />
					<AddToCartButton disabled={disabled} disabledReason={disabledReason} />
				</div>
			)}
		</div>
	);
}
