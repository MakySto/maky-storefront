import { describe, expect, it } from "vitest";
import { type ProductContentBlock } from "./editorjs";
import {
	GENERIC_FACTS,
	groupParameters,
	liftSections,
	PRODUCT_TEMPLATES,
	sheetFacts,
	TEMPERATURE_RANGE_REF,
	templateFor,
	type PageSections,
	type ParameterRow,
} from "./product-templates";

const attr = (key: string) => `cfm:attribute:${key}`;
const row = (key: string, label = key, values = ["x"]): ParameterRow => ({ ref: attr(key), label, values });

describe("templateFor", () => {
	it("answers the template a description names", () => {
		expect(templateFor("autochladnicka").id).toBe("autochladnicka");
	});

	it("answers the roof-rack template by its ASCII id, and no other spelling of it", () => {
		expect(templateFor("stresny-nosic").id).toBe("stresny-nosic");
		for (const name of ["strešný-nosič", "stresny_nosic", "Stresny-nosic", "stresny-nosic "]) {
			expect(templateFor(name).id, name).toBe("generic");
		}
	});

	it("answers the generic template for no name and for a name it does not know", () => {
		for (const name of [
			null,
			undefined,
			"",
			"strešný-nosič",
			"Autochladnicka",
			"constructor",
			"__proto__",
			"toString",
		]) {
			expect(templateFor(name).id, String(name)).toBe("generic");
		}
		// Generic is the page as it has always been: nothing lifted, no groups, the generic facts.
		const generic = templateFor("nope");
		expect(generic.lift).toEqual([]);
		expect(generic.groups).toEqual([]);
		expect(generic.facts).toBe(GENERIC_FACTS);
		expect(generic.factsFromSheet).toBe(false);
	});

	it("registers each template under its own id", () => {
		for (const [id, template] of Object.entries(PRODUCT_TEMPLATES)) expect(template.id).toBe(id);
	});
});

describe("liftSections", () => {
	const blocks: ProductContentBlock[] = [
		{ html: "<p>lead</p>" },
		{ html: "<section>benefits</section>" },
		{ html: "<div>comparison</div>", section: "comparison" },
		{
			html: "<section>documents</section>",
			section: "documents",
			title: "Na stiahnutie",
			body: "<ul>d</ul>",
		},
		{ html: "<p>after</p>" },
	];

	it("lifts nothing on the generic page: every block stays, in order, as before", () => {
		const sections = liftSections(blocks, templateFor(null));
		expect(sections.description).toEqual(blocks.map((block) => block.html));
		expect(sections.comparison).toBeNull();
		expect(sections.documents).toBeNull();
		expect(sections.specs).toBeNull();
	});

	it("lifts the comparison and the documents of a template that names them", () => {
		const sections = liftSections(blocks, templateFor("autochladnicka"));
		expect(sections.description).toEqual(["<p>lead</p>", "<section>benefits</section>", "<p>after</p>"]);
		expect(sections.comparison).toBe("<div>comparison</div>");
		expect(sections.documents).toEqual({ title: "Na stiahnutie", body: "<ul>d</ul>" });
	});

	it("lifts only the first of a kind; a second one stays in the description", () => {
		const second: ProductContentBlock = { html: "<div>second table</div>", section: "comparison" };
		const sections = liftSections([...blocks, second], templateFor("autochladnicka"));
		expect(sections.comparison).toBe("<div>comparison</div>");
		expect(sections.description.at(-1)).toBe("<div>second table</div>");
	});

	it("never loses a block: lifted and kept together are every block", () => {
		const sections = liftSections(blocks, templateFor("autochladnicka"));
		const lifted = [sections.comparison, sections.documents ? blocks[3].html : null].filter(Boolean);
		expect(sections.description.length + lifted.length).toBe(blocks.length);
	});

	it("keeps a block that names no section where it was", () => {
		const sections = liftSections([{ html: "<p>only</p>" }], templateFor("autochladnicka"));
		expect(sections).toEqual({
			description: ["<p>only</p>"],
			comparison: null,
			documents: null,
			specs: null,
		});
	});
});

