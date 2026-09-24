import { getLocaleFromChannel } from "@/config/locale";
import { Suspense } from "react";
import { HeartIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CartNavItem } from "@/ui/components/nav/components/cart-nav-item";
import { UserMenuContainer } from "@/ui/components/nav/components/user-menu/user-menu-container";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
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

			{/* The wishlist page is not built yet (kept on purpose, owner 2026-09-22). No
			    prefetch until it is: every page view fetched /xx/wishlist and got a 404
			    (183 of them in nginx on 2026-09-22 alone). */}
			<LinkWithChannel href="/wishlist" prefetch={false} className={headerActionClass}>
				<HeartIcon className="h-5 w-5 lg:h-[1.375rem] lg:w-[1.375rem]" aria-hidden />
				<span className={headerActionLabelClass}>{t("favorites")}</span>
			</LinkWithChannel>

			<Suspense fallback={<ActionSkeleton />}>
				<CartNavItem channel={channel} />
			</Suspense>
		</div>
	);
}
