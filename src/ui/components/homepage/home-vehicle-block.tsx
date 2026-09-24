import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { categoryUrlFor } from "@/config/category-routes";
import { marketHref } from "@/lib/channel-map";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { vehicleFilterHref } from "@/lib/fitment/plp-vehicle-filter";
import { readGarage } from "@/lib/garage/state";
import { VehicleSelectorField } from "@/ui/components/vehicle/vehicle-selector-field";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { HomeVehicleFrame } from "./home-vehicle-frame";

/**
 * The homepage's vehicle block: a wide light panel, the mountains drawn faintly at its right
 * edge, three fields and the green action (premium redesign 2026-09).
 *
 * A new look for the existing selector, not a second one. The fields open the same sheet the
 * header does, which asks every step a car needs — generation and roof type included — and the
 * difference between trying a car, saving it and filtering by it stays where it was: choosing a
 * car here does not fill the garage by itself, and the listing is narrowed only by the explicit
 * "Zobraziť nosiče pre moje auto". No car photo: the saved car is not reliably a picture we have.
 *
 * Renders nothing when the vehicle feature cannot act (no dataset, or no garage), like the hero.
 */
export async function HomeVehicleBlock({ params }: { params: Promise<{ channel: string }> }) {
	await connection();
	const { channel } = await params;

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;
	const garage = await readGarage(dataset);
	if (garage.status === "disabled") return null;

	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	const active = garage.active && !garage.active.unresolved ? garage.active : null;
	const model = active ? [active.modelName, active.generationName].filter(Boolean).join(" ") : null;

	return (
		<HomeVehicleFrame title={t("vehicleTitle")} body={t("vehicleBody")}>
			<div className="grid gap-3 sm:grid-cols-3">
				<VehicleSelectorField
					label={t("vehicleMake")}
					value={active?.makeName}
					placeholder={t("vehiclePickMake")}
				/>
				<VehicleSelectorField label={t("vehicleModel")} value={model} placeholder={t("vehiclePickModel")} />
				<VehicleSelectorField
					label={t("vehicleYear")}
					value={active?.stored.y ? String(active.stored.y) : null}
					placeholder={t("vehiclePickYear")}
				/>
			</div>
			<div className="lg:pb-0">
				{active ? (
					<Link
						href={vehicleFilterHref(marketHref(channel, categoryUrlFor(channel, "stresne-nosice")), {}, true)}
						className="bg-cta text-cta-text hover:bg-cta-hover focus-visible:ring-cta inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xs px-6 text-[0.9375rem] font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:w-auto"
					>
						{t("heroShowForMyCar")}
						<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
					</Link>
				) : (
					<VehicleSelectorLauncher
						variant="primary"
						label={t("heroSelectCar")}
						className="h-12 w-full px-6 text-[0.9375rem] sm:w-auto"
					/>
				)}
			</div>
		</HomeVehicleFrame>
	);
}
