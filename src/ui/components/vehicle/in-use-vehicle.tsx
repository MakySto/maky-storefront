"use client";

/**
 * The car being shopped with, which the shopper has not asked to keep.
 *
 * It exists because choosing a car and keeping a car used to be the same act: every
 * "Potvrdiť vozidlo" wrote to the saved list, so a shopper trying a fourth car hit the
 * three-vehicle limit and was refused outright — they could not even look at it.
 * Selecting no longer saves, so this card is what makes the difference visible and gives
 * the shopper the other half back: one button, pressed on purpose.
 *
 * Client-side because saving is a mutation and a server render cannot write a cookie.
 * The label arrives already resolved — names live in the dataset, never in the cookie.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Car, Loader2, Plus } from "lucide-react";

import { Button } from "@/ui/components/ui/button";
import { saveActiveVehicle } from "@/lib/garage/actions";
import { GARAGE_MAX_VEHICLES } from "@/lib/garage/cookie";
import { joinVehicleDetail } from "@/lib/garage/label";
import { ROOF_LABEL_KEY } from "@/ui/components/fitment/verdict-presentation";
import { type RoofType } from "@/lib/fitment/contract";

export function InUseVehicle({
	label,
	year,
	roofType,
	atLimit,
}: {
	label: string | null;
	year: number;
	roofType: RoofType | null;
	atLimit: boolean;
}) {
	const t = useTranslations("garage");
	const tf = useTranslations("fitment");
	// Roof labels live in the fitment namespace, resolved the same way `GarageList` does.
	// Shared joiner, so this card and the garage list below it cannot drift apart.
	const details = joinVehicleDetail([
		String(year),
		roofType ? tf(ROOF_LABEL_KEY[roofType]) : tf("roofUnconfirmed"),
	]);
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const save = () => {
		setError(null);
		startTransition(async () => {
			const result = await saveActiveVehicle();
			if (result.ok) {
				router.refresh();
				return;
			}
			setError(
				result.error === "limit-reached"
					? t("limitReached", { max: GARAGE_MAX_VEHICLES })
					: t("errorGeneric"),
			);
		});
	};

	return (
		<div className="border-action-primary bg-surface-muted rounded-lg border p-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />
				{/*
				 * `min-w-0` let this column shrink to nothing, so at 360 px the wide save
				 * button kept its place on the row and "Volkswagen Golf VIII (CD)" broke
				 * mid-word — "Volkswage / n Golf VIII". A floor makes `flex-wrap` do its
				 * job and move the button to its own line instead of squeezing the name.
				 */}
				<div className="min-w-[11rem] flex-1">
					<p className="text-text-tertiary text-xs font-medium tracking-wide uppercase">{t("inUse")}</p>
					{/* Same reason as `vehicle-summary`: the roof state must stay readable at 360 px. */}
					<p className="text-text-primary text-sm font-semibold break-words">{label ?? t("unresolved")}</p>
					{details && <p className="text-text-secondary text-sm break-words">{details}</p>}
				</div>
				{/*
				 * Hidden at the limit rather than shown failing: the button would only ever
				 * produce the "remove one first" message, and the saved list below already
				 * says that. The car stays usable either way — that is the point of the
				 * split, and it is why the limit no longer blocks anything.
				 */}
				{!atLimit && (
					<Button
						type="button"
						onClick={save}
						disabled={pending}
						className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover"
					>
						{pending ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<Plus className="h-4 w-4" aria-hidden="true" />
						)}
						{t("saveThis")}
					</Button>
				)}
			</div>
			<p className="text-text-tertiary mt-2 text-sm">{t("inUseHint")}</p>
			{error && (
				<p
					role="alert"
					className="bg-status-danger-bg text-status-danger border-status-danger-border mt-3 rounded-md border px-3 py-2 text-sm"
				>
					{error}
				</p>
			)}
		</div>
	);
}
