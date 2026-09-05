import { getTranslations } from "next-intl/server";
import { AlertTriangle, Check, CircleHelp, Globe, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { type FitmentCondition, type FitmentResult, type FitmentVerdict } from "@/lib/fitment/contract";
import {
	CONDITION_LABEL_KEY,
	TONE_CLASSES,
	toneForVerdict,
	VERDICT_DETAIL_KEY,
	VERDICT_LABEL_KEY,
} from "./verdict-presentation";

/**
 * The compatibility answer, rendered next to the purchase button.
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
	/** Rendered under the verdict — the "choose a vehicle" affordance. */
	action?: React.ReactNode;
	/** True when the answer came from committed test data rather than CFM. */
	isFixture?: boolean;
	className?: string;
};

const VERDICT_ICON: Record<FitmentVerdict, typeof Check> = {
	VERIFIED_FIT: Check,
	NO_FIT: X,
	UNKNOWN: CircleHelp,
	AMBIGUOUS: CircleHelp,
	STALE: AlertTriangle,
	PROVIDER_UNAVAILABLE: AlertTriangle,
	UNIVERSAL: Globe,
	NO_VEHICLE_SELECTED: CircleHelp,
};

export async function CompatibilityBox({ result, vehicleLabel, action, isFixture, className }: Props) {
	const t = await getTranslations("fitment");
	const tone = toneForVerdict(result.verdict);
	const Icon = VERDICT_ICON[result.verdict];

	// Every detail string that mentions a vehicle takes {vehicle}. With no vehicle
	// resolved we must not print an empty gap, so the generic prompt is used instead.
	const detailKey = VERDICT_DETAIL_KEY[result.verdict];
	const needsVehicle = detailKey !== "verdictSelectVehicleDetail" && detailKey !== "verdictUniversalDetail";
	const detail =
		needsVehicle && !vehicleLabel
			? t("verdictSelectVehicleDetail")
			: t(detailKey, { vehicle: vehicleLabel ?? "" });

	return (
		<div
			className={cn("rounded-lg border border-current/15 p-4", TONE_CLASSES[tone], className)}
			// The verdict changes what the shopper is about to buy, so a screen reader
			// should hear it when it changes — but politely, mid-purchase.
			aria-live="polite"
		>
			<div className="flex items-start gap-3">
				<Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold">{t(VERDICT_LABEL_KEY[result.verdict])}</p>
					<p className="mt-1 text-sm opacity-90">{detail}</p>

					{result.conditions.length > 0 && (
						<ConditionList conditions={result.conditions} title={t("conditionsTitle")} labelFor={t} />
					)}

					{isFixture && <p className="mt-2 text-xs font-medium opacity-80">{t("fixtureNotice")}</p>}

					{action && <div className="mt-3">{action}</div>}
				</div>
			</div>
		</div>
	);
}

/**
 * Mounting conditions.
 *
 * A condition with neither source copy for this locale nor a known code is DROPPED
 * rather than rendered in Slovak on a German page. Silence is the honest fallback: an
 * untranslated mounting instruction is worse than none, because it looks authoritative.
 */
function ConditionList({
	conditions,
	title,
	labelFor,
}: {
	conditions: FitmentCondition[];
	title: string;
	labelFor: (key: string) => string;
}) {
	const rendered = conditions
		.map((condition) => {
			const known = CONDITION_LABEL_KEY[condition.code];
			return known ? labelFor(known) : null;
		})
		.filter((text): text is string => Boolean(text));

	if (rendered.length === 0) return null;

	return (
		<div className="mt-3">
			<p className="text-xs font-semibold tracking-wide uppercase opacity-80">{title}</p>
			<ul className="mt-1 list-disc space-y-1 pl-4 text-sm opacity-90">
				{rendered.map((text) => (
					<li key={text}>{text}</li>
				))}
			</ul>
		</div>
	);
}
