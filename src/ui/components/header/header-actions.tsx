import { getLocaleFromChannel } from "@/config/locale";
import { Suspense } from "react";
import { HeartIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CartNavItem } from "@/ui/components/nav/components/cart-nav-item";
import { UserMenuContainer } from "@/ui/components/nav/components/user-menu/user-menu-container";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { WishlistNavBadge } from "@/ui/components/wishlist/wishlist-nav-badge";
import { headerActionClass, headerActionLabelClass } from "./header-action";

function ActionSkeleton() {
	return <div className="bg-surface-secondary h-10 w-10 animate-pulse rounded-xs lg:h-12 lg:w-16" />;
}

/**
 * Account, favourites and cart. On a desktop each is an icon with its name under it; on a
 * phone the icon alone, 40px square, named for assistive tech.
 */
export async function HeaderActions({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });

	return (
		<div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2">
			<Suspense fallback={<ActionSkeleton />}>
				<UserMenuContainer channel={channel} />
			</Suspense>

			{/* Favourites: the heart's list in this browser (`lib/wishlist`), counted like the cart.
			    No prefetch — the header is on every page and the list is read in the browser. */}
			<LinkWithChannel href="/oblubene" prefetch={false} className={headerActionClass}>
				<span className="relative">
					<HeartIcon className="h-5 w-5 lg:h-[1.375rem] lg:w-[1.375rem]" aria-hidden />
					<WishlistNavBadge />
				</span>
				<span className={headerActionLabelClass}>{t("favorites")}</span>
			</LinkWithChannel>

			<Suspense fallback={<ActionSkeleton />}>
				<CartNavItem channel={channel} />
			</Suspense>
		</div>
	);
}
