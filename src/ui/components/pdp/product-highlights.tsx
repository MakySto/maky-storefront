import { getTranslations } from "next-intl/server";
import {
	BikeIcon,
	FoldHorizontalIcon,
	PackageIcon,
	PanelTopOpenIcon,
	RotateCcwIcon,
	RulerIcon,
	ScaleIcon,
	SnowflakeIcon,
	WeightIcon,
	ZapIcon,
	type LucideIcon,
} from "lucide-react";
import { formatProductAttributeValue, type AttributeInput } from "@/lib/product-attributes";
import { cn } from "@/lib/utils";

/**
 * The parameters worth seeing before the description, in the order a shopper decides by — for a
 * bike carrier how many bikes and how much weight, for a box its volume and how it opens. Each is
 * a short statement that stands on its own where it can be ("Pre 2 bicykle", "Nosnosť 60 kg",
 * "Vhodný pre e-bike"), else the value over its name.
 *
 * Only the product's own attributes, formatted like the parameters table below. The total load
 * and the load per bike are two different attributes and are shown as such; nothing is derived
 * (no per-bike limit worked out by division), and a "no" is never promoted into a feature.
 */
const HIGHLIGHTS: readonly { ref: string; icon: LucideIcon }[] = [
	{ ref: "cfm:attribute:bike_capacity", icon: BikeIcon },
	{ ref: "cfm:attribute:volume", icon: PackageIcon },
	{ ref: "cfm:attribute:ski_snowboard_capacity", icon: SnowflakeIcon },
	{ ref: "cfm:attribute:max_load", icon: WeightIcon },
	{ ref: "cfm:attribute:max_load_per_bike", icon: WeightIcon },
	{ ref: "cfm:attribute:opening_type", icon: PanelTopOpenIcon },
	{ ref: "cfm:attribute:tilt_function", icon: RotateCcwIcon },
	{ ref: "cfm:attribute:ebike_compatible", icon: ZapIcon },
	{ ref: "cfm:attribute:max_ski_length", icon: RulerIcon },
	{ ref: "cfm:attribute:foldable", icon: FoldHorizontalIcon },
	{ ref: "cfm:attribute:weight", icon: ScaleIcon },
];

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
		"highlightBikes" | "highlightLoad" | "highlightLoadPerBike" | "highlightVolume" | "highlightWeight"
	>
> = {
	"cfm:attribute:bike_capacity": "highlightBikes",
	"cfm:attribute:max_load": "highlightLoad",
	"cfm:attribute:max_load_per_bike": "highlightLoadPerBike",
	"cfm:attribute:volume": "highlightVolume",
	"cfm:attribute:weight": "highlightWeight",
};

export async function ProductHighlights({
	attributes,
	locale,
	className,
}: {
	attributes: readonly AttributeInput[];
	locale: string;
	className?: string;
}) {
	const t = await getTranslations({ locale, namespace: "product" });
	const words = { yes: t("yes"), no: t("no") };
	const byRef = new Map(attributes.map((a) => [a.attribute.externalReference ?? "", a]));

	const items = HIGHLIGHTS.flatMap(
		({ ref, icon }): { ref: string; icon: LucideIcon; value: string; label: string | null }[] => {
			const attribute = byRef.get(ref);
			if (!attribute?.attribute.name) return [];
			if (attribute.attribute.inputType === "BOOLEAN") {
				// A yes/no parameter is a feature only when it is a yes — and then its NAME is the
				// feature: "Vhodný pre e-bike", not "Áno" over "Vhodný pre e-bike".
				if (!attribute.values.some((v) => v.boolean === true)) return [];
				return [{ ref, icon, value: attribute.attribute.name, label: null }];
			}
			const values = formatProductAttributeValue(attribute, locale, words);
			if (values.length === 0) return [];
			const value = values.join(", ");
			const phrase = PHRASE[ref];
			if (phrase === "highlightBikes") {
				if (values.length === 1 && /^\d+$/.test(value.trim())) {
					return [{ ref, icon, value: t(phrase, { count: Number(value.trim()) }), label: null }];
				}
			} else if (phrase && values.length === 1) {
				return [{ ref, icon, value: t(phrase, { value }), label: null }];
			}
			return [{ ref, icon, value, label: attribute.attribute.name }];
		},
	).slice(0, MAX_HIGHLIGHTS);

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
				{items.map(({ ref, icon: Icon, label, value }) => (
					<li
						key={ref}
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
