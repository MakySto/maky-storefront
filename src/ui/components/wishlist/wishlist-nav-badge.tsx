"use client";

import { useTranslations } from "next-intl";
import { useWishlist } from "@/lib/wishlist/store";

/**
 * How many favourites this browser holds, as the header heart's badge — the cart's badge, in
 * the same brown. Nothing on the server or while the list is empty, so the header never moves.
 */
export function WishlistNavBadge() {
	const t = useTranslations("wishlist");
	const count = useWishlist().length;
	if (count === 0) return null;
	return (
		<>
			<span
				aria-hidden="true"
				className="bg-brand text-brand-text ring-surface-card absolute -top-1.5 -right-2 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold tabular-nums ring-2"
			>
				{count > 9 ? "9+" : count}
			</span>
			<span className="sr-only">{t("count", { count })}</span>
		</>
	);
}
