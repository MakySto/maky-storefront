import { Suspense } from "react";

import {
	ActiveVehicleLauncher,
	ActiveVehicleLauncherSkeleton,
} from "@/ui/components/vehicle/active-vehicle-launcher";
import { HeaderMainRow } from "./header-main-row";
import { HeaderNavRow } from "./header-nav-row";
import { HeaderSearch } from "./header-search";

export async function SiteHeader({ channel }: { channel: string }) {
	return (
		<header className="sticky top-0 z-[var(--z-header)] bg-white/80 backdrop-blur-xl print:hidden">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<HeaderMainRow channel={channel} />

				{/* Search visible on mobile + tablet, hidden on desktop (where it's inline).
				    The vehicle button rides in the same row because the nav row below is
				    `hidden lg:block`: without this, every viewport under 1024px — which is
				    most of them — had no way to reach the vehicle selector at all. The
				    search keeps `min-w-0 flex-1` so at 360px it shrinks instead of pushing
				    the document wider than the viewport, the failure that mobile
				    sideways-pan fix already had to undo once. */}
				<div className="flex items-center gap-2 pb-3 lg:hidden">
					<div className="min-w-0 flex-1">
						<HeaderSearch channel={channel} />
					</div>
					<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="compact" className="shrink-0" />}>
						<ActiveVehicleLauncher variant="compact" className="shrink-0" />
					</Suspense>
				</div>
			</div>

			{/* Nav row — desktop only */}
			<div className="border-sand-200/60 bg-sand-100/50 hidden border-t backdrop-blur-xl lg:block">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<HeaderNavRow channel={channel} />
				</div>
			</div>
		</header>
	);
}
