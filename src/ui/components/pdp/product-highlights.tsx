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

/**
 * The parameters worth seeing before the description, in the order a shopper decides by — for a
 * bike carrier how many bikes and how much weight, for a box its volume and how it opens.
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

	const items = HIGHLIGHTS.flatMap(({ ref, icon }) => {
		const attribute = byRef.get(ref);
		if (!attribute?.attribute.name) return [];
		// A yes/no parameter is a feature only when it is a yes.
		if (attribute.attribute.inputType === "BOOLEAN" && !attribute.values.some((v) => v.boolean === true)) {
			return [];
		}
		const values = formatProductAttributeValue(attribute, locale, words);
		if (values.length === 0) return [];
		return [{ ref, icon, label: attribute.attribute.name, value: values.join(", ") }];
	}).slice(0, MAX_HIGHLIGHTS);

	if (items.length < 2) return null;

	// Under the buy box, as the approved page places them: warm tiles, the brown icon drawn
	// without a ring, the value in bold over its name. Two to a row in the purchase column.
	return (
		<section aria-label={t("keyFeatures")} className={className}>
			<ul className="grid grid-cols-2 gap-2.5 sm:gap-3">
				{items.map(({ ref, icon: Icon, label, value }) => (
					<li key={ref} className="bg-surface-muted flex items-center gap-3 rounded-sm px-3.5 py-3 sm:px-4">
						<Icon className="text-brand h-7 w-7 shrink-0" strokeWidth={2} aria-hidden="true" />
						<span className="min-w-0">
							<span className="text-text-primary block text-[0.9375rem] leading-tight font-bold tracking-[-0.01em] break-words">
								{value}
							</span>
							<span className="text-text-secondary mt-0.5 block text-xs leading-snug">{label}</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
