import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getLocaleFromChannel } from "@/config/locale";
import { categoryUrlFor } from "@/config/category-routes";
import { marketHref } from "@/lib/channel-map";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { vehicleFilterHref } from "@/lib/fitment/plp-vehicle-filter";
import { loadSelectorStep } from "@/lib/fitment/selector-actions";
import { readGarage } from "@/lib/garage/state";
import {
	VehicleQuickSelect,
	type VehicleQuickSelectInitial,
} from "@/ui/components/vehicle/vehicle-quick-select";
import { HomeVehicleFrame } from "./home-vehicle-frame";

/**
 * The homepage's vehicle block, under the categories: "Vyberte svoje vozidlo", the three fields
 * and the green button, answered in place (premium redesign, second pass 2026-09-24).
 *
 * The fields are `VehicleQuickSelect` — the existing selector's own steps, not a second
 * configurator; whatever a car needs beyond make, model and year is still asked, in the sheet.
 * The makes are read here, on the server, so the first field is filled before any script runs.
 * With a car in use the fields open on it and the button is the explicit "Zobraziť nosiče pre
 * moje auto"; changing a field turns it back into the selector's confirm. No car photo: the
 * saved car is not reliably a picture we have.
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

	const first = await loadSelectorStep({});
	if (first.unavailable || first.makes.length === 0) return null;

	let initial: VehicleQuickSelectInitial | null = null;
	if (active) {
		const { k: makeId, m: modelId, y: year } = active.stored;
		const known = await loadSelectorStep({ makeId, modelId });
		if (known.models && known.years?.includes(year)) {
			initial = { makeId, modelId, year, models: known.models, years: known.years };
		}
	}

	return (
		<HomeVehicleFrame title={t("vehicleTitle")} body={t("vehicleBody")}>
			<VehicleQuickSelect
				makes={first.makes}
				initial={initial}
				activeHref={
					initial
						? vehicleFilterHref(marketHref(channel, categoryUrlFor(channel, "stresne-nosice")), {}, true)
						: null
				}
			/>
		</HomeVehicleFrame>
	);
}
