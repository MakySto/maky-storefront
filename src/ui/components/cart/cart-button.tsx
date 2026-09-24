"use client";

import { ShoppingBagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { headerActionClass } from "@/ui/components/header/header-action";
import { useCart } from "./cart-context";

interface CartButtonProps {
	itemCount: number;
}

export function CartButton({ itemCount }: CartButtonProps) {
	const { openCart } = useCart();
	const t = useTranslations("cart");
	const tNav = useTranslations("nav");

	return (
		<button
			type="button"
			onClick={openCart}
			data-testid="CartNavItem"
			aria-label={t("yourCart")}
			className={headerActionClass}
		>
			<span className="relative">
				<ShoppingBagIcon className="h-5 w-5 lg:h-[1.375rem] lg:w-[1.375rem]" aria-hidden="true" />
				{itemCount > 0 && (
					<span
						// Key change remounts the element, restarting the CSS animation
						key={itemCount}
						className="animate-cart-badge-pop bg-brand text-brand-text ring-surface-card absolute -top-1.5 -right-2 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold tabular-nums ring-2"
					>
						{itemCount > 9 ? t("itemCountOverflow") : itemCount}
					</span>
				)}
			</span>
			<span
				aria-hidden="true"
				className="hidden lg:block lg:text-xs lg:leading-none lg:font-medium lg:whitespace-nowrap"
			>
				{tNav("cart")}
			</span>
			<span className="sr-only">{t("items", { count: itemCount })}</span>
		</button>
	);
}
