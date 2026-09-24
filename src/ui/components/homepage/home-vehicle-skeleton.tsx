"use client";

import { useTranslations } from "next-intl";
import { HomeVehicleFrame } from "./home-vehicle-frame";

/**
 * The vehicle block while the garage streams in: the same panel with its real title and text,
 * the fields and the button as grey shapes of the same size, so nothing moves when it lands.
 */
export function HomeVehicleBlockSkeleton() {
	const t = useTranslations("home");
	const field = (
		<div>
			<span className="bg-surface-secondary mb-1.5 block h-[1.1875rem] w-16 rounded-xs" />
			<span className="bg-surface-secondary block h-12 rounded-xs" />
		</div>
	);
	return (
		<div aria-hidden="true">
			<HomeVehicleFrame title={t("vehicleTitle")} body={t("vehicleBody")}>
				<div className="grid gap-3 sm:grid-cols-3">
					{field}
					{field}
					{field}
				</div>
				<span className="bg-surface-secondary block h-12 w-full rounded-xs sm:w-56" />
			</HomeVehicleFrame>
		</div>
	);
}
