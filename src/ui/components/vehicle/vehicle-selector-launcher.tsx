"use client";

/**
 * The button that opens the one vehicle selector.
 *
 * The header and the homepage hero each used to render a car-shaped button with no
 * `onClick` — two visual stubs, and no reachable selector on any viewport. This is that
 * button, wired to the shared sheet.
 *
 * Both stubs are gone: `header-nav-row.tsx` and `hero-section.tsx` now mount this,
 * through the server-side `ActiveVehicleLauncher` which supplies the saved car's name.
 *
 * Since the 2026-09 redesign the `header` variant is the approved design's filled green
 * button with two lines ("Vybrať vozidlo / Pre jednoduchší výber", or the car and "Zmeniť
 * vozidlo"), and `icon` is the 44px square beside the phone search.
 *
 * `compact` exists because `header` hides its label below `xl`, which is right in a
 * desktop nav row and wrong everywhere else: the nav row itself is `lg:hidden`'s
 * mirror image (`hidden lg:block`), so below 1024px there was NO vehicle selector at
 * all — not in the header, not in the menu. `compact` is the same button with the
 * label kept and allowed to shrink, for the mobile/tablet search row.
 *
 * The header keeps `nav.selectVehicle` ("Vybrať vozidlo"), which CLAUDE.md §5 mandates
 * for that CTA, while the hero keeps `fitment.selectVehicle` ("Vyberte vaše vozidlo").
 * They are two different keys with two different strings and both are correct in place.
 */

import { useState } from "react";
import { ArrowRightIcon, CarIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { SheetTrigger } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { VehicleSelectorSheet } from "./vehicle-selector-sheet";

type Variant = "header" | "hero" | "primary" | "compact" | "inline" | "link" | "icon";

type Props = {
	variant?: Variant;
	/** Resolved active-vehicle label. Null renders the generic "choose a vehicle" copy. */
	vehicleLabel?: string | null;
	/**
	 * Overrides both of the above. For surfaces that already name the car right next to
	 * the button — the PDP's compatibility box says "verified for <car>" — where
	 * repeating it on the button says nothing and "choose a vehicle" is the wrong verb
	 * for what the click actually does.
	 */
	label?: string;
	className?: string;
};

export function VehicleSelectorLauncher({
	variant = "inline",
	vehicleLabel,
	label: labelOverride,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const tNav = useTranslations("nav");
	const tFitment = useTranslations("fitment");

	const fallback =
		variant === "header" || variant === "compact" || variant === "icon"
			? tNav("selectVehicle")
			: tFitment("selectVehicle");
	const car = vehicleLabel?.trim() || null;
	const label = labelOverride?.trim() || car || fallback;

	// The header's green button speaks in two lines: what it is and what the click does.
	// "Vybrať vozidlo / Pre jednoduchší výber" without a car; the car and "Zmeniť vozidlo"
	// with one. Its accessible name is those two lines, read in order.
	const hint = car ? tFitment("changeVehicle") : tNav("selectVehicleHint");
	// The 44px square beside the phone search names the car only to assistive tech; the
	// filled button with a check is how it shows one is chosen.
	const iconLabel = car ? `${tNav("vehicleSaved")}: ${car}. ${tFitment("changeVehicle")}` : fallback;

	return (
		<VehicleSelectorSheet open={open} onOpenChange={setOpen}>
			{/* Radix's Trigger hardcodes type="button" and forwards it through asChild, so
			    this is safe even inside the PDP's add-to-cart <form>. */}
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={variant === "header" ? undefined : variant === "icon" ? iconLabel : label}
					aria-haspopup="dialog"
					className={cn(
						// The header's green entry to the vehicle selector: the approved design's filled
						// button with two lines. Below `xl` the nav row has no width for the words, and the
						// car icon alone stands in, named by its title.
						variant === "header" &&
							"bg-cta text-cta-text hover:bg-cta-hover inline-flex h-11 items-center gap-2.5 rounded-xs px-3 text-left shadow-sm transition-colors xl:px-3.5",
						variant === "hero" &&
							"bg-cta text-cta-text hover:bg-cta-hover inline-flex h-[3.25rem] items-center justify-center gap-2.5 rounded-xs px-6 text-base font-semibold shadow-lg transition-colors",
						// The hero's green button at listing size: the vehicle panel above a roof-rack listing.
						variant === "primary" &&
							"bg-cta text-cta-text hover:bg-cta-hover inline-flex h-11 items-center justify-center gap-2 rounded-xs px-5 text-sm font-semibold whitespace-nowrap transition-colors",
						// `h-11` matches the search field it sits beside, and `whitespace-nowrap`
						// because at 360px the label wrapped inside a fixed-height button and spilled
						// out of it.
						variant === "compact" &&
							"border-status-success-border bg-status-success-bg text-status-success hover:border-cta inline-flex h-11 min-w-0 items-center gap-2 rounded-xs border px-3 text-sm font-medium whitespace-nowrap transition-colors",
						// The phone header's square beside the search: light green without a car, filled
						// with a check once one is chosen.
						variant === "icon" &&
							cn(
								"relative inline-flex h-11 w-11 items-center justify-center rounded-xs border transition-colors",
								car
									? "border-cta bg-cta text-cta-text hover:bg-cta-hover"
									: "border-status-success-border bg-status-success-bg text-status-success hover:border-cta",
							),
						variant === "inline" &&
							"border-border-default bg-surface-card text-text-primary hover:border-cta inline-flex min-h-11 items-center gap-2.5 rounded-xs border px-3 text-sm font-medium transition-colors",
						// A text link — "Zmeniť auto" next to the car's name. Its colour is the caller's: white
						// on the dark hero, the link colour on a listing.
						variant === "link" &&
							"inline-flex items-center font-medium underline decoration-1 underline-offset-2 transition-colors",
						"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
						className,
					)}
				>
					{variant !== "link" && (
						<CarIcon
							className={cn(
								"shrink-0",
								variant === "header" ? "h-5 w-5" : "h-4 w-4",
								variant === "icon" && "h-5 w-5",
							)}
							aria-hidden="true"
						/>
					)}
					{variant === "icon" && car && (
						<span
							aria-hidden="true"
							className="bg-surface-card text-cta absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
						>
							<CheckIcon className="h-3 w-3" strokeWidth={3} />
						</span>
					)}
					{variant === "header" && (
						// Always in the DOM: below `xl` it is the button's accessible name, from `xl` its face.
						<span className="sr-only min-w-0 flex-col leading-tight xl:not-sr-only xl:flex">
							<span className="max-w-[13rem] truncate text-sm font-semibold">{label}</span>
							<span className="max-w-[13rem] truncate text-xs opacity-85">{hint}</span>
						</span>
					)}
					{variant !== "header" && variant !== "icon" && (
						<span
							className={cn(
								"truncate",
								// `compact` shares a 360px row with the search field, where it must shrink.
								variant === "compact" && "max-w-[8.5rem]",
								variant !== "compact" && variant !== "link" && "max-w-[16rem]",
							)}
						>
							{label}
						</span>
					)}
					{variant === "hero" && (
						<ArrowRightIcon
							className="h-[1.125rem] w-[1.125rem] shrink-0"
							strokeWidth={2.25}
							aria-hidden="true"
						/>
					)}
					{variant === "inline" && car && (
						<span className="text-text-link ml-auto shrink-0 text-sm font-medium">
							{tFitment("changeVehicle")}
						</span>
					)}
				</button>
			</SheetTrigger>
		</VehicleSelectorSheet>
	);
}
