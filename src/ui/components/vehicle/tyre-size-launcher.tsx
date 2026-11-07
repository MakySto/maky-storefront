"use client";

import { useState } from "react";
import { CircleDotIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { SheetTrigger } from "@/ui/components/ui/sheet";
import { VehicleSelectorSheet } from "./vehicle-selector-sheet";

/**
 * The button on a listing that opens the one vehicle window on its tyres tab.
 *
 * The snow-chain shelf asks for a tyre size the way a roof-rack shelf asks for a car: in the same window, once, and
 * remembered. The label is the caller's (it is already in the shopper's language); this only wires the click to the
 * shared sheet, opened on the second tab.
 *
 *   primary  the page's green action, for the panel that asks for the size at all
 *   link     a text link, for "change the size" beside a size that is already known
 */
export function TyreSizeLauncher({
	label,
	variant = "link",
	className,
}: {
	label: string;
	variant?: "primary" | "link";
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<VehicleSelectorSheet open={open} onOpenChange={setOpen} initialTab="tyres">
			{/* Radix's Trigger hardcodes type="button" and forwards it through asChild. */}
			<SheetTrigger asChild>
				<button
					type="button"
					aria-haspopup="dialog"
					className={cn(
						variant === "primary" &&
							"bg-cta text-cta-text hover:bg-cta-hover inline-flex h-11 items-center justify-center gap-2 rounded-xs px-5 text-sm font-semibold whitespace-nowrap transition-colors",
						variant === "link" &&
							"inline-flex items-center font-medium underline decoration-1 underline-offset-2 transition-colors",
						"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
						className,
					)}
				>
					{variant === "primary" && <CircleDotIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
					<span className={variant === "primary" ? "truncate" : undefined}>{label}</span>
				</button>
			</SheetTrigger>
		</VehicleSelectorSheet>
	);
}
