import { Suspense } from "react";

import {
	ActiveVehicleLauncher,
	ActiveVehicleLauncherSkeleton,
} from "@/ui/components/vehicle/active-vehicle-launcher";
import { HeaderMainRow } from "./header-main-row";
import { HeaderNavRow } from "./header-nav-row";
import { HeaderSearch } from "./header-search";

/**
 * The one header of the shop: white, a thin rule under each row, the same on every page.
 *
 * Desktop: logo, the wide search and the labelled account / favourites / cart actions on a
 * 72px row; under it a 52px row with "Všetky kategórie", the category links, the market and
 * the green vehicle button.
 *
 * Phone and tablet: hamburger, logo and the actions on a 64px row; under it the search at full
 * width with the vehicle button as a 44px square beside it. The square used to be a labelled
 * chip that grew with the car's name and squeezed the search to a sliver on a 360px phone; the
 * saved car now shows as a filled button with a check, named in its accessible label, and the
 * menu names it in full.
 *
 * Both rows have fixed heights, which `HeaderSkeleton` in the (main) layout mirrors.
 */
export async function SiteHeader({ channel }: { channel: string }) {
	return (
		<header className="border-border-subtle bg-surface-card sticky top-0 z-[var(--z-header)] border-b print:hidden">
			<div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8">
				<HeaderMainRow channel={channel} />

				{/* Search visible on mobile + tablet, hidden on desktop (where it's inline). The
				    search keeps `min-w-0 flex-1` so at 360px it shrinks instead of pushing the
				    document wider than the viewport. */}
				<div className="flex items-center gap-2 pb-3 lg:hidden">
					<div className="min-w-0 flex-1">
						<HeaderSearch channel={channel} />
					</div>
					<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="icon" className="shrink-0" />}>
						<ActiveVehicleLauncher variant="icon" className="shrink-0" />
					</Suspense>
				</div>
			</div>

			{/* Nav row — desktop only */}
			<div className="border-border-subtle hidden border-t lg:block">
				<div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8">
					<HeaderNavRow channel={channel} />
				</div>
			</div>
		</header>
	);
}
