"use client";

/**
 * The drop-in that makes the existing dead vehicle buttons work.
 *
 * `src/ui/components/header/vehicle-selector-trigger.tsx` and the homepage hero both
 * render a car-shaped button with no `onClick` — two visual stubs, no reachable selector
 * on any viewport. This component is the same button wired to the shared sheet.
 *
 * Lane A owns the header and the hero, so this file does NOT edit either. It is a
 * one-line swap:
 *
 *     header-nav-row.tsx:48
 *       - <VehicleSelectorTrigger />
 *       + <VehicleSelectorLauncher variant="header" vehicleLabel={label} />
 *
 * The `header` variant reproduces the existing button's classes EXACTLY, so the swap is
 * visually a no-op. Those classes use raw `forest-*` primitives rather than semantic
 * tokens, which CLAUDE.md §4 forbids — preserved deliberately rather than silently
 * restyling someone else's header; it is reported instead.
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

type Variant = "header" | "hero" | "inline";

type Props = {
	variant?: Variant;
	/** Resolved active-vehicle label. Null renders the generic "choose a vehicle" copy. */
	vehicleLabel?: string | null;
	className?: string;
};

export function VehicleSelectorLauncher({ variant = "inline", vehicleLabel, className }: Props) {
	const [open, setOpen] = useState(false);
	const tNav = useTranslations("nav");
	const tFitment = useTranslations("fitment");

	const fallback = variant === "header" ? tNav("selectVehicle") : tFitment("selectVehicle");
	const label = vehicleLabel?.trim() || fallback;

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
