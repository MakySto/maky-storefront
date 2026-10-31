/**
 * The facts a listing card prints about a roof-rack set, from CFM's own facets and nothing else.
 *
 * One function for every surface that lists sets — the vehicle page, the configurator and the
 * category shelf — so the same set says the same four things everywhere. Pure and free of
 * `server-only`: server components, client components and tests all call it.
 *
 * ## What it refuses to do
 *
 *   - **No default.** A facet the export does not carry yields no row. A missing load rating is
 *     not "0 kg" and a missing material is not "steel": absence is silence, never a value.
 *   - **No raw tokens.** The export's enumerations (`wing`, `tubular`, `alu` …) are English words
 *     for the shop's own data, not copy. A value this module has no word for yields no row, so a
 *     German page cannot print "wing" as a fact about the bar.
 *   - **Load is the bar's, not the car's.** `maxLoadKg` is what the set's own parts carry (the
 *     minimum over its components, withheld unless every component states one). It says nothing
 *     about what a given roof allows, and the label is "Traglast" for the set, not "allowed load".
 *
 * Four rows at most. The order is the order a shopper compares bars in: what they are made of, what
 * shape the bar is, how long it is, what the bars carry. The load comes last and is called what it
 * is — the bars' rating, not the roof's limit — so it cannot be read as permission.
 */

import { barsInName, sizeInName } from "./set-title";

export type SpecKey = "material" | "shape" | "length" | "load" | "colour" | "dimensions" | "bars";

export type SpecRow = { key: SpecKey; label: string; value: string };

/** A translator for the `configurator` namespace, from either `getTranslations` or `useTranslations`. */
export type SpecTranslator = (key: string, values?: Record<string, string | number>) => string;

/** The export's enumeration → the `configurator` message that words it. */
const SHAPE_KEY: Record<string, string> = {
	aero: "facetAero",
	aerodynamic: "facetAerodynamic",
	wing: "facetWing",
	square: "facetSquare",
	tubular: "facetTubular",
};

const MATERIAL_KEY: Record<string, string> = {
	aluminium: "facetAluminium",
	steel: "facetSteel",
};

const COLOUR_KEY: Record<string, string> = {
	black: "facetColourBlack",
	silver: "facetColourSilver",
	alu: "facetColourAlu",
};

/** How many rows a card gets. More turns a card into a datasheet; the product page has the rest. */
export const MAX_SPEC_ROWS = 4;

export function offerSpecs(
	facets: Readonly<Record<string, string | number | boolean>> | null | undefined,
	t: SpecTranslator,
	options: { max?: number } = {},
): SpecRow[] {
	if (!facets) return [];
	const rows: SpecRow[] = [];

	if (typeof facets.barMaterial === "string" && MATERIAL_KEY[facets.barMaterial]) {
		rows.push({
			key: "material",
			label: t("propertyBarMaterial"),
			value: t(MATERIAL_KEY[facets.barMaterial]!),
		});
	}
	if (typeof facets.barShape === "string" && SHAPE_KEY[facets.barShape]) {
		rows.push({ key: "shape", label: t("propertyBarShape"), value: t(SHAPE_KEY[facets.barShape]!) });
	}
	if (
		typeof facets.barLengthCm === "number" &&
		Number.isFinite(facets.barLengthCm) &&
		facets.barLengthCm > 0
	) {
		rows.push({ key: "length", label: t("propertyBarLength"), value: `${facets.barLengthCm} cm` });
	}
	// A load rating is a safety number: positive and finite, or it is not printed. It is the BARS'
	// rating and the label says so; what the roof allows is another limit, on another line.
	if (typeof facets.maxLoadKg === "number" && Number.isFinite(facets.maxLoadKg) && facets.maxLoadKg > 0) {
		rows.push({ key: "load", label: t("propertyBarLoad"), value: `${facets.maxLoadKg} kg` });
	}
	// Last, and only when the four above leave room: the colour is already in most names.
	if (typeof facets.barColour === "string" && COLOUR_KEY[facets.barColour]) {
		rows.push({ key: "colour", label: t("propertyColour"), value: t(COLOUR_KEY[facets.barColour]!) });
	}

	return rows.slice(0, options.max ?? MAX_SPEC_ROWS);
}

/** The words a name's own size is given a row with: the card's own, in the reader's language. */
export type NameSizeLabels = { dimensions: string; bars: string };

/**
 * What the set's name states about its size, put first: the size of a basket ("420 × 180 × 12 cm") or the bars
 * of a kit sold as loose bars ("4 tyče 180 cm"), and only where the rows do not already say a size.
 *
 * CFM's facets carry neither, and the name is the one place that does: four baskets of one van that differ only
 * in their size would otherwise look the same on a shelf. The numbers are the name's own (`sizeInName`,
 * `barsInName`), never worked out, and a name that states none leaves the rows as they were. Four rows at most,
 * the size taking the first of them.
 */
export function withNameSize<Row extends { key: string; label: string; value: string }>(
	rows: readonly Row[],
	name: string | null | undefined,
	labels: NameSizeLabels,
	max: number = MAX_SPEC_ROWS,
): (Row | { key: "dimensions" | "bars"; label: string; value: string })[] {
	if (!name || rows.some((row) => row.key === "dimensions" || row.key === "bars")) return [...rows];
	const size = sizeInName(name);
	const bars = size ? null : barsInName(name);
	const added = size
		? { key: "dimensions" as const, label: labels.dimensions, value: size }
		: bars
			? { key: "bars" as const, label: labels.bars, value: `${bars.count} × ${bars.lengthCm} cm` }
			: null;
	return added ? [added, ...rows].slice(0, max) : [...rows];
}

/** The `configurator` messages that word what a set contains. */
const INCLUDES_KEY: Record<string, string> = {
	bars: "includesBars",
	feet: "includesFeet",
	"fitting-kit": "includesFittingKit",
};

/**
 * What CFM documents the set to contain, in words ("priečniky, pätky, montážny kit"), or null.
 *
 * Absent `completeSet` in the export means the contents are UNKNOWN (a single documented component
 * does not evidence what is in the box), so null here is "we do not say", never "nothing else".
 */
export function describeIncludes(
	includes: readonly string[] | null | undefined,
	t: SpecTranslator,
): string | null {
	const words = (includes ?? [])
		.map((part) => (INCLUDES_KEY[part] ? t(INCLUDES_KEY[part]!) : null))
		.filter(Boolean);
	return words.length > 0 ? words.join(", ") : null;
}

/**
 * "Complete set" is the claim that what is in the box is enough to mount the bars on the car, and
 * the badge is worn only where the documentation says so part by part: the bars, the feet AND the
 * vehicle-specific fitting kit are all named in `completeSet.includes`.
 *
 * No rule about how roof-rack systems are packed is assumed here. Whether a kit comes with its feet
 * differs from one system to the next (Nordrive's Evos RA kit is sold with them; a fixpoint system
 * needs no kit at all), so "bars plus a kit" is not read as complete and "bars plus feet" is not
 * read as incomplete. A set documented any other way prints what is documented ("Obsahuje: …") and
 * wears no badge; absence of the badge is silence, never a claim that anything is missing. When CFM
 * documents a complete set in another shape, the shape is added here from the export, not guessed.
 */
export function isCompleteSet(includes: readonly string[] | null | undefined): boolean {
	return Boolean(includes?.includes("bars") && includes.includes("feet") && includes.includes("fitting-kit"));
}
