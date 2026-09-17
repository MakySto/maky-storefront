"use client";

import { useTranslations } from "next-intl";
import { buildCheckoutPath } from "@/session-bridge";

type Props = {
	disabled?: boolean;
	checkoutId?: string;
	className?: string;
};

export const CheckoutLink = ({ disabled, checkoutId, className = "" }: Props) => {
	const t = useTranslations("cart");

	return (
		<a
			data-testid="CheckoutLink"
			aria-disabled={disabled}
			onClick={(e) => disabled && e.preventDefault()}
			href={checkoutId ? buildCheckoutPath({ checkoutId }) : "/checkout"}
			className={`bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 max-w-full items-center justify-center rounded-md px-6 py-3 text-center font-semibold transition-colors aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${className}`}
		>
			{t("checkout")}
		</a>
	);
};
