"use client";

/**
 * "Choose the generation" for a saved car CFM merged or dissolved.
 *
 * The garage keeps the car (make, model, year are known) and cannot say which generation it is: the
 * year falls in more than one of those that remain, or none. The shopper knows, so the one vehicle
 * selector opens on the model and year they already gave, and asks the one question that is left
 * (`vehicle-selector-sheet.tsx`, the generation step) — no second selector, no guess.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SheetTrigger } from "@/ui/components/ui/sheet";
import { Button } from "@/ui/components/ui/button";
import { VehicleSelectorSheet, type VehicleDraft } from "./vehicle-selector-sheet";

export function ChooseGeneration({ draft }: { draft: VehicleDraft }) {
	const t = useTranslations("garage");
	const [open, setOpen] = useState(false);

	return (
		<VehicleSelectorSheet open={open} onOpenChange={setOpen} initialDraft={draft}>
			<SheetTrigger asChild>
				<Button type="button" variant="ghost" size="sm" aria-haspopup="dialog">
					{t("chooseGenerationAction")}
				</Button>
			</SheetTrigger>
		</VehicleSelectorSheet>
	);
}
