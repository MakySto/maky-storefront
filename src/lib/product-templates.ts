import { type ProductContentBlock } from "@/lib/editorjs";
import { type SpecFact } from "@/lib/editorjs-content";
import { SECTION_KINDS, type SectionKind } from "@/lib/editorjs-sanitize";

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
type LiftedSection = "comparison" | "documents" | "specs" | "kind" | "facts";

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
	| "opening"
	| "car"
	| "truck"
	| "calendar";

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
	/**
	 * Whether a product whose attributes give the band fewer than two facts opens with the first rows
	 * of the parameter sheet its description carries instead. A roof-rack set writes its figures in the
	 * description, so the band does not wait for attributes the set may never have.
	 */
	factsFromSheet: boolean;
	/** The technical parameters, grouped by the reference of the attribute each row comes from. */
	groups: readonly { id: ParameterGroupId; refs: readonly string[] }[];
	/**
	 * The attribute that carries the product's own warranty in years, for a kind of product whose
	 * warranty the owner has confirmed to be longer than the statutory two years. The line under the
	 * buy button then says that figure (`extendedWarrantyYears`). Absent, the line says the two years
	 * every sale carries: a template does not state a warranty nobody confirmed for its products, and a
	 * product with the attribute but another template keeps the statutory line.
	 */
	warrantyRef?: string;
	/**
	 * A description of this template that carries pictures of its own (`<figure>`) is set as sections —
	 * the sections of one card, their pictures beside the text, the questions and the closing in cards of
	 * their own (`layoutFor`, `descriptionSections`). A description without pictures of its own stays one
	 * card, as it was approved.
	 */
	sectionsWhenPictured?: boolean;
	/** Set by `layoutFor`: the description is laid out as one card per section (`descriptionSections`). */
	sections?: boolean;
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

const GENERIC: ProductTemplate = {
	id: "generic",
	lift: [],
	facts: GENERIC_FACTS,
	factsFromSheet: false,
	groups: [],
};

/**
 * A car fridge. The attribute keys are the ones CFM writes for the CoolZ range
 * (`ATTRIBUTE_TO_SPEC` in the CoolZ content builder); a row whose attribute is not in a group is
 * not lost, it goes to the last group, "other parameters".
 *
 * The warranty line under the buy button follows the product's own `warranty_years`: the owner
 * confirmed (2026-10-05) that the PRO-USER fridges carry three years, and CFM holds 3 for the five
 * CoolZ and 2 for CoolZ Power (TK20414), which therefore keeps the two-year line.
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
	factsFromSheet: false,
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
	warrantyRef: attr("warranty_years"),
};

/**
 * A roof-rack set (Nordrive, Thule). The parameters, like the rest of what it says, are in the
 * description, as a parameter sheet (`maky:specs`); the template does not need the product to carry
 * any attribute, and keeps the ones it has (the maker, say) in the same card under the sheet. It
 * sets the sheet in a card of its own, with a jump link, and opens the page with its first rows.
 * What is in the box, the benefits and the warnings stay in the description, in the order CFM wrote
 * them. Which attributes a production set carries was not read when this was written.
 */
const STRESNY_NOSIC: ProductTemplate = {
	id: "stresny-nosic",
	// The sheet, the short name of the kind of product (over the title) and the key facts (the band).
	lift: ["specs", "kind", "facts"],
	facts: [],
	factsFromSheet: true,
	groups: [],
	sectionsWhenPictured: true,
};

export const PRODUCT_TEMPLATES: Readonly<Record<string, ProductTemplate>> = {
	[AUTOCHLADNICKA.id]: AUTOCHLADNICKA,
	[STRESNY_NOSIC.id]: STRESNY_NOSIC,
};

/** The template a description names, or the generic one when it names none or an unknown one. */
export function templateFor(id: string | null | undefined): ProductTemplate {
	return (
		(id && Object.prototype.hasOwnProperty.call(PRODUCT_TEMPLATES, id) && PRODUCT_TEMPLATES[id]) || GENERIC
	);
}

// ─── Sections of the description ─────────────────────────────────────────────────────────────

/** Whether the description carries pictures of its own (`image` blocks), as against the gallery's. */
export function hasOwnPictures(blocks: readonly ProductContentBlock[]): boolean {
	return blocks.some((block) => block.html.includes("<figure"));
}

/**
 * The template a page is laid out with once its description has been read. A template that asks for
 * it (`sectionsWhenPictured`) sets a pictured description as sections; the gallery's second photo is
 * then not drawn beside the description (the page asks `template.sections`), because the description
 * shows its own and the same file would stand there twice. The documents stay in the section that
 * names them (the assembly), as the steps do.
 */
export function layoutFor(
	template: ProductTemplate,
	blocks: readonly ProductContentBlock[],
): ProductTemplate {
	if (!template.sectionsWhenPictured || !hasOwnPictures(blocks)) return template;
	return { ...template, sections: true };
}

