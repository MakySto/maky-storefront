import { connection } from "next/server";

import { loadFitmentDataset } from "@/lib/fitment/provider";
import { readGarage } from "@/lib/garage/state";
import { vehicleShortLabel } from "@/lib/garage/label";
import { cn } from "@/lib/utils";
import { VehicleSelectorLauncher } from "./vehicle-selector-launcher";

/**
 * The header/hero vehicle button, with the saved car's name already on it.
 *
 * Server-side on purpose. The active vehicle lives in a signed, httpOnly cookie, so the
 * browser cannot read it; resolving the name here also means the label is checked
 * against the CURRENT dataset rather than trusted from the cookie.
 *
 * `connection()` is explicit rather than incidental: the subtree is request-time because
 * it reads a cookie, and relying on `readGarage`'s own `cookies()` call to establish
 * that would work today and break silently the moment that call moves behind another
 * boundary. The caller must wrap this in `<Suspense>` with a fixed-size fallback —
 * otherwise the whole header leaves the prerendered shell.
 *
 * It renders NOTHING when the feature cannot act:
 *
 *   - no dataset (provider off, or unreachable) — the selector's first step would be an
 *     empty list of makes;
 *   - the garage is disabled (`MAKY_GARAGE_COOKIE_SECRET` unset in production) — a car
 *     picked here could not be saved.
 *
 * A button that opens a dead end is worse than no button, and the surface it replaces
 * was already a stub with no `onClick`.
 */
export async function ActiveVehicleLauncher({
	variant,
	className,
}: {
	variant: "header" | "hero" | "compact" | "inline";
	className?: string;
}) {
	await connection();

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;

	const garage = await readGarage(dataset);
	if (garage.status === "disabled") return null;

	return (
		<VehicleSelectorLauncher
			variant={variant}
			vehicleLabel={vehicleShortLabel(
				garage.active ? { ...garage.active, year: garage.active.stored.y } : null,
			)}
			className={className}
		/>
	);
}

/**
 * Reserved space for the launcher while it streams in.
 *
 * Fixed width, not `w-auto`: the header row is `justify-between`, so a fallback that
 * collapses would let the market controls slide sideways and snap back.
 */
export function ActiveVehicleLauncherSkeleton({
	variant,
	className,
}: {
	variant: "header" | "hero" | "compact";
	className?: string;
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"bg-sand-100 animate-pulse rounded-sm",
				variant === "header" && "h-10 w-[3.75rem] xl:w-[11rem]",
				variant === "compact" && "h-10 w-[9.5rem] rounded-sm",
				variant === "hero" && "h-12 w-[13rem] rounded-md",
				className,
			)}
		/>
	);
}
