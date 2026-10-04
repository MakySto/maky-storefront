import { type ProductContentBlock } from "@/lib/editorjs";

/**
 * Product page templates: how a page is put together for a kind of product.
 *
 * A template is chosen by the NAME the description carries (`maky-content/1:autochladnicka`, see
 * `docs/contracts/maky-content.md`), and only by that: a product without a name, or with one this
 * registry does not know, gets the generic template, which is the page as it has always been. A
 * template never changes what a product says. It says which parts of the description get a card
 * of their own, which key facts open the page, and how the parameters the storefront already
 * holds are grouped.
 *
 * Everything here is data and pure functions, so the pages and the tests read the same registry.
 */

/** The parts of a description a template may set as sections of their own. */
type LiftedSection = "comparison" | "documents";

export type FactIcon =
	| "bike"
	| "bluetooth"
	| "fold"
	| "package"
	| "ruler"
	| "scale"
	| "snowflake"
	| "temperature"
	| "tilt"
	| "weight"
	| "zap"
	| "opening";

/** A fact of the key-facts band: one attribute, or the range two of them span. */
export type KeyFact = { kind: "attribute"; ref: string; icon: FactIcon } | { kind: "range"; icon: FactIcon };

type ParameterGroupId = "cooling" | "power" | "dimensions" | "equipment";

/** The pseudo-reference of the working temperature range: the two attributes it is written from. */
export const TEMPERATURE_RANGE_REF = "derived:temperature_range";

export interface ProductTemplate {
	id: string;
	/** Parts of the description that stand in cards of their own, and the order they follow it in. */
	lift: readonly LiftedSection[];
	/** The facts that open the page first; the generic facts fill the band up to its limit. */
	facts: readonly KeyFact[];
	/** The technical parameters, grouped by the reference of the attribute each row comes from. */
	groups: readonly { id: ParameterGroupId; refs: readonly string[] }[];
}

const attr = (key: string): string => `cfm:attribute:${key}`;
const fact = (key: string, icon: FactIcon): KeyFact => ({ kind: "attribute", ref: attr(key), icon });

/**
 * What every product's band starts from: the parameters worth seeing before the description, in
 * the order a shopper decides by — for a bike carrier how many bikes and how much weight, for a
 * box its volume and how it opens.
 */
export const GENERIC_FACTS: readonly KeyFact[] = [
	fact("bike_capacity", "bike"),
	fact("volume", "package"),
	fact("ski_snowboard_capacity", "snowflake"),
	fact("max_load", "weight"),
	fact("max_load_per_bike", "weight"),
	fact("opening_type", "opening"),
	fact("tilt_function", "tilt"),
	fact("ebike_compatible", "zap"),
	fact("max_ski_length", "ruler"),
	fact("foldable", "fold"),
	fact("weight", "scale"),
];

const GENERIC: ProductTemplate = { id: "generic", lift: [], facts: GENERIC_FACTS, groups: [] };

/**
 * A car fridge. The attribute keys are the ones CFM writes for the CoolZ range
 * (`ATTRIBUTE_TO_SPEC` in the CoolZ content builder); a row whose attribute is not in a group is
 * not lost, it goes to the last group, "other parameters".
 */
const AUTOCHLADNICKA: ProductTemplate = {
	id: "autochladnicka",
	lift: ["comparison", "documents"],
	facts: [
		fact("volume", "package"),
		{ kind: "range", icon: "temperature" },
		fact("rated_power", "zap"),
		fact("bluetooth_app_control", "bluetooth"),
	],
	groups: [
		{
			id: "cooling",
			refs: [
				attr("volume"),
				attr("net_volume"),
				TEMPERATURE_RANGE_REF,
				attr("temperature_min"),
				attr("temperature_max"),
				attr("cooling_system"),
				attr("dual_zone"),
				attr("refrigerant"),
				attr("cooling_modes"),
				attr("climate_class"),
				attr("noise_level"),
			],
		},
		{
			id: "power",
			refs: [
				attr("ac_power_input"),
				attr("dc_power_input"),
				attr("rated_power"),
				attr("input_current_ac"),
				attr("input_current_dc"),
			],
		},
		{
			id: "dimensions",
			refs: [
				attr("interior_height"),
				attr("package_dimensions_text"),
				attr("weight"),
				attr("package_weight"),
			],
		},
		{
			id: "equipment",
			refs: [
				attr("interior_components"),
				attr("bluetooth_app_control"),
				attr("battery_protection"),
				attr("built_in_led_light"),
				attr("bottle_opener"),
				attr("removable_wire_rack"),
				attr("material"),
				attr("warranty_years"),
			],
		},
	],
};