describe("the roof-rack template", () => {
	const sheet: ProductContentBlock = {
		html: '<section class="maky-blk not-prose"><h3 class="maky-h">Technické parametre</h3>sheet</section>',
		section: "specs",
		title: "Technické parametre",
		body: "<div>sheet</div>",
		facts: [
			{ label: "Nosnosť", value: "do 75 kg (zostavy)" },
			{ label: "Dĺžka priečnikov", value: "127 cm" },
			{ label: "Nosnosť pre vozidlo", value: "do 60 kg (tejto konfigurácie pre vaše vozidlo)" },
			{
				label: "Poznámka",
				value: "Hodnota, ktorá je dlhšia než jedna veta v tabuľke parametrov, a ešte dlhšia",
			},
			{ label: "Materiál priečnikov", value: "Hliník" },
			{ label: "Profil", value: "Aerodynamický" },
			{ label: "Farba", value: "Strieborná" },
		],
	};
	const blocks: ProductContentBlock[] = [
		{ html: "<p>lead</p>" },
		{ html: "<section>box</section>" },
		sheet,
		{ html: "<p>usage</p>" },
		{ html: "<aside>warning</aside>" },
	];
	const rack = templateFor("stresny-nosic");

	it("takes the parameter sheet out of the description and keeps every other block, in order", () => {
		const sections = liftSections(blocks, rack);
		expect(sections.specs).toEqual({
			title: "Technické parametre",
			body: "<div>sheet</div>",
			facts: sheet.facts,
		});
		expect(sections.description).toEqual([
			"<p>lead</p>",
			"<section>box</section>",
			"<p>usage</p>",
			"<aside>warning</aside>",
		]);
		expect(sections.comparison).toBeNull();
		expect(sections.documents).toBeNull();
	});

	it("lifts only the first sheet; a second one stays in the description", () => {
		const second: ProductContentBlock = { ...sheet, html: "<section>second sheet</section>" };
		const sections = liftSections([...blocks, second], rack);
		expect(sections.description.at(-1)).toBe("<section>second sheet</section>");
	});

	it("is the only template that lifts a sheet: on another page it stays where CFM wrote it", () => {
		for (const name of [null, "autochladnicka"]) {
			const sections = liftSections(blocks, templateFor(name));
			expect(sections.specs, String(name)).toBeNull();
			expect(sections.description, String(name)).toContain(sheet.html);
		}
	});

	it("draws no lifted card from a block that has no title: the page names it itself", () => {
		const sections = liftSections([{ ...sheet, title: null }], rack);
		expect(sections.specs?.title).toBeNull();
	});

	describe("the key facts", () => {
		const sections = (specs: PageSections["specs"]): PageSections => ({
			description: [],
			comparison: null,
			documents: null,
			specs,
		});

		it("are the sheet's rows in the order CFM wrote them, as written", () => {
			const facts = sheetFacts(liftSections(blocks, rack), rack);
			expect(facts.map((f) => [f.label, f.value])).toEqual([
				["Nosnosť", "do 75 kg (zostavy)"],
				["Dĺžka priečnikov", "127 cm"],
				["Nosnosť pre vozidlo", "do 60 kg (tejto konfigurácie pre vaše vozidlo)"],
				["Materiál priečnikov", "Hliník"],
				["Profil", "Aerodynamický"],
				["Farba", "Strieborná"],
			]);
		});

		it("keep a figure with its qualifier, leave out a row whose value reads as a sentence, never reword one", () => {
			const facts = sheetFacts(liftSections(blocks, rack), rack);
			expect(facts.map((f) => f.label)).toContain("Nosnosť pre vozidlo");
			expect(facts.map((f) => f.label)).not.toContain("Poznámka");
			const written = new Map(sheet.facts?.map((f) => [f.label, f.value]));
			for (const f of facts) expect(f.value).toBe(written.get(f.label));
		});

		it("are none for a template that does not take them from the sheet", () => {
			const lifted = sections({ title: null, body: "x", facts: sheet.facts ?? [] });
			expect(sheetFacts(lifted, templateFor("autochladnicka"))).toEqual([]);
			expect(sheetFacts(lifted, templateFor(null))).toEqual([]);
		});

		it("are none without a sheet", () => {
			expect(sheetFacts(null, rack)).toEqual([]);
			expect(sheetFacts(sections(null), rack)).toEqual([]);
		});
	});
});

