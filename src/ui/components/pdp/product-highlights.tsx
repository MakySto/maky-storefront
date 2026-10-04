import { getTranslations } from "next-intl/server";
import {
	BikeIcon,
	BluetoothIcon,
	FoldHorizontalIcon,
	PackageIcon,
	PanelTopOpenIcon,
	RotateCcwIcon,
	RulerIcon,
	ScaleIcon,
	SnowflakeIcon,
	ThermometerSnowflakeIcon,
	WeightIcon,
	ZapIcon,
	type LucideIcon,
} from "lucide-react";
import {
	formatProductAttributeValue,
	formatTemperatureRange,
	type AttributeInput,
} from "@/lib/product-attributes";
import {
	GENERIC_FACTS,
	templateFor,
	type FactIcon,
	type KeyFact,
	type ProductTemplate,
} from "@/lib/product-templates";
import { cn } from "@/lib/utils";

/** The icons a template names its facts by. */
const FACT_ICONS: Readonly<Record<FactIcon, LucideIcon>> = {
	bike: BikeIcon,
	bluetooth: BluetoothIcon,
	fold: FoldHorizontalIcon,
	opening: PanelTopOpenIcon,
	package: PackageIcon,
	ruler: RulerIcon,
	scale: ScaleIcon,
	snowflake: SnowflakeIcon,
	temperature: ThermometerSnowflakeIcon,
	tilt: RotateCcwIcon,
	weight: WeightIcon,
	zap: ZapIcon,
};

const MAX_HIGHLIGHTS = 4;

/**
 * The highlights that read as one finished phrase (owner, 2026-09-25): "Pre 2 bicykle",
 * "Nosnosť 60 kg" instead of a bare "2" or "60 kg" explained by small print under it. The value
 * is the attribute's own, formatted exactly as in the parameters table — the phrase only wraps
 * it. A value that does not fit its phrase (a count that is not a whole number) keeps the
 * two-line form, as does every attribute without a phrase.
 */
const PHRASE: Readonly<
	Record<
		string,
		| "highlightBikes"
		| "highlightLoad"
		| "highlightLoadPerBike"
		| "highlightPower"
		| "highlightVolume"
		| "highlightWeight"
	>
> = {
	"cfm:attribute:bike_capacity": "highlightBikes",
	"cfm:attribute:max_load": "highlightLoad",
	"cfm:attribute:max_load_per_bike": "highlightLoadPerBike",
	"cfm:attribute:rated_power": "highlightPower",
	"cfm:attribute:volume": "highlightVolume",
	"cfm:attribute:weight": "highlightWeight",
};

type Highlight = { key: string; icon: LucideIcon; value: string; label: string | null };

/**
 * The parameters worth seeing before the description, in the order a shopper decides by — for a
 * bike carrier how many bikes and how much weight, for a box its volume and how it opens, for a
 * car fridge its volume, its temperature range, its power and whether an app controls it. Each
 * is a short statement that stands on its own where it can be ("Pre 2 bicykle", "Nosnosť 60 kg",
 * "Vhodný pre e-bike"), else the value over its name.
 *
 * The page's template names the facts that come first (`@/lib/product-templates`); the generic
 * facts fill the band up to its limit, so a product that lacks one of its template's facts still
 * gets a full band.
 *
 * Only the product's own attributes, formatted like the parameters table below. The total load
 * and the load per bike are two different attributes and are shown as such; nothing is derived
 * (no per-bike limit worked out by division), and a "no" is never promoted into a feature. The
 * one thing written together is a range, from its two ends.
 */
export async function ProductHighlights({
	attributes,
	locale,
	className,
	template = templateFor(null),
}: {
	attributes: readonly AttributeInput[];
	locale: string;
	className?: string;
	template?: ProductTemplate;
}) {
	const t = await getTranslations({ locale, namespace: "product" });
	const words = { yes: t("yes"), no: t("no") };
	const byRef = new Map(attributes.map((a) => [a.attribute.externalReference ?? "", a]));

	const highlight = (fact: KeyFact): Highlight[] => {
		const icon = FACT_ICONS[fact.icon];
		if (fact.kind === "range") {
			const range = formatTemperatureRange(attributes, locale, (min, max) =>
				t("content.range", { min, max }),
			);
			return range
				? [{ key: "range:temperature", icon, value: range.short, label: t("content.temperatureRange") }]
				: [];
		}
		const { ref } = fact;
		const attribute = byRef.get(ref);
		if (!attribute?.attribute.name) return [];
		if (attribute.attribute.inputType === "BOOLEAN") {
			// A yes/no parameter is a feature only when it is a yes — and then its NAME is the
			// feature: "Vhodný pre e-bike", not "Áno" over "Vhodný pre e-bike".
			if (!attribute.values.some((v) => v.boolean === true)) return [];
			return [{ key: ref, icon, value: attribute.attribute.name, label: null }];
		}
		const values = formatProductAttributeValue(attribute, locale, words);
		if (values.length === 0) return [];
		const value = values.join(", ");
		const phrase = PHRASE[ref];
		if (phrase === "highlightBikes") {
			if (values.length === 1 && /^\d+$/.test(value.trim())) {
				return [{ key: ref, icon, value: t(phrase, { count: Number(value.trim()) }), label: null }];
			}
		} else if (phrase && values.length === 1) {
			return [{ key: ref, icon, value: t(phrase, { value }), label: null }];
		}
		return [{ key: ref, icon, value, label: attribute.attribute.name }];
	};

	// The template's facts first, then the generic ones, each key once.
	const seen = new Set<string>();
	const items = [...template.facts, ...GENERIC_FACTS]
		.flatMap(highlight)
		.filter(({ key }) => (seen.has(key) ? false : Boolean(seen.add(key))))
		.slice(0, MAX_HIGHLIGHTS);

	if (items.length < 2) return null;

	// One warm band across the page under the gallery and the buy box (third pass, 2026-09-24),
	// its items split by hairlines: in a row of four on a desktop, two by two on a phone. In the
	// buy column they left the gallery's side of the page empty. The hairlines are the band's
	// own colour showing through a 1px gap, so they follow any wrap and never dangle at an edge.
	return (
		<section aria-label={t("keyFeatures")} className={className}>
			<ul
				className={cn(
					"bg-border-default border-border-default grid grid-cols-2 gap-px overflow-hidden rounded-sm border",
					// An odd item out on a phone spans the row rather than leaving a hole.
					"[&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(odd)]:col-span-1",
					items.length === 2 && "lg:grid-cols-2",
					items.length === 3 && "lg:grid-cols-3",
					items.length === 4 && "lg:grid-cols-4",
				)}
			>
				{items.map(({ key, icon: Icon, label, value }) => (
					<li
						key={key}
						className="bg-surface-muted flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-3.5 sm:px-5"
					>
						<Icon className="text-brand h-7 w-7 shrink-0" strokeWidth={2} aria-hidden="true" />
						<span className="min-w-0">
							<span className="text-text-primary block text-[0.9375rem] leading-tight font-bold tracking-[-0.01em] break-words">
								{value}
							</span>
							{label && (
								<span className="text-text-secondary mt-0.5 block text-xs leading-snug">{label}</span>
							)}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
