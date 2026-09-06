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
 * The `header` variant reproduces the replaced button's classes EXACTLY, so that swap is
 * visually a no-op. Those classes use raw `forest-*` primitives rather than semantic
 * tokens, which CLAUDE.md §4 forbids — preserved deliberately rather than silently
 * restyling the header in the same commit that wires it up; it is reported instead.
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
import { CarIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { SheetTrigger } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { VehicleSelectorSheet } from "./vehicle-selector-sheet";

type Variant = "header" | "hero" | "compact" | "inline";

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
		variant === "header" || variant === "compact" ? tNav("selectVehicle") : tFitment("selectVehicle");
	const label = labelOverride?.trim() || vehicleLabel?.trim() || fallback;

	return (
		<VehicleSelectorSheet open={open} onOpenChange={setOpen}>
			{/* Radix's Trigger hardcodes type="button" and forwards it through asChild, so
			    this is safe even inside the PDP's add-to-cart <form>. */}
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label={label}
					aria-haspopup="dialog"
					className={cn(
						variant === "header" &&
							"border-forest-200 bg-forest-50 text-forest-700 hover:border-forest-300 hover:bg-forest-100 inline-flex h-10 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors",
						variant === "hero" &&
							"bg-action-primary text-action-primary-text hover:bg-action-primary-hover inline-flex h-12 items-center gap-2 rounded-md px-6 text-base font-semibold transition-colors",
						variant === "inline" &&
							"border-border-default text-text-primary hover:bg-surface-muted inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
						"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
						className,
					)}
				>
					<CarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
					<span
						className={cn(
							"truncate",
							// The header is tight below xl; the label is hidden there, exactly as
							// the original trigger did, so the icon alone stands in.
							variant === "header" ? "hidden max-w-[10rem] xl:inline" : "max-w-[16rem]",
						)}
					>
						{label}
					</span>
					{variant !== "hero" && (
						<ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
					)}
				</button>
			</SheetTrigger>
		</VehicleSelectorSheet>
	);
}