describe("groupParameters", () => {
	const fridge = templateFor("autochladnicka");
	const rows = [
		row("volume"),
		row("cooling_system"),
		row("noise_level"),
		row("rated_power"),
		row("dc_power_input"),
		row("package_weight"),
		row("bluetooth_app_control"),
		row("manufacturer"),
	];

	it("puts each row in its group, in the order the template lists the groups and the group's rows", () => {
		const groups = groupParameters(fridge, rows);
		expect(groups?.map((group) => group.id)).toEqual([
			"cooling",
			"power",
			"dimensions",
			"equipment",
			"other",
		]);
		expect(groups?.[0].rows.map((r) => r.ref)).toEqual([
			attr("volume"),
			attr("cooling_system"),
			attr("noise_level"),
		]);
		expect(groups?.[1].rows.map((r) => r.ref)).toEqual([attr("dc_power_input"), attr("rated_power")]);
	});

	it("leaves no row out: what no group names goes to `other`, in the order it came", () => {
		const groups = groupParameters(fridge, [...rows, row("zebra"), row("alpha")]) ?? [];
		expect(groups.at(-1)?.id).toBe("other");
		expect(groups.at(-1)?.rows.map((r) => r.ref)).toEqual([
			attr("manufacturer"),
			attr("zebra"),
			attr("alpha"),
		]);
		const all = groups.flatMap((group) => group.rows.map((r) => r.ref));
		expect(all.sort()).toEqual([...rows.map((r) => r.ref), attr("zebra"), attr("alpha")].sort());
	});

	it("has no empty group", () => {
		const groups = groupParameters(fridge, [row("volume"), row("cooling_system"), row("noise_level")]) ?? [];
		expect(groups.map((group) => group.id)).toEqual(["cooling"]);
	});

	it("keeps the flat list when the template has no groups or knows fewer than three of the rows", () => {
		expect(groupParameters(templateFor(null), rows)).toBeNull();
		expect(
			groupParameters(fridge, [row("volume"), row("cooling_system"), row("max_load"), row("foldable")]),
		).toBeNull();
		expect(groupParameters(fridge, [])).toBeNull();
	});

	it("places the derived temperature range by its own reference", () => {
		const range: ParameterRow = {
			ref: TEMPERATURE_RANGE_REF,
			label: "Rozsah teplôt",
			values: ["−20 °C až +20 °C"],
		};
		const groups = groupParameters(fridge, [row("volume"), range, row("noise_level")]) ?? [];
		expect(groups[0].rows.map((r) => r.ref)).toEqual([
			attr("volume"),
			TEMPERATURE_RANGE_REF,
			attr("noise_level"),
		]);
	});

	it("places a row once, even when a template names its reference in two groups", () => {
		const twice = {
			...fridge,
			groups: [
				{ id: "cooling" as const, refs: [attr("volume"), attr("noise_level")] },
				{ id: "power" as const, refs: [attr("volume"), attr("rated_power")] },
			],
		};
		const groups =
			groupParameters(twice, [row("volume"), row("noise_level"), row("rated_power"), row("zz")]) ?? [];
		expect(groups.map((group) => [group.id, group.rows.map((r) => r.ref)])).toEqual([
			["cooling", [attr("volume"), attr("noise_level")]],
			["power", [attr("rated_power")]],
			["other", [attr("zz")]],
		]);
	});
});
