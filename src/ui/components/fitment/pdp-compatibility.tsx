import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { getLocaleFromChannel } from "@/config/locale";
import { isDemoDataset } from "@/lib/fitment/offers";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { datasetSpeaksForProduct, resolveFitment } from "@/lib/fitment/resolve";
import { vehicleDisplayName } from "@/lib/garage/label";
import { readGarage } from "@/lib/garage/state";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { VehicleSelectorLauncher } from "@/ui/components/vehicle/vehicle-selector-launcher";
import { CompatibilityBox } from "./compatibility-box";

/**
 * The PDP's compatibility answer, resolved for THIS product and the saved car.
 *
 * CLAUDE.md §8: it belongs next to the purchase CTA, not in the description. It is
 * mounted as a sibling of the add-to-cart `<form>`, deliberately OUTSIDE it — the box
 * carries a button, `src/ui/components/ui/button.tsx` sets no default `type`, and a
 * stray submit inside that form would put the product in the cart while the shopper
 * thought they were changing their car. Keeping it outside the form removes the hazard
 * rather than relying on every future edit to remember it.
 *
 * It renders NOTHING in two cases, and both are the honest answer:
 *
 *   - no dataset — the provider is off or unreachable, so there is no compatibility
 *     feature on this deployment to speak with;
 *   - the dataset has no row for this product — see `datasetSpeaksForProduct`. Silence,
 *     never NO_FIT, is what absence means outside the programme's scope.
 *
 * The action under the verdict changes with the verdict, because "choose your car" is
 * the wrong offer to someone who has just been told their car does not fit: that shopper
 * gets a way to the sets that DO fit instead (CLAUDE.md §8).
 *
 * Nothing here may throw. It renders INSIDE the variant section's error boundary, whose
 * fallback replaces the add-to-cart button — so an unreachable fitment provider would
 * take the shop's ability to sell this product with it. A compatibility box that fails
 * has to fail into silence.
 */
export async function PdpCompatibility(props: {
	channel: string;
	saleorProductId: string;
	className?: string;
}) {
	try {
		return await renderCompatibility(props);
	} catch (error) {
		console.error("[fitment] PDP compatibility failed:", error);
		return null;
	}
}

async function renderCompatibility({
	channel,
	saleorProductId,
	className,
}: {
	channel: string;
	saleorProductId: string;
	className?: string;
}) {
	// Explicit, not incidental: this subtree reads the garage cookie.
	await connection();

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;
	if (!datasetSpeaksForProduct(dataset, saleorProductId)) return null;

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "fitment" });

	const garage = await readGarage(dataset);
	const active = garage.active && !garage.active.unresolved ? garage.active : null;
	const vehicleLabel = vehicleDisplayName(active);

	const result = resolveFitment(dataset, active?.selection ?? null, { saleorProductId });

	const action =
		result.verdict === "NO_FIT" ? (
			<LinkWithChannel
				href="/konfigurator"
				className="border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition-colors"
			>
				{t("showCompatible")}
			</LinkWithChannel>
		) : (
			<VehicleSelectorLauncher
				variant="inline"
				label={vehicleLabel ? t("changeVehicle") : undefined}
				vehicleLabel={vehicleLabel}
			/>
		);

	return (
		<CompatibilityBox
			result={result}
			vehicleLabel={vehicleLabel}
			isDemo={isDemoDataset(dataset)}
			locale={locale}
			action={action}
			className={className}
		/>
	);
}
