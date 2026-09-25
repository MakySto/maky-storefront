import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { ALL_CATEGORIES_NAV, HEADER_UTILITY_NAV, localizedNavHref } from "./header.config";
import { visibleNavLinks } from "@/lib/cms/availability";
import {
	ActiveVehicleLauncher,
	ActiveVehicleLauncherSkeleton,
} from "@/ui/components/vehicle/active-vehicle-launcher";

export async function HeaderNavRow({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "nav" });
	const allCategories = ALL_CATEGORIES_NAV.map((item) => ({
		key: item.key,
		href: localizedNavHref(channel, item.href),
		label: t(item.key),
	}));
	// "Značky" and "Poradňa" in the menu too: in the row they are the first to give way, and the
	// menu is where they stay at every width.
	const secondary = (await visibleNavLinks(channel, HEADER_UTILITY_NAV)).map((item) => ({
		key: item.key,
		href: localizedNavHref(channel, item.href),
		label: t(item.key),
	}));

	return (
		<div className="flex h-[3.25rem] items-center justify-between gap-4 xl:gap-6">
			{/* Takes the row's width left over by the vehicle button, and no more — the nav inside
			    measures exactly that, so nothing can run under the button. */}
			<div className="flex h-full min-w-0 flex-1 items-center gap-3 xl:gap-5">
				<AllCategoriesTrigger label={t("allCategories")} items={allCategories} links={secondary} />

				<Suspense>
					<HeaderPrimaryNav channel={channel} />
				</Suspense>
			</div>

			{/* The market and its currency moved to the footer (owner, 2026-09-24): the row keeps
			    the categories and the vehicle, as the approved header draws it. The button has one
			    fixed width from xl, and its fallback the same, so the row never re-flows when the
			    saved car streams in. */}
			<div className="flex shrink-0 items-center gap-2">
				<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="header" />}>
					<ActiveVehicleLauncher variant="header" />
				</Suspense>
			</div>
		</div>
	);
}
