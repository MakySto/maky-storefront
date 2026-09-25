import { getTranslations } from "next-intl/server";
import { AlertTriangle, Check, CircleHelp, Globe, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { type FitmentResult, type FitmentVerdict } from "@/lib/fitment/contract";
import { renderConditions } from "@/lib/fitment/conditions";
import {
	CONDITION_LABEL_KEY,
	TONE_CLASSES,
	toneForVerdict,
	VERDICT_DETAIL_KEY,
	VERDICT_LABEL_KEY,
} from "./verdict-presentation";

/**
 * The compatibility answer, rendered right above the price and the purchase button.
 *
 * ⚠️ This component is mounted INSIDE the PDP's `<form action={addToCart}>`
 * (`variant-section-dynamic.tsx`). `src/ui/components/ui/button.tsx` sets no default
 * `type`, so a `<Button>` rendered here would submit that form and silently add the
 * product to the cart. Everything interactive in this subtree must therefore be either
 * an anchor or carry an explicit `type="button"`. Radix's `SheetTrigger` is safe — it
 * hardcodes `type: "button"` and forwards it through `asChild` — but nothing else is,
 * and neither lint nor tsc nor the build will catch a mistake here.
 *
 * It is a server component on purpose: the verdict is computed on the server from the
 * dataset, so there is no window in which the browser holds a fit claim it could be
 * talked into changing.
 */

type Props = {
	result: FitmentResult;
	/** Resolved label of the active vehicle, e.g. "Škoda Octavia IV (NX), 2022". */
	vehicleLabel: string | null;
	/**
	 * The configuration the verdict is about — roof type, and the month if the shopper
	 * gave one. Rendered under the answer so the claim can be checked against the car it
	 * was made for, which the verdict sentence alone does not allow.
	 */
	vehicleDetail?: string | null;
	/** Rendered under the verdict — the "choose a vehicle" affordance. */
	action?: React.ReactNode;
	/** True when the answer came from demo data rather than a real provider. */
	isDemo?: boolean;
	/** Locale, for source-authored condition text. */
	locale: string;
	className?: string;
};

const VERDICT_ICON: Record<FitmentVerdict, typeof Check> = {
	VERIFIED_FIT: Check,
	MANUFACTURER_FIT: Check,
	NEEDS_DETAIL: CircleHelp,
	NO_FIT: X,
	UNKNOWN: CircleHelp,
	AMBIGUOUS: CircleHelp,
	STALE: AlertTriangle,
	PROVIDER_UNAVAILABLE: AlertTriangle,
	UNIVERSAL: Globe,
	NO_VEHICLE_SELECTED: CircleHelp,
};

export async function CompatibilityBox({
	result,
	vehicleLabel,
	vehicleDetail,
	action,
	isDemo,
	locale,
	className,
}: Props) {
	// The locale is a PROP, not request state. This subtree renders on the dynamic path
	// (it reads a cookie or searchParams), where `setRequestLocale` from the market layout
	// is not guaranteed to be in scope — and `i18n/request.ts` answers a missing request
	// locale with DEFAULT_LOCALE, which is Slovak. That is how a German page comes to hold
	// a Slovak label next to a German one. Asking with the locale we were handed cannot
	// drift, whatever the render path.
	const t = await getTranslations({ locale, namespace: "fitment" });

	// Conditions are resolved BEFORE the tone is chosen: a verified fit carrying a
	// condition we cannot state in this locale is a qualified fit, and it must not
	// present as an unconditional green one.
	const conditions = renderConditions(result.conditions, locale, (code) => {
		const key = CONDITION_LABEL_KEY[code];
		return key ? t(key) : null;
	});
	const qualified =
		(result.verdict === "VERIFIED_FIT" || result.verdict === "MANUFACTURER_FIT") &&
		conditions.unresolvedCount > 0;
	const tone = qualified ? "unconfirmed" : toneForVerdict(result.verdict);
	const Icon = qualified ? CircleHelp : VERDICT_ICON[result.verdict];

	// Every detail string that mentions a vehicle takes {vehicle}. With no vehicle
	// resolved we must not print an empty gap, so the generic prompt is used instead.
	const detailKey = VERDICT_DETAIL_KEY[result.verdict];
	const needsVehicle =
		detailKey !== "verdictSelectVehicleDetail" &&
		detailKey !== "verdictUniversalDetail" &&
		detailKey !== "verdictNeedsDetailDetail";
	// Whose word this is, named. The supplier comes from the row's own evidence rather
	// than from a constant, so a second brand's data cannot arrive one day still
	// attributed to the first. An unnamed source degrades to "the manufacturer" — vague,
	// and true — instead of printing a gap.
	const supplier = result.product?.evidence.supplier?.trim() || t("supplierFallback");
	const detail =
		needsVehicle && !vehicleLabel
			? t("verdictSelectVehicleDetail")
			: t(detailKey, { vehicle: vehicleLabel ?? "", supplier });

	// A fit is said in two lines, not three sentences (third pass, 2026-09-24): the verdict names
	// whose word it is ("Kompatibilné podľa údajov výrobcu"), and the line under it names the car
	// and its roof — which is what the long sentence repeated. Every other verdict keeps its
	// sentence: "we do not know yet" and "it does not fit" need their explanation.
	const fitLine =
		!qualified && isFit(result.verdict) && vehicleLabel
			? [vehicleLabel, vehicleDetail].filter(Boolean).join(" · ")
			: null;

	return (
		<div
			className={cn("rounded-sm border border-current/15 px-4 py-3.5", TONE_CLASSES[tone], className)}
			// The verdict changes what the shopper is about to buy, so a screen reader
			// should hear it when it changes — but politely, mid-purchase.
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<span className="bg-surface-card mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-xs">
					<Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					{/* The verdict and its one action — "Zmeniť vozidlo" or "Vybrať vozidlo", or the way
					    to what does fit. Beside a two-line fit; under a verdict that needs its sentence,
					    which a button beside it squeezed into a narrow column. */}
					<div
						className={cn(
							"flex gap-x-4 gap-y-3",
							fitLine ? "flex-wrap items-start justify-between" : "flex-col items-start",
						)}
					>
						<div className={cn("min-w-0", fitLine ? "flex-1 basis-56" : "w-full")}>
							<p className="text-[0.9375rem] leading-snug font-bold">
								{qualified ? t("verdictQualified") : t(VERDICT_LABEL_KEY[result.verdict])}
							</p>
							{fitLine ? (
								<p className="mt-0.5 text-sm font-medium opacity-90">{fitLine}</p>
							) : (
								<>
									<p className="mt-0.5 text-sm opacity-90">
										{qualified ? t("verdictQualifiedDetail") : detail}
									</p>
									{vehicleDetail && <p className="mt-0.5 text-xs opacity-75">{vehicleDetail}</p>}
								</>
							)}
						</div>
						{action && <div className="shrink-0">{action}</div>}
					</div>

					{conditions.resolved.length > 0 && (
						<div className="mt-3">
							<p className="text-xs font-semibold tracking-wide uppercase opacity-80">
								{t("conditionsTitle")}
							</p>
							<ul className="mt-1 list-disc space-y-1 pl-4 text-sm opacity-90">
								{conditions.resolved.map((condition) => (
									<li key={`${condition.code}-${condition.text}`}>{condition.text}</li>
								))}
							</ul>
						</div>
					)}

					{conditions.unresolvedCount > 0 && (
						<p className="mt-2 text-sm font-medium opacity-90">
							{t("conditionsIncomplete", { count: conditions.unresolvedCount })}
						</p>
					)}

					{isDemo && <p className="mt-2 text-xs font-medium opacity-80">{t("demoNotice")}</p>}
				</div>
			</div>
		</div>
	);
}

function isFit(verdict: FitmentVerdict): boolean {
	return verdict === "VERIFIED_FIT" || verdict === "MANUFACTURER_FIT";
}
