import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { liveMarkets } from "@/lib/market-state";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderMarketControls } from "./header-market-controls";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { ALL_CATEGORIES_NAV, localizedNavHref } from "./header.config";
import {
	ActiveVehicleLauncher,
	ActiveVehicleLauncherSkeleton,
} from "@/ui/components/vehicle/active-vehicle-launcher";

/**
 * The live set has to be read per request, not per build.
 *
 * `MAKY_LIVE_MARKETS` is the one control that promotes a market without a rebuild
 * — the proxy's noindex header, the sitemap and the existence gate all already
 * honour it at runtime. Reading it inside a prerendered shell would bake the
 * launch-day list into the static HTML and quietly make the switcher the one
 * surface that still needs a deploy. `connection()` opts this subtree out of the
 * shell; the cost is a Suspense boundary in the desktop nav row.
 */
async function LiveMarketControls() {
	await connection();
	return <HeaderMarketControls markets={liveMarkets()} />;
}

function MarketControlsSkeleton() {
	// One chip now ("SK · EUR"), the width of the widest label it shows.
	return <div className="bg-surface-secondary h-10 w-[6.75rem] animate-pulse rounded-xs" />;
}

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

			<div className="flex shrink-0 items-center gap-2">
				<Suspense fallback={<MarketControlsSkeleton />}>
					<LiveMarketControls />
				</Suspense>
				{/* Its own boundary, not the market controls': the vehicle label needs the
				    garage cookie AND the fitment dataset, so it can be the slower of the
				    two, and one fallback for both would hold the market switcher back. */}
				<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="header" />}>
					<ActiveVehicleLauncher variant="header" />
				</Suspense>
			</div>
		</div>
	);
}
