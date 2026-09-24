"use client";

import { HeartIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { toggleWishlist, useWishlist } from "@/lib/wishlist/store";

/**
 * The heart: keeps a product in this browser's favourites (`lib/wishlist/store.ts`).
 *
 * A toggle button (`aria-pressed`), named with the product so a list of twenty hearts is not
 * twenty identical "Pridať do obľúbených". It never navigates: on a card it sits over the
 * card-wide link, so the click stops here.
 */
export function WishlistButton({
	productId,
	productName,
	className,
	size = "default",
}: {
	productId: string;
	productName: string;
	className?: string;
	/** `large` — the 48px round button beside the product page's title. */
	size?: "default" | "large";
}) {
	const t = useTranslations("wishlist");
	const saved = useWishlist().includes(productId);

	return (
		<button
			type="button"
			aria-pressed={saved}
			aria-label={saved ? t("remove", { name: productName }) : t("add", { name: productName })}
			title={saved ? t("removeShort") : t("addShort")}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				toggleWishlist(productId);
			}}
			className={cn(
				"focus-visible:ring-ring flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
				size === "large"
					? "border-border-default bg-surface-card hover:border-brand h-12 w-12 border"
					: "bg-surface-card/85 hover:bg-surface-card h-9 w-9 backdrop-blur-sm",
				saved ? "text-brand" : "text-text-secondary hover:text-brand",
				className,
			)}
		>
			<HeartIcon
				className={cn(size === "large" ? "h-[1.375rem] w-[1.375rem]" : "h-5 w-5", saved && "fill-current")}
				strokeWidth={2.25}
				aria-hidden
			/>
		</button>
	);
}
