"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { SheetTrigger } from "@/ui/components/ui/sheet";
import { cn } from "@/lib/utils";
import { VehicleSelectorSheet } from "./vehicle-selector-sheet";

/**
 * One field of the homepage vehicle block — "Značka", "Model", "Rok výroby" — that opens the
 * ONE vehicle selector.
 *
 * It looks like a select because the approved design draws three, but it is the existing
 * selector's door, not a second configurator: the sheet asks every step the car needs,
 * generation and roof type included, and it starts where it always starts. A field shows the
 * saved car's part once there is one, and clicking it changes the car.
 */
export function VehicleSelectorField({
	label,
	value,
	placeholder,
	className,
}: {
	label: string;
	value?: string | null;
	placeholder: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const shown = value?.trim() || null;

	return (
		<div className={cn("min-w-0", className)}>
			<span aria-hidden="true" className="text-text-primary mb-1.5 block text-[0.8125rem] font-semibold">
				{label}
			</span>
			<VehicleSelectorSheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button
						type="button"
						aria-haspopup="dialog"
						aria-label={`${label}: ${shown ?? placeholder}`}
						className="border-border-default bg-surface-card hover:border-text-tertiary focus-visible:ring-ring flex h-12 w-full items-center justify-between gap-2 rounded-xs border px-3.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
					>
						<span className={cn("truncate", shown ? "text-text-primary font-medium" : "text-text-tertiary")}>
							{shown ?? placeholder}
						</span>
						<ChevronDownIcon className="text-text-tertiary h-4 w-4 shrink-0" aria-hidden="true" />
					</button>
				</SheetTrigger>
			</VehicleSelectorSheet>
		</div>
	);
}
