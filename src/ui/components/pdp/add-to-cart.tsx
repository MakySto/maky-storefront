"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { QuantityStepper } from "@/ui/components/ui/quantity-stepper";
import { cn } from "@/lib/utils";

interface AddToCartProps {
	price: string;
	compareAtPrice?: string | null;
	discountPercent?: number | null;
	disabled?: boolean;
	disabledReason?: "no-selection" | "out-of-stock";
	/** Saleor-capped availability ceiling; undefined when unknown. */
	maxQuantity?: number;
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

	const getButtonText = () => {
		if (pending) return t("addingToCart");
		if (!disabled) return tCommon("addToCart");
		if (disabledReason === "out-of-stock") return tCommon("outOfStock");
		return t("selectOptions");
	};

	return (
		<Button
			type="submit"
			size="lg"
			disabled={disabled || pending}
			// min-w-0 + truncate, mirroring the listing card's AddButton. Without it the
			// flex item keeps its default `min-width: auto` and refuses to go below the
			// label's width, so stepper + button demanded 365px inside a 328px column on
			// a 360px phone — which is what let the whole page be panned sideways.
			className={cn(
				"h-11 min-w-0 flex-1 text-sm font-medium transition-all duration-200 sm:text-base",
				pending && "opacity-80",
			)}
		>
			{/* The icon goes below sm. With the stepper fixed at 130px the button had
			    186px on a 360px phone, and icon + "Pridať do košíka" wanted ~200 — so the
			    label ellipsised to "Pridať do…". A truncated call to action is worse than
			    no icon; the listing card's button already made the same trade. */}
			<ShoppingBag
				className={cn("mr-2 hidden h-5 w-5 shrink-0 transition-transform sm:inline", pending && "scale-90")}
			/>
			<span className="truncate">{getButtonText()}</span>
		</Button>
	);
}

export function AddToCart({
	price,
	compareAtPrice,
	discountPercent,
	disabled = false,
	disabledReason,
	maxQuantity,
}: AddToCartProps) {
	const t = useTranslations("product");

	return (
		<div className="space-y-4">
			{/* Price. MAKY.STORE is VAT-registered and Saleor returns a gross
			    amount, so the displayed figure already includes VAT — label it
			    rather than leaving the customer to assume. */}
			<div>
				<div className="flex items-baseline gap-3">
					<span className="text-text-primary text-3xl font-semibold tracking-tight">{price}</span>
					{compareAtPrice && (
						<>
							<span className="text-text-secondary text-lg line-through">{compareAtPrice}</span>
							{discountPercent && (
								<span className="text-price-sale text-sm font-medium">-{discountPercent}%</span>
							)}
						</>
					)}
				</div>
				<p className="text-text-tertiary mt-1 text-xs">{t("priceWithVat")}</p>
			</div>

			{/* Buy row: quantity + CTA. The stepper writes name="quantity" into the
			    surrounding form, which both this button and the sticky bar submit. */}
			<div className="flex items-stretch gap-3">
				<QuantityStepper name="quantity" max={maxQuantity} disabled={disabled} />
				<AddToCartButton disabled={disabled} disabledReason={disabledReason} />
			</div>
		</div>
	);
}