/** A block that opens a section: a plain heading, or a role that carries its heading (`maky-h`). */
const SECTION_START = /^(?:<h3[\s>]|<section class="maky-blk[^"]*"><h3 class="maky-h">)/;

/**
 * The roles that carry out what the section before them describes, under a heading of their own: the
 * strengths a text has just introduced, the steps of a procedure, the documents of an assembly. They
 * stay in that section, under their own heading, and are not a section of one short list.
 */
const FOLLOWS_PREVIOUS =
	/^<section class="maky-blk[^"]*"><h3 class="maky-h">[\s\S]*?<(?:ul|ol) class="maky-(?:benefits|steps|docs)"/;

/**
 * The description's blocks cut into sections, in document order: a new section starts at every
 * heading the producer wrote (`h3`), and whatever stands before the first heading is a section of
 * its own. Nothing is dropped or reordered.
 */
export function descriptionSections(blocks: readonly string[]): string[][] {
	const sections: string[][] = [];
	for (const html of blocks) {
		if (sections.length === 0 || SECTION_START.test(html)) sections.push([html]);
		else sections[sections.length - 1].push(html);
	}
	return sections.reduce<string[][]>((merged, section) => {
		const previous = merged[merged.length - 1];
		if (previous && FOLLOWS_PREVIOUS.test(section[0])) previous.push(...section);
		else merged.push(section);
		return merged;
	}, []);
}

/** The kind of section a card opens with (`maky:section:<kind>` on its heading), or null. */
export function sectionKindOfHtml(section: readonly string[]): SectionKind | null {
	const found = /^<h3 class="maky-sec maky-sec-([a-z]+)">/.exec(section[0] ?? "");
	return found && (SECTION_KINDS as readonly string[]).includes(found[1]) ? (found[1] as SectionKind) : null;
}

/**
 * Whether a section stands in a card of its own after the parameters, not among the sections of the
 * description's one card: the questions and the closing.
 */
export function isTailSection(section: readonly string[]): boolean {
	return (
		sectionKindOfHtml(section) === "closing" || section.some((html) => html.includes('class="maky-faq"'))
	);
}

export interface PageSections {
	/** The blocks that stay in the description's card. */
	description: string[];
	/** The comparison, set in a card of its own, or null. */
	comparison: string | null;
	/** The documents, set in a card of their own, or null. */
	documents: { title: string | null; body: string } | null;
	/** The parameter sheet, set in a card of its own, or null. Its rows are also kept as plain text, for the key-facts band. */
	specs: { title: string | null; body: string; facts: readonly SpecFact[] } | null;
	/** The short name of the kind of product, to stand over the title, or null. */
	kind: string | null;
	/** The key facts the producer wrote for the band (`maky:facts`), or null. */
	facts: readonly SpecFact[] | null;
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
	const sections: PageSections = {
		description: [],
		comparison: null,
		documents: null,
		specs: null,
		kind: null,
		facts: null,
	};
	for (const block of blocks) {
		if (block.section === "kind" && template.lift.includes("kind") && !sections.kind && block.body) {
			sections.kind = block.body;
			continue;
		}
		if (
			block.section === "facts" &&
			template.lift.includes("facts") &&
			!sections.facts &&
			block.facts?.length
		) {
			sections.facts = block.facts;
			continue;
		}
		if (block.section === "comparison" && template.lift.includes("comparison") && !sections.comparison) {
			sections.comparison = block.html;
		} else if (block.section === "documents" && template.lift.includes("documents") && !sections.documents) {
			sections.documents = { title: block.title ?? null, body: block.body ?? block.html };
		} else if (block.section === "specs" && template.lift.includes("specs") && !sections.specs) {
			sections.specs = {
				title: block.title ?? null,
				body: block.body ?? block.html,
				facts: block.facts ?? [],
			};
		} else {
			sections.description.push(block.html);
		}
	}
	return sections;
}

/**
 * The longest value a cell of the key-facts band takes: a figure with its qualifier ("do 60 kg
 * (tejto konfigurácie pre vaše vozidlo)") still stands on two lines in a cell; anything longer
 * reads as a sentence and is not a fact.
 */
const MAX_FACT_LENGTH = 48;

/**
 * The rows of the parameter sheet the key-facts band may be made of, when the template says the band
 * comes from the sheet: the sheet's rows in the order CFM wrote them, without the ones whose value
 * reads as a sentence. Nothing is worked out and no row is reworded — the band shows what the sheet
 * says. The page's band takes them only when the product's attributes gave it too little.
 */
export function sheetFacts(sections: PageSections | null, template: ProductTemplate): readonly SpecFact[] {
	// The facts the producer wrote for the band come first, icons and all; the sheet's rows stand in for them.
	const own = sections?.facts?.filter(
		({ label, value }) => label && value && value.length <= MAX_FACT_LENGTH,
	);
	if (own?.length) return own;
	if (!template.factsFromSheet || !sections?.specs) return [];
	return sections.specs.facts.filter(({ label, value }) => label && value && value.length <= MAX_FACT_LENGTH);
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
