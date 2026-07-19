"use client";

import { ShoppingBagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart } from "./cart-context";

interface CartButtonProps {
	itemCount: number;
}

export function CartButton({ itemCount }: CartButtonProps) {
	const { openCart } = useCart();
	const t = useTranslations("cart");

	return (
		<button
			type="button"
			onClick={openCart}
			data-testid="CartNavItem"
			aria-label={t("yourCart")}
			className="hover:bg-accent hover:text-accent-foreground relative inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors"
		>
			<ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
			{itemCount > 0 && (
				<span
					// Key change remounts the element, restarting the CSS animation
					key={itemCount}
					className="animate-cart-badge-pop bg-foreground text-background absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium"
				>
					{itemCount > 9 ? t("itemCountOverflow") : itemCount}
				</span>
			)}
			<span className="sr-only">{t("items", { count: itemCount })}</span>
		</button>
	);
}
