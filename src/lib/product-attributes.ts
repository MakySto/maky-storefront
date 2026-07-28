import { formatNumber } from "@/config/locale";

/**
 * Product attribute presentation — the single place a raw Saleor attribute
 * value becomes display text.
 *
 * Units live here rather than in JSX because they are a property of the
 * attribute, not of the component that happens to render it: the PDP, a future
 * comparison table and a spec sheet must all print "25,2 kg", never one of them
 * "25.2".
 *
 * Keyed on `externalReference` — the stable CFM identity ("cfm:attribute:weight").
 * The display name is translatable and the slug is Saleor-editable; neither is
 * safe to key on.
 */

const NBSP = " ";

/** CFM external reference -> display unit. */
const UNIT_BY_EXTERNAL_REFERENCE: Readonly<Record<string, string>> = {
	"cfm:attribute:max_load": "kg",
	"cfm:attribute:max_load_per_bike": "kg",
	"cfm:attribute:weight": "kg",
	"cfm:attribute:package_weight": "kg",
	"cfm:attribute:max_ski_length": "cm",
	"cfm:attribute:outer_height": "cm",
	"cfm:attribute:outer_length": "cm",
	"cfm:attribute:outer_width": "cm",
	"cfm:attribute:volume": "l",
	"cfm:attribute:max_speed": "km/h",
	// Deliberately absent, and NOT an oversight:
	//   bike_capacity   - a count, not a measurement
	//   max_tire_width  - no catalogue values yet; mm and inch are both plausible
	//   max_wheelbase   - no catalogue values yet; mm and cm are both plausible
	// An invented unit is a factual claim about the product. Leave them bare
	// until the CFM attribute contract states the unit.
};

/**
 * Saleor `MeasurementUnitsEnum` -> display.
 *
 * Every CFM attribute currently reports `unit: null`, so this is dormant. It is
 * here because native units are the better long-term source and this map is the
 * only thing the storefront would need. Note the enum has NO speed unit, so
 * `max_speed` can never be served natively.
 */
const UNIT_BY_MEASUREMENT_ENUM: Readonly<Record<string, string>> = {
	MM: "mm",
	CM: "cm",
	DM: "dm",
	M: "m",
	KM: "km",
	G: "g",
	KG: "kg",
	TONNE: "t",
	LITER: "l",
	CUBIC_CENTIMETER: "cm³",
	CUBIC_DECIMETER: "dm³",
	CUBIC_METER: "m³",
	SQ_CM: "cm²",
	SQ_M: "m²",
};

export type AttributeInput = {
	attribute: {
		name?: string | null;
		slug?: string | null;
		externalReference?: string | null;
		inputType?: string | null;
		unit?: string | null;
	};
	values: readonly { name?: string | null }[];
};

/** Display unit for an attribute, or undefined when none is proven. */
export function getAttributeUnit(attribute: AttributeInput["attribute"]): string | undefined {
	if (attribute.unit) {
		const native = UNIT_BY_MEASUREMENT_ENUM[attribute.unit];
		if (native) return native;
	}
	return attribute.externalReference ? UNIT_BY_EXTERNAL_REFERENCE[attribute.externalReference] : undefined;
}

/**
 * A value is numeric only if it is numeric IN FULL.
 *
 * `parseFloat` is not usable here: it reads "5–7 lyží / 3–5 snowboardov" as 5
 * and would silently render a real catalogue value as "5". Anchor the match so
 * anything carrying prose stays untouched text.
 */
const NUMERIC_ONLY = /^-?\d+(?:[.,]\d+)?$/;

const parseNumeric = (raw: string): number | null => {
	const trimmed = raw.trim();
	if (!NUMERIC_ONLY.test(trimmed)) return null;
	const n = Number.parseFloat(trimmed.replace(",", "."));
	return Number.isFinite(n) ? n : null;
};

/**
 * One attribute value as display text.
 *
 * Numbers go through Intl for the locale's decimal separator — sk-SK renders
 * `25,2`, and a hand-rolled `toString()` would render `25.2` and read as a typo
 * to a Slovak customer. The unit is joined with a non-breaking space so it can
 * never wrap onto its own line.
 */
export function formatAttributeValue(
	value: string,
	attribute: AttributeInput["attribute"],
	locale: string,
): string {
	const unit = getAttributeUnit(attribute);
	const numeric = parseNumeric(value);

	if (numeric === null) {
		// Text, dropdown or boolean-as-dropdown ("Áno"/"Nie") — CFM already
		// authored these in the catalogue language. Never reformat.
		return value;
	}

	const formatted = formatNumber(numeric, locale, { maximumFractionDigits: 2 });
	return unit ? `${formatted}${NBSP}${unit}` : formatted;
}

/** Every value of an attribute, formatted. */
export function formatProductAttributeValue(attribute: AttributeInput, locale: string): string[] {
	return attribute.values
		.map((v) => v.name)
		.filter((n): n is string => Boolean(n && n.trim()))
		.map((n) => formatAttributeValue(n, attribute.attribute, locale));
}

const DIMENSION_REFS = [
	"cfm:attribute:outer_length",
	"cfm:attribute:outer_width",
	"cfm:attribute:outer_height",
] as const;

/**
 * The three outer dimensions as one `232 × 92 × 45 cm` string, when all three
 * exist and share a unit. Returns null otherwise — a partial dimensions line is
 * worse than none, because the reader cannot tell which axis is missing.
 *
 * The individual rows stay; this is an additional summary, not a replacement.
 */
export function formatOuterDimensions(attributes: readonly AttributeInput[], locale: string): string | null {
	const byRef = new Map(attributes.map((a) => [a.attribute.externalReference ?? "", a]));
	const parts: number[] = [];
	const units = new Set<string>();

	for (const ref of DIMENSION_REFS) {
		const attr = byRef.get(ref);
		const raw = attr?.values[0]?.name;
		if (!attr || !raw) return null;
		const n = parseNumeric(raw);
		if (n === null) return null;
		parts.push(n);
		const unit = getAttributeUnit(attr.attribute);
		if (!unit) return null;
		units.add(unit);
	}

	if (units.size !== 1) return null;
	const unit = [...units][0];
	return `${parts
		.map((n) => formatNumber(n, locale, { maximumFractionDigits: 2 }))
		.join(" × ")}${NBSP}${unit}`;
}
