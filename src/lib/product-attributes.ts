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

/**
 * A car fridge's own measurements. The unit is the one the CFM specification key carries
 * (`rated_power_w`, `net_volume_l`, `interior_height_mm`, `input_ac_current_a`,
 * `temperature_min_c`), which is where the catalogue got the number from.
 */
const CAR_FRIDGE_UNITS: Readonly<Record<string, string>> = {
	"cfm:attribute:rated_power": "W",
	"cfm:attribute:net_volume": "l",
	"cfm:attribute:interior_height": "mm",
	"cfm:attribute:input_current_ac": "A",
	"cfm:attribute:temperature_min": "°C",
	"cfm:attribute:temperature_max": "°C",
};

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
	...CAR_FRIDGE_UNITS,
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
	values: readonly { name?: string | null; boolean?: boolean | null }[];
};

/** The market's words for a yes/no parameter. */
export type YesNoWords = { readonly yes: string; readonly no: string };

/** The market's way of writing a count of years — "3 roky", "1 rok" — from the message catalogue's plural. */
type YearsFormat = (count: number) => string;

/**
 * A parameter counted in years. The number alone ("Záruka 3") says nothing about its unit, and a
 * unit cannot be a suffix string: the word changes with the number in most of the markets.
 */
const YEARS_REFERENCES: ReadonlySet<string> = new Set(["cfm:attribute:warranty_years"]);

/**
 * The parameters whose name may already say the unit. The catalogue names an attribute once for every
 * product and writes the unit in brackets when it has one: the production warranty is "Záruka (roky)",
 * and "Záruka (roky) 2 roky" says years twice.
 *
 * Only the units the car-fridge page added, and the years. The older units were always printed beside
 * their names, on pages that are live as they are, and stay exactly as they were.
 */
const NAME_MAY_STATE_UNIT: ReadonlySet<string> = new Set([
	...Object.keys(CAR_FRIDGE_UNITS),
	...YEARS_REFERENCES,
]);

/**
 * Parameters CFM keeps as ONE text joined with " | " (`LIST_SPEC_KEYS` of the CoolZ content
 * builder: the matrix reads them as a list). A page prints them as a list, not with the separator.
 */
const LIST_REFERENCES: ReadonlySet<string> = new Set([
	"cfm:attribute:cooling_modes",
	"cfm:attribute:interior_components",
]);

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

/** What every consumer sale carries by law, in years: the strip under the buy button says it unless the product says more. */
const STATUTORY_WARRANTY_YEARS = 2;

/** The longest warranty the strip will state. A larger figure is more likely a slip in the data than a promise. */
const MAX_STATED_WARRANTY_YEARS = 10;

/**
 * The product's own warranty in whole years, when its attribute `reference` says one longer than
 * the statutory two. Null in every other case, and the strip then keeps the statutory line:
 * no reference (the template does not read one), no such attribute, more than one value, a value
 * that is not a whole number in full ("3 roky", "2,5"), two years or fewer, or a figure over ten.
 * Nothing is guessed, so a product is never given a warranty its data does not state.
 */
export function extendedWarrantyYears(
	attributes: readonly AttributeInput[],
	reference: string | undefined,
): number | null {
	if (!reference) return null;
	const own = attributes.find((a) => a.attribute.externalReference === reference);
	const values = (own?.values ?? []).map((v) => v.name?.trim()).filter((n): n is string => Boolean(n));
	if (values.length !== 1) return null;
	const years = parseNumeric(values[0]);
	return years !== null &&
		Number.isInteger(years) &&
		years > STATUTORY_WARRANTY_YEARS &&
		years <= MAX_STATED_WARRANTY_YEARS
		? years
		: null;
}

/**
 * A value with the unit given, or none.
 *
 * Numbers go through Intl for the locale's decimal separator — sk-SK renders
 * `25,2`, and a hand-rolled `toString()` would render `25.2` and read as a typo
 * to a Slovak customer. The unit is joined with a non-breaking space so it can
 * never wrap onto its own line.
 */
const withUnit = (value: string, unit: string | undefined, locale: string): string => {
	const numeric = parseNumeric(value);

	if (numeric === null) {
		// Text, dropdown or boolean-as-dropdown ("Áno"/"Nie") — CFM already
		// authored these in the catalogue language. Never reformat.
		return value;
	}

	const formatted = formatNumber(numeric, locale, { maximumFractionDigits: 2 });
	return unit ? `${formatted}${NBSP}${unit}` : formatted;
};

/** One attribute value as display text, with the attribute's unit when one is proven. */
export function formatAttributeValue(
	value: string,
	attribute: AttributeInput["attribute"],
	locale: string,
): string {
	return withUnit(value, getAttributeUnit(attribute), locale);
}

/** A text as its lower-case words, split where the separator says. */
const wordsOf = (text: string, separator: RegExp): string[] =>
	text.toLowerCase().split(separator).filter(Boolean);

/** What stands in brackets in a name — "(roky)", "[W]" — as lower-case words. */
const bracketedWords = (name: string | null | undefined): string[] =>
	Array.from((name ?? "").matchAll(/[([]([^)\]]*)[)\]]/g), (match) => match[1] ?? "").flatMap((group) =>
		wordsOf(group, /[\s/,;]+/),
	);

