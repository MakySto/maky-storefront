import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { ALL_CATEGORIES_NAV, localizedNavHref } from "./header.config";
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

	return (
		<div className="flex h-[3.25rem] items-center justify-between gap-4">
			<div className="flex h-full min-w-0 items-center gap-3 xl:gap-5">
				<AllCategoriesTrigger label={t("allCategories")} items={allCategories} />

				<Suspense>
					<HeaderPrimaryNav channel={channel} />
				</Suspense>
			</div>

			{/* The market and its currency moved to the footer (owner, 2026-09-24): the row keeps
			    the categories and the vehicle, as the approved header draws it. */}
			<div className="flex shrink-0 items-center gap-2">
				<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="header" />}>
					<ActiveVehicleLauncher variant="header" />
				</Suspense>
			</div>
		</div>
	);
}
