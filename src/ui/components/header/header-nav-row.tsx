import { Suspense } from "react";
import { connection } from "next/server";
import { liveMarkets } from "@/lib/market-state";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderMarketControls } from "./header-market-controls";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { VehicleSelectorTrigger } from "./vehicle-selector-trigger";

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
	return (
		<div className="flex items-center gap-1">
			<div className="bg-sand-100 h-9 w-[4.5rem] animate-pulse rounded-xs" />
			<div className="bg-sand-100 h-9 w-[5.25rem] animate-pulse rounded-xs" />
		</div>
	);
}

export async function HeaderNavRow({ channel }: { channel: string }) {
	return (
		<div className="flex h-12 items-center justify-between">
			<div className="flex items-center gap-3">
				<AllCategoriesTrigger />

				<Suspense>
					<HeaderPrimaryNav channel={channel} />
				</Suspense>
			</div>

			<div className="flex items-center gap-2">
				<Suspense fallback={<MarketControlsSkeleton />}>
					<LiveMarketControls />
				</Suspense>
				<VehicleSelectorTrigger />
			</div>
		</div>
	);
}