export const PRODUCT_TEMPLATES: Readonly<Record<string, ProductTemplate>> = {
	[AUTOCHLADNICKA.id]: AUTOCHLADNICKA,
};

/** The template a description names, or the generic one when it names none or an unknown one. */
export function templateFor(id: string | null | undefined): ProductTemplate {
	return (
		(id && Object.prototype.hasOwnProperty.call(PRODUCT_TEMPLATES, id) && PRODUCT_TEMPLATES[id]) || GENERIC
	);
}

// ─── Sections of the description ─────────────────────────────────────────────────────────────

export interface PageSections {
	/** The blocks that stay in the description's card. */
	description: string[];
	/** The comparison, set in a card of its own, or null. */
	comparison: string | null;
	/** The documents, set in a card of their own, or null. */
	documents: { title: string | null; body: string } | null;
}

/**
 * Split a description into the card it stays in and the sections the template lifts out of it.
 * Only the first block of each lifted kind is lifted, and only if the template names the kind;
 * everything else stays in the description, in document order.
 */
export function liftSections(
	blocks: readonly ProductContentBlock[],
	template: ProductTemplate,
): PageSections {
	const sections: PageSections = { description: [], comparison: null, documents: null };
	for (const block of blocks) {
		if (block.section === "comparison" && template.lift.includes("comparison") && !sections.comparison) {
			sections.comparison = block.html;
		} else if (block.section === "documents" && template.lift.includes("documents") && !sections.documents) {
			sections.documents = { title: block.title ?? null, body: block.body ?? block.html };
		} else {
			sections.description.push(block.html);
		}
	}
	return sections;
}

// ─── Grouped parameters ──────────────────────────────────────────────────────────────────────

export interface ParameterRow {
	/** The attribute's reference, or `TEMPERATURE_RANGE_REF` for the derived range. */
	ref: string;
	label: string;
	values: string[];
}

interface ParameterGroup {
	/** A template's group, or `other` for what no group of the template names. */
	id: ParameterGroupId | "other";
	rows: ParameterRow[];
}

/** Fewer named rows than this and the grouping says nothing: the page keeps its flat list. */
const MIN_GROUPED_ROWS = 3;

/**
 * Put the rows in the template's groups, in the order the template lists them. A row no group
 * names goes to a last group, `other`, in the order it came; no row is dropped. Answers null when
 * the template has no groups or fewer than three rows fall in a named one — a product whose
 * attributes the template does not know keeps the list it always had.
 */
export function groupParameters(
	template: ProductTemplate,
	rows: readonly ParameterRow[],
): ParameterGroup[] | null {
	if (template.groups.length === 0) return null;

	const byRef = new Map(rows.map((row) => [row.ref, row]));
	const taken = new Set<string>();
	const groups: ParameterGroup[] = [];
	for (const { id, refs } of template.groups) {
		const members = refs.flatMap((ref) => {
			const row = byRef.get(ref);
			if (!row || taken.has(ref)) return [];
			taken.add(ref);
			return [row];
		});
		if (members.length > 0) groups.push({ id, rows: members });
	}
	if (taken.size < MIN_GROUPED_ROWS) return null;

	const rest = rows.filter((row) => !taken.has(row.ref));
	if (rest.length > 0) groups.push({ id: "other", rows: rest });
	return groups;
}
