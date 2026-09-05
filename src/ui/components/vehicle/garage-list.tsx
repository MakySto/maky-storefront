"use client";

/**
 * The saved-vehicle list.
 *
 * Client-side only because removing a car and switching the active one are mutations,
 * and a server component render cannot write a cookie. The vehicles themselves arrive
 * already resolved from the server — names are never stored in the cookie, so they are
 * always current and always in the right language.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Car, Check, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { removeVehicle, setActiveVehicle } from "@/lib/garage/actions";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { type RoofType } from "@/lib/fitment/contract";

export type GarageListVehicle = {
	makeName: string | null;
	modelName: string | null;
	generationName: string | null;
	year: number;
	roofType: RoofType | null;
	unresolved: boolean;
};

export function GarageList({
	vehicles,
	activeIndex,
}: {
	vehicles: GarageListVehicle[];
	activeIndex: number;
}) {
	const t = useTranslations("garage");
	const tf = useTranslations("fitment");
	const router = useRouter();
	const [busy, setBusy] = useState<number | null>(null);
	const [pending, startTransition] = useTransition();

	const run = (index: number, action: () => Promise<unknown>) => {
		setBusy(index);
		startTransition(async () => {
			await action();
			setBusy(null);
			router.refresh();
		});
	};

	return (
		<ul className="space-y-3">
			{vehicles.map((vehicle, index) => {
				const isActive = index === activeIndex;
				const label = vehicle.unresolved
					? null
					: [vehicle.makeName, vehicle.modelName, vehicle.generationName].filter(Boolean).join(" ");

				return (
					<li
						key={`${label ?? "unresolved"}-${vehicle.year}-${index}`}
						className={cn(
							"border-border-default flex flex-wrap items-center gap-3 rounded-lg border p-4",
							isActive && "border-action-primary bg-surface-muted",
						)}
					>
						<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />

						<div className="min-w-0 flex-1">
							{vehicle.unresolved ? (
								// The ids no longer match the dataset. The car is kept and flagged
								// rather than deleted or matched to something similar-looking.
								<>
									<p className="text-fitment-unconfirmed text-sm font-medium">{t("unresolved")}</p>
									<p className="text-text-tertiary text-sm">{vehicle.year}</p>
								</>
							) : (
								<>
									<p className="text-text-primary truncate text-sm font-medium">{label}</p>
									<p className="text-text-tertiary text-sm">
										{vehicle.year}
										{vehicle.roofType && ` · ${tf(ROOF_LABEL_KEY[vehicle.roofType])}`}
									</p>
								</>
							)}
						</div>

						{isActive ? (
							<span className="bg-fitment-fits-bg text-fitment-fits inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
								<Check className="h-3.5 w-3.5" aria-hidden="true" />
								{t("active")}
							</span>
						) : (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={pending || vehicle.unresolved}
								onClick={() => run(index, () => setActiveVehicle(index))}
							>
								{busy === index && pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
								{t("setActive")}
							</Button>
						)}

						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={pending}
							aria-label={t("removeConfirm", { vehicle: label ?? String(vehicle.year) })}
							onClick={() => run(index, () => removeVehicle(index))}
							className="text-fitment-no-fit"
						>
							<Trash2 className="h-4 w-4" aria-hidden="true" />
							<span className="sr-only sm:not-sr-only">{t("remove")}</span>
						</Button>
					</li>
				);
			})}
		</ul>
	);
}
