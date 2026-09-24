import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CarIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { categoryUrlFor } from "@/config/category-routes";
import { marketHref } from "@/lib/channel-map";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { vehicleFilterHref } from "@/lib/fitment/plp-vehicle-filter";
import { readGarage } from "@/lib/garage/state";
import { vehicleShortLabel } from "@/lib/garage/label";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";

/**
 * The hero's primary action, which depends on whether the shopper has told us their car.
 *
 * Two different actions must not look like one. Without a car the green button opens the
 * selector ("Vybrať moje auto"). With one it goes to the roof racks WITH the vehicle filter
 * switched on ("Zobraziť nosiče pre moje auto"): an explicit click, so a car merely saved in
 * the garage never narrows a listing on its own. The car is named on its own line under the
 * button, and changing it is a separate, plainly labelled link that opens the selector.
 *
 * Renders nothing when the vehicle feature cannot act (no dataset, or no garage), exactly
 * like the header launcher. The line under the button is always there, empty without a car,
 * so the row below the fold does not move when the saved car streams in.
 */
export async function HeroVehicleActions({ params }: { params: Promise<{ channel: string }> }) {
	await connection();
	const { channel } = await params;

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;
	const garage = await readGarage(dataset);
	if (garage.status === "disabled") return null;

	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	const active = garage.active && !garage.active.unresolved ? garage.active : null;
	const carLabel = active ? vehicleShortLabel({ ...active, year: active.stored.y }) : null;

	if (!carLabel) {
		return (
			<div className="flex flex-col">
				<VehicleSelectorLauncher variant="hero" label={t("heroSelectCar")} />
				{/* Reserved for the car's line from `sm` up, where the buttons sit in a row and
				    the line takes no room from anything; on a phone an empty line would only
				    push the second button away. */}
				<span className="mt-2 hidden h-5 sm:block" aria-hidden="true" />
			</div>
		);
	}

	const roofRacksForCar = vehicleFilterHref(
		marketHref(channel, categoryUrlFor(channel, "stresne-nosice")),
		{},
		true,
	);

	return (
		<div className="flex min-w-0 flex-col">
			<Link
				href={roofRacksForCar}
				className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-cta inline-flex h-12 items-center justify-center gap-2 rounded-sm px-6 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
			>
				<CarIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
				{t("heroShowForMyCar")}
			</Link>
			<p className="text-text-inverse/75 mt-2 flex h-5 min-w-0 items-center gap-1.5 text-sm">
				<span className="truncate">{carLabel}</span>
				<span aria-hidden="true">·</span>
				<VehicleSelectorLauncher variant="link" label={t("heroChangeCar")} className="shrink-0" />
			</p>
		</div>
	);
}

/** The same footprint as the button plus its line, while the garage streams in. */
export function HeroVehicleActionsSkeleton() {
	return (
		<div className="flex flex-col" aria-hidden="true">
			<div className="bg-text-inverse/10 h-12 w-full animate-pulse rounded-sm sm:w-[14rem]" />
			<span className="mt-2 hidden h-5 sm:block" />
		</div>
	);
}
