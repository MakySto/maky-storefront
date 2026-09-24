"use client";

import { useTranslations } from "next-intl";
import { HomeVehicleFrame } from "./home-vehicle-frame";

/**
 * The vehicle block while the garage streams in: the same panel with its real title and text,
 * the fields and the button as grey shapes in `VehicleQuickSelect`'s own grid, so nothing moves
 * when it lands.
 */
export function HomeVehicleBlockSkeleton() {
	const t = useTranslations("home");
	const field = (
		<div>
			<span className="bg-surface-secondary mb-1.5 block h-[1.1875rem] w-16 rounded-xs" />
			<span className="bg-surface-card block h-12 rounded-xs" />
		</div>
	);
	return (
		<div aria-hidden="true">
			<HomeVehicleFrame title={t("vehicleTitle")} body={t("vehicleBody")}>
				<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,13rem))_auto] lg:items-end lg:gap-4">
					{field}
					{field}
					{field}
					<span className="bg-surface-secondary block h-12 w-full rounded-xs sm:col-span-3 lg:col-span-1 lg:w-72" />
				</div>
			</HomeVehicleFrame>
		</div>
	);
}
