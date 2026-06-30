"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";

interface AddToCartProps {
	price: string;
	compareAtPrice?: string | null;
	discountPercent?: number | null;
	disabled?: boolean;
	disabledReason?: "no-selection" | "out-of-stock";
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
			className={cn("h-14 w-full text-base font-medium transition-all duration-200", pending && "opacity-80")}
		>
			<ShoppingBag className={cn("mr-2 h-5 w-5 transition-transform", pending && "scale-90")} />
			{getButtonText()}
		</Button>
	);
}

export function AddToCart({
	price,
	compareAtPrice,
	discountPercent,
	disabled = false,
	disabledReason,
}: AddToCartProps) {
	const t = useTranslations("product");

	return (
		<div className="space-y-4">
			{/* Price Display */}
			<div className="flex items-baseline gap-3">
				<span className="text-text-primary text-2xl font-semibold tracking-tight">{price}</span>
				{compareAtPrice && (
					<>
						<span className="text-text-secondary text-lg line-through">{compareAtPrice}</span>
						{discountPercent && (
							<span className="text-price-sale text-sm font-medium">-{discountPercent}%</span>
						)}
					</>
				)}
			</div>

			{/* Add to Cart Button */}
			<AddToCartButton disabled={disabled} disabledReason={disabledReason} />

			{/* Trust Signals */}
			<div className="text-text-secondary flex items-center justify-center gap-6 pt-2 text-xs">
				<span className="flex items-center gap-1.5">
					<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
					</svg>
					{t("secureCheckout")}
				</span>
			</div>
		</div>
	);
}
