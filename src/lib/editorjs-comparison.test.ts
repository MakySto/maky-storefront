import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The model comparison table (`docs/contracts/comparison-table.md`).
 *
 * The document under test is not typed out here: `coolz-32.description.json` is what CFM's
 * publisher sends Saleor for CoolZ 32, written by the producer itself and read back from Saleor
 * 3.23.31 unchanged (the file's provenance is next to it). The same bytes sit in the CFM
 * repository, where a test regenerates them from the producer, so the two sides cannot drift
 * apart without one of the two tests failing.
 *
 * The fixed words come from the real message catalogues through next-intl's own formatter, as on
 * the page, so a plural that does not parse in some market fails here and not on a product page.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const load = (locale: string) =>
	JSON.parse(readFileSync(join(ROOT, "src/i18n/messages", `${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

import { getComparisonLabels } from "@/lib/comparison-labels";
import { parseEditorJSToHtml, parseEditorJSToText, type ComparisonLabels } from "./editorjs";

const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
] as const;

const SAMPLE = readFileSync(join(ROOT, "docs/contracts/comparison-table/coolz-32.description.json"), "utf8");
type Block = { type: string; data: Record<string, unknown> };
const sample = JSON.parse(SAMPLE) as { blocks: Block[] };
const TABLE = sample.blocks.find((block) => block.type === "table") as Block;
const CELLS = TABLE.data.content as string[][];

const document = (blocks: unknown[]) => JSON.stringify({ time: 1, version: "2.30", blocks });
const table = (content: string[][], extra: Record<string, unknown> = {}): Block => ({
	type: "table",
	data: { withHeadings: true, content, ...extra },
});
const MODELS = ["CoolZ 19", "CoolZ 32", "CoolZ 40", "CoolZ 65", "CoolZ 83"];
const header = (current: number | null = 1) => [
	"Parameter",
	...MODELS.map((name, index) => (index === current ? `<mark>${name}</mark>` : name)),
];

let sk: ComparisonLabels;
beforeAll(async () => {
	sk = await getComparisonLabels("sk-SK");
});

const render = (content: string, labels: ComparisonLabels = sk): string =>
	(parseEditorJSToHtml(content, { comparison: labels }) ?? []).join("\n");
/** Only the comparison block: the producer's document holds a page of other text before it. */
const compare = (content: string, labels: ComparisonLabels = sk): string => {
	const html = render(content, labels);
	const at = html.indexOf('<div class="maky-cmp">');
	return at >= 0 ? html.slice(at) : html;
};
const count = (html: string, pattern: RegExp): number => html.match(pattern)?.length ?? 0;
const rowsOf = (html: string): string[] => html.match(/<tr[ >][\s\S]*?<\/tr>/g) ?? [];
const cellsOf = (row: string): string[] => row.match(/<td[ >][\s\S]*?<\/td>/g) ?? [];

describe("the producer's CoolZ 32 document", () => {
	it("is a Saleor-safe table: headings, equal rows, string cells only", () => {
		expect(TABLE.data.withHeadings).toBe(true);
		expect(Object.keys(TABLE.data).sort()).toEqual(["content", "withHeadings"]);
		expect(new Set(CELLS.map((row) => row.length))).toEqual(new Set([6]));
		expect(CELLS.flat().every((cell) => typeof cell === "string")).toBe(true);
		expect(CELLS[0][2]).toBe("<mark>CoolZ 32</mark>");
		// The block above the table is its title.
		const at = sample.blocks.indexOf(TABLE);
		expect(sample.blocks[at - 1]).toMatchObject({
			type: "header",
			data: { text: expect.stringContaining("Porovnanie") },
		});
	});

	it("is set as one comparison table with the current model highlighted", () => {
		const html = compare(SAMPLE);

		expect(count(html, /class="maky-cmp"/g)).toBe(1);
		expect(count(html, /<table class="maky-cmp-table">/g)).toBe(1);

		const [head, ...body] = rowsOf(html);
		const names = [...head.matchAll(/<span class="maky-cmp-name">([^<]*)<\/span>/g)].map((match) => match[1]);
		expect(names).toEqual(MODELS);
		expect(count(head, /<th scope="col" class="maky-cmp-self">/g)).toBe(1);
		expect(head).toMatch(
			new RegExp(
				`<th scope="col" class="maky-cmp-self"><span class="maky-cmp-you">${sk.thisModel}</span><span class="maky-cmp-name">CoolZ 32</span></th>`,
			),
		);

		// Every row that holds one value per model carries the highlight in the second column, and
		// only there. Group titles and the single-value band have no model columns.
		const valueRows = body.filter((row) => cellsOf(row).length === 5);
		expect(valueRows).toHaveLength(11);
		for (const row of valueRows) {
			const cells = cellsOf(row);
			expect(cells.map((cell) => cell.includes("maky-cmp-self"))).toEqual([false, true, false, false, false]);
		}
	});

	it("sets the parts, then gathers what is the same for every model into one band", () => {
		const html = compare(SAMPLE);
		const groups = rowsOf(html).filter((row) => row.startsWith('<tr class="maky-cmp-grp'));
		const titles = groups.map((row) => row.replace(/<[^>]+>/g, ""));
		expect(titles).toEqual(["Objem a výkon", "Rozmery a hmotnosť", sk.sameForAll]);
		expect(groups[2]).toContain("maky-cmp-common");

		const band = rowsOf(html).filter((row) => row.includes('class="maky-cmp-same"'));
		expect(band).toHaveLength(6);
		for (const row of band) expect(row).toContain('colspan="5"');
		const labels = band.map((row) => row.match(/<th scope="row">([^<]*)<\/th>/)?.[1]);
		expect(labels).toEqual([
			"Chladivo",
			"Rozsah teplôt",
			"Napájanie",
			"Hlučnosť",
			"Klimatická trieda",
			"Záruka",
		]);
		expect(html).toContain("R600a");
		expect(html).toContain("12/24 V DC · 100–240 V AC");
		// Each of those values is said once, not once per model.
		expect(count(html, /R600a/g)).toBe(1);
	});

	it("keeps the producer's units, the escaped less-than sign and the table's own title", () => {
		const html = compare(SAMPLE);
		for (const value of [
			"19 l",
			"32 l",
			"82,5 l",
			"45 W",
			"80 W",
			"330 mm",
			"669 × 374 × 398 mm",
			"8,9 kg",
			"23,3 kg",
		]) {
			expect(html).toContain(value);
		}
		expect(html).toContain("&lt; 45 dB");
		expect(html).not.toMatch(/< 45/);

		// The heading above the table became the table's title and is not printed twice.
		expect(count(render(SAMPLE), /<h2>Porovnanie modelov PRO-USER CoolZ<\/h2>/g)).toBe(1);
		expect(html).toContain(`<span class="maky-cmp-cap">${sk.models(5)}</span>`);
		expect(html).toContain('<caption class="maky-cmp-sr">Porovnanie modelov PRO-USER CoolZ</caption>');
	});

	it("shows yes as a mark with its word, no as a word, and nothing as a dash", () => {
		const html = compare(SAMPLE);
		expect(count(html, /class="maky-cmp-yes"/g)).toBe(1);
		expect(html).toContain(`<span class="maky-cmp-sr">${sk.yes}</span>`);
		expect(count(html, new RegExp(`<span class="maky-cmp-no">${sk.no}</span>`, "g"))).toBe(4);
		expect(count(html, /<span class="maky-cmp-nil">—<\/span>/g)).toBe(8);
		// The source glyphs are the format's, not the shopper's.
		expect(html).not.toMatch(/[✓✗]/);
	});

	it("scrolls in a box of its own that a keyboard can reach and a screen reader names", () => {
		const html = compare(SAMPLE);
		expect(html).toContain(
			`<div class="maky-cmp-scroll" tabindex="0" role="region" aria-label="${sk.scrollRegion}">`,
		);
	});

	it.each([1, 2, 3, 4, 5])("highlights the column the producer marks (column %i)", (column) => {
		const moved = CELLS.map((row) => [...row]);
		moved[0] = header(column - 1);
		const blocks = sample.blocks.map((block) => (block === TABLE ? table(moved) : block));
		const html = compare(document(blocks));

		const [head, ...body] = rowsOf(html);
		const marked = [...head.matchAll(/<th scope="col"( class="maky-cmp-self")?>/g)].map((match) =>
			Boolean(match[1]),
		);
		expect(marked).toEqual([false, ...MODELS.map((_, index) => index === column - 1)]);
		for (const row of body.filter((candidate) => cellsOf(candidate).length === 5)) {
			expect(cellsOf(row).map((cell) => cell.includes("maky-cmp-self"))).toEqual(
				MODELS.map((_, index) => index === column - 1),
			);
		}
	});
});

describe("every market speaks its own words", () => {
	it("Slovakia reads exactly this", async () => {
		const labels = await getComparisonLabels("sk-SK");
		expect(labels.thisModel).toBe("Tento model");
		expect(labels.sameForAll).toBe("Rovnaké pre všetky modely");
		expect([1, 2, 5].map(labels.models)).toEqual(["1 model", "2 modely", "5 modelov"]);
		expect([labels.yes, labels.no]).toEqual(["Áno", "Nie"]);
	});

	it.each(LOCALES)("%s: the table's own words come from the catalogue, not the document", async (locale) => {
		const labels = await getComparisonLabels(locale);
		const html = compare(SAMPLE, labels);
		expect(html).toContain(`<span class="maky-cmp-you">${labels.thisModel}</span>`);
		expect(html).toContain(`<span class="maky-cmp-cap">${labels.models(5)}</span>`);
		expect(html).toContain(`<span class="maky-cmp-gl">${labels.sameForAll}</span>`);
		expect(html).toContain(`aria-label="${labels.scrollRegion}"`);
		expect(html).toContain(`<span class="maky-cmp-sr">${labels.yes}</span>`);
		expect(html).toContain(`<span class="maky-cmp-no">${labels.no}</span>`);
		expect(html).toContain(`<span class="maky-cmp-sr">${labels.parameter}</span>`);
		// Fixed words are never empty, and "5 models" counts.
		for (const word of [
			labels.thisModel,
			labels.sameForAll,
			labels.scrollRegion,
			labels.parameter,
			labels.yes,
			labels.no,
		]) {
			expect(word.trim()).not.toBe("");
		}
		expect(labels.models(5)).toContain("5");
	});

	it.each(LOCALES)("%s: the count formats for every number a family can have", async (locale) => {
		const { models } = await getComparisonLabels(locale);
		for (const count of [0, 1, 2, 3, 4, 5, 6, 11, 12, 21, 22, 25]) {
			expect(models(count)).toContain(String(count));
		}
	});

	it("inflects the count where the language does", async () => {
		const pl = await getComparisonLabels("pl-PL");
		expect([1, 2, 5].map(pl.models)).toEqual(["1 model", "2 modele", "5 modeli"]);
		const cs = await getComparisonLabels("cs-CZ");
		expect([1, 2, 5].map(cs.models)).toEqual(["1 model", "2 modely", "5 modelů"]);
	});

	it("a German page shows the German fixed words and none of the Slovak ones", async () => {
		const de = await getComparisonLabels("de-DE");
		const html = compare(SAMPLE, de);
		for (const slovak of [sk.thisModel, sk.sameForAll, sk.scrollRegion, sk.no]) {
			expect(html).not.toContain(`>${slovak}<`);
		}
		expect(html).not.toContain(sk.scrollRegion);
		expect(html).toContain(`<span class="maky-cmp-you">${de.thisModel}</span>`);
		expect(de.thisModel).toBe("Dieses Modell");
	});
});

describe("anything that is not a comparison stays the table it was", () => {
	const plain = (html: string) => {
		expect(html).toContain('<div class="maky-prose-scroll">');
		expect(html).not.toContain("maky-cmp");
	};

	it("without the labels, even the producer's document renders as the plain scrolling table", () => {
		const html = (parseEditorJSToHtml(SAMPLE) ?? []).join("\n");
		plain(html);
		expect(html).toContain("<th><mark>CoolZ 32</mark></th>");
		expect(html).toContain("<td>R600a</td>");
		expect(count(html, /<table>/g)).toBe(1);
	});

	it("text extraction still reads the cells, without markup", () => {
		const text = parseEditorJSToText(SAMPLE) ?? "";
		expect(text).toContain("CoolZ 32");
		expect(text).toContain("R600a");
		expect(text).not.toContain("<mark>");
	});

	it.each([
		[
			"two columns",
			[
				["Parameter", "Hodnota"],
				["Nosnosť", "75 kg"],
				["Šírka", "130 cm"],
			],
			{},
		],
		[
			"three columns with no marker of its own",
			[
				["Parameter", "A", "B"],
				["Nosnosť", "75 kg", "80 kg"],
				["Šírka", "130 cm", "140 cm"],
			],
			{},
		],
		[
			"no heading row",
			[
				["Parameter", "A", "B"],
				["Nosnosť", "75 kg", "80 kg"],
			],
			{ withHeadings: false },
		],
		[
			"ragged rows",
			[
				["Parameter", "A", "<mark>B</mark>"],
				["Nosnosť", "75 kg"],
			],
			{},
		],
		[
			"a highlight in the body and none in the header",
			[
				["Parameter", "A", "B"],
				["Nosnosť", "<mark>75 kg</mark>", "80 kg"],
			],
			{},
		],
		["a single row", [["Parameter", "A", "<mark>B</mark>"]], {}],
	] as Array<[string, string[][], Record<string, unknown>]>)("%s", (_name, content, extra) => {
		plain(render(document([table(content, extra)])));
	});

	it("leaves a comparison-looking table with a script in a cell safe", () => {
		const html = render(
			document([
				table([
					["Parameter", "<mark>A</mark>", "B"],
					["x", "<script>alert(1)</script>1", "2"],
				]),
			]),
		);
		expect(html).not.toContain("script");
		expect(html).not.toContain("alert");
	});
});

describe("what is read from the document", () => {
	const content = (rows: string[][], head = header(1)) => document([table([head, ...rows])]);

	it("treats two highlighted headers as no answer rather than picking one", () => {
		const head = header(1);
		head[3] = "<mark>CoolZ 40</mark>";
		const html = render(content([["Objem", "19 l", "32 l", "40 l", "65 l", "83 l"]], head));
		expect(html).toContain("maky-cmp-table");
		expect(html).not.toContain("maky-cmp-self");
		expect(html).not.toContain("maky-cmp-you");
	});

	it("keeps rows apart when every row is the same, instead of one band that says nothing", () => {
		const html = render(
			content([
				["Chladivo", "R600a", "R600a", "R600a", "R600a", "R600a"],
				["Záruka", "3 roky", "3 roky", "3 roky", "3 roky", "3 roky"],
			]),
		);
		expect(html).not.toContain("maky-cmp-same");
		expect(count(html, /R600a/g)).toBe(5);
	});

	it("reads a part title only when the first cell is the one that is filled", () => {
		const html = render(
			content([
				["Objem a výkon", "", "", "", "", ""],
				["Nosnosť", "75 kg", "", "", "", ""],
				["Rozmery", "", "", "", "", "8 kg"],
			]),
		);
		const groups = rowsOf(html).filter((row) => row.startsWith('<tr class="maky-cmp-grp'));
		expect(groups.map((row) => row.replace(/<[^>]+>/g, ""))).toEqual(["Objem a výkon"]);
		expect(html).toContain('<th scope="row">Nosnosť</th>');
		expect(html).toContain('<th scope="row">Rozmery</th>');
	});

	it("takes the heading directly above the table as its title, at the level it has", () => {
		const html = render(
			document([
				{ type: "header", data: { level: 3, text: "Porovnanie <b>modelov</b>" } },
				table([header(1), ["Objem", "19 l", "32 l", "40 l", "65 l", "83 l"]]),
			]),
		);
		expect(html).toContain('<div class="maky-cmp-head"><h3>Porovnanie <b>modelov</b></h3>');
		expect(html).toContain('<caption class="maky-cmp-sr">Porovnanie modelov</caption>');
	});

	it("leaves a heading alone when something sits between it and the table", () => {
		const html = (
			parseEditorJSToHtml(
				document([
					{ type: "header", data: { level: 2, text: "Porovnanie" } },
					{ type: "paragraph", data: { text: "Ceny sú s DPH." } },
					table([header(1), ["Objem", "19 l", "32 l", "40 l", "65 l", "83 l"]]),
				]),
				{ comparison: sk },
			) ?? []
		).join("\n");
		expect(html.startsWith("<h2>Porovnanie</h2>")).toBe(true);
		expect(html).not.toContain("maky-cmp-head");
		expect(html).not.toContain("maky-cmp-cap");
		expect(html).toContain("maky-cmp-table");
	});

	it("draws a table that has no title and no caption without either", () => {
		const html = render(document([table([header(1), ["Objem", "19 l", "32 l", "40 l", "65 l", "83 l"]])]));
		expect(html).toContain("maky-cmp-table");
		expect(html).not.toContain("<caption");
		expect(html).not.toContain("maky-cmp-head");
	});

	it("shows a value that is neither a mark nor a dash as text, trimmed of nothing it was given", () => {
		const html = render(
			content([
				["Dual Zone", " ✗ ", "✗", "✗", "✗", "✓ "],
				["Poznámka", "ano ✓", "✓✓", "✗ nie", "—", " — "],
			]),
		);
		expect(count(html, /class="maky-cmp-yes"/g)).toBe(1);
		expect(count(html, /class="maky-cmp-no"/g)).toBe(4);
		expect(html).toContain("ano ✓");
		expect(html).toContain("✓✓");
		expect(html).toContain("✗ nie");
		expect(count(html, /class="maky-cmp-nil"/g)).toBe(2);
	});
});

describe("nothing a document contains can restyle or script the table", () => {
	const hostile = [
		'<img src=x onerror="alert(1)">',
		'<a href="javascript:alert(1)">odkaz</a>',
		'<span class="maky-cmp-self">span</span>',
		'<div class="maky-cmp" tabindex="0" role="region">div</div>',
		'<td colspan="99" class="maky-cmp-same">cell</td>',
		"<style>body{display:none}</style>x",
		'<iframe src="https://evil.example"></iframe>',
	];

	it("strips markup and attributes from cells, headers and the title", () => {
		const html = render(
			document([
				{ type: "header", data: { level: 2, text: hostile.join("") } },
				table([
					["Parameter", `<mark>${hostile[0]}A</mark>`, "B", "C"],
					[hostile.join(""), hostile.join(""), "x", "y"],
					["Skupina", "", "", ""],
					["Rovnaké", "R", "R", "R"],
				]),
			]),
		);
		for (const forbidden of [
			"onerror",
			"javascript:",
			"<img",
			"<style",
			"<iframe",
			"<script",
			"evil.example",
			'colspan="99"',
		]) {
			expect(html).not.toContain(forbidden);
		}
		// Exactly the classes the renderer emitted itself: one highlighted header, no forged cells.
		expect(count(html, /maky-cmp-self/g)).toBe(1 + 1);
		expect(count(html, /class="maky-cmp"/g)).toBe(1);
		expect(count(html, /role="region"/g)).toBe(1);
		expect(count(html, /tabindex=/g)).toBe(1);
	});

	it("emits no attribute but the ones the table needs", () => {
		const html = render(SAMPLE);
		const names = new Set([...html.matchAll(/\s([a-z-]+)="/g)].map((match) => match[1]));
		expect([...names].sort()).toEqual([
			"aria-hidden",
			"aria-label",
			"class",
			"colspan",
			"role",
			"scope",
			"tabindex",
		]);
	});

	it("never passes the producer's other blocks through unsanitised either", () => {
		const html = render(SAMPLE);
		expect(html).not.toMatch(/<script|onerror=|javascript:/i);
		// The paragraph that says "iOS & Android" keeps the entity a browser needs.
		expect(html).toContain("iOS &amp; Android");
	});
});

describe("the shared example", () => {
	const DIR = "docs/contracts/comparison-table";
	const provenance = JSON.parse(readFileSync(join(ROOT, DIR, "PROVENANCE.json"), "utf8")) as Record<
		string,
		unknown
	>;
	const bytes = readFileSync(join(ROOT, DIR, "coolz-32.description.json"));
	// `git hash-object`: the id the repository itself gives these bytes.
	const blobId = createHash("sha1")
		.update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
		.digest("hex");

	it("is the file its provenance describes, byte for byte", () => {
		expect(provenance.file).toBe("coolz-32.description.json");
		expect(createHash("sha256").update(bytes).digest("hex")).toBe(provenance.sha256);
		expect(blobId).toBe(provenance.git_blob_sha1);
		expect(bytes.at(-1)).toBe(0x0a);
	});

	it("comes from a named, clean commit of the producer, with the table switched on", () => {
		expect(provenance.cfm_git_head).toMatch(/^[0-9a-f]{40}$/);
		expect(provenance.cfm_tree_state).toBe("clean");
		expect(provenance.native_tables).toBe(true);
		expect(provenance.sku).toBe("TK20410");
	});
});