/**
 * The market's words for years, read off the plural the table already prints them with ("rok",
 * "roky", "roka", "rokov") rather than listed again for twelve languages.
 */
const yearsWords = (years: YearsFormat): string[] =>
	[1, 1.5, 2, 5].flatMap((count) => wordsOf(years(count), /[^\p{L}]+/u));

/**
 * Whether the name already says the unit this page would write beside the value, in brackets as the
 * catalogue writes it. Only for `NAME_MAY_STATE_UNIT`, and only the unit we hold: "(kW)" is not "W",
 * so a name that says another unit keeps ours rather than have it guessed away.
 */
function nameStatesUnit(attribute: AttributeInput["attribute"], years?: YearsFormat): boolean {
	if (!NAME_MAY_STATE_UNIT.has(attribute.externalReference ?? "")) return false;
	const inName = bracketedWords(attribute.name);
	const unit = getAttributeUnit(attribute);
	if (unit) return inName.includes(unit.toLowerCase());
	if (!years) return false;
	const forYears = yearsWords(years);
	return inName.some((word) => forYears.includes(word));
}

/**
 * Every value of an attribute, formatted.
 *
 * A BOOLEAN attribute is answered from its flag, as `words.yes` / `words.no`. Saleor names such
 * a value "<attribute>: Yes", and the parameters table printed exactly that — "Sklopná funkcia |
 * Sklopná funkcia: Yes", in English on a Slovak page — until the 2026-09 redesign. Without the
 * words (or the flag) a boolean says nothing rather than repeat its own name.
 *
 * `nameBesideValue` is for a caller that prints the attribute's name next to its values, as the
 * parameters table does: a name that already says the unit ("Záruka (roky)") then gets the bare number.
 * Where the value stands without its name (the key-facts band: "Príkon 60 W") the unit is kept.
 */
export function formatProductAttributeValue(
	attribute: AttributeInput,
	locale: string,
	words?: YesNoWords,
	years?: YearsFormat,
	options: { nameBesideValue?: boolean } = {},
): string[] {
	if (attribute.attribute.inputType === "BOOLEAN") {
		return attribute.values
			.map((v) => (typeof v.boolean === "boolean" && words ? (v.boolean ? words.yes : words.no) : null))
			.filter((text): text is string => text !== null);
	}
	const reference = attribute.attribute.externalReference ?? "";
	const stated = options.nameBesideValue === true && nameStatesUnit(attribute.attribute, years);
	const unit = stated ? undefined : getAttributeUnit(attribute.attribute);
	return attribute.values
		.map((v) => v.name)
		.filter((n): n is string => Boolean(n && n.trim()))
		.flatMap((n) => {
			if (LIST_REFERENCES.has(reference) && n.includes("|")) {
				return n
					.split("|")
					.map((part) => part.trim())
					.filter(Boolean);
			}
			const count = YEARS_REFERENCES.has(reference) && years && !stated ? parseNumeric(n) : null;
			return count === null || !years ? [withUnit(n, unit, locale)] : [years(count)];
		});
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

const TEMPERATURE_MIN = "cfm:attribute:temperature_min";
const TEMPERATURE_MAX = "cfm:attribute:temperature_max";
const MINUS = "\u2212";

/**
 * The working temperature range, from its two ends — `−20 °C až +20 °C` for a parameter row and
 * `−20 až +20 °C` for a short fact — or null unless both ends are plain numbers. Nothing is
 * worked out: the two attributes are the product's own, the range is only how they are written
 * together, and a range with one end missing is not a range, so the ends stay separate rows.
 *
 * `join` is the market's way of saying "from … to …"; the caller takes it from the message
 * catalogue. A negative number is written with a real minus sign, and the upper end carries its
 * plus when the range crosses zero, as a thermometer does.
 */
export function formatTemperatureRange(
	attributes: readonly AttributeInput[],
	locale: string,
	join: (min: string, max: string) => string,
): { full: string; short: string } | null {
	const byRef = new Map(attributes.map((a) => [a.attribute.externalReference ?? "", a]));
	const min = parseNumeric(byRef.get(TEMPERATURE_MIN)?.values[0]?.name ?? "");
	const max = parseNumeric(byRef.get(TEMPERATURE_MAX)?.values[0]?.name ?? "");
	if (min === null || max === null || min > max) return null;

	const unit = UNIT_BY_EXTERNAL_REFERENCE[TEMPERATURE_MAX];
	const crosses = min < 0 && max > 0;
	const number = (value: number, signed: boolean): string =>
		formatNumber(value, locale, {
			maximumFractionDigits: 2,
			signDisplay: signed ? "exceptZero" : "auto",
		}).replace("-", MINUS);
	const low = number(min, false);
	const high = number(max, crosses);
	return {
		full: join(`${low}${NBSP}${unit}`, `${high}${NBSP}${unit}`),
		short: `${join(low, high)}${NBSP}${unit}`,
	};
}
