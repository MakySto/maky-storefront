import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The typed content profile (`docs/contracts/maky-content.md`).
 *
 * The two documents the samples describe are not typed out here: `coolz-32.description.json` and
 * `gallery.description.json` are what CFM's producer writes for CoolZ 32 and for the invented block
 * gallery, and the same bytes sit in the CFM repository, where a test regenerates them from the
 * producer. The gallery shows every role and icon once, so a role the CoolZ page does not use is
 * still tested against what the producer really writes.
 *
 * The fixed words come from the real message catalogues through next-intl's own formatter, as on
 * the page.
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

import { CHANNEL_MAP } from "@/lib/channel-map";
import { getComparisonLabels } from "@/lib/comparison-labels";
import { getContentLabels } from "@/lib/content-labels";
import {
	parseEditorJSToHtml,
	parseEditorJSToText,
	parseProductContent,
	type ComparisonLabels,
	type ContentLabels,
} from "./editorjs";
import { contentProductIds, isUnknownRole, readEnvelope, readMarker, renderRole } from "./editorjs-content";
import { FEATURE_ICONS, ICON_NAMES, sanitizeBlock } from "./editorjs-sanitize";
import { liftSections, sheetFacts, templateFor } from "./product-templates";

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

/** The Saleor channel each locale is served in, which is what the configurator's address is made from. */
const CHANNEL_OF: Record<string, string> = Object.fromEntries(
	Object.values(CHANNEL_MAP).map((market) => [market.locale, market.saleorSlug]),
);

const CONTRACT = join(ROOT, "docs/contracts/maky-content");
const readSample = (name: string): string => readFileSync(join(CONTRACT, name), "utf8");
const COOLZ = readSample("coolz-32.description.json");
const GALLERY = readSample("gallery.description.json");
/** A real roof-rack set (Thule, CFM pk 71732), typed the way the publisher types a set. */
const RACK = readSample("set-thule-71732.description.json");

type Block = { type: string; id?: string; data: Record<string, unknown> };
const VERSION = "maky-content/1:autochladnicka";
const RACK_VERSION = "maky-content/1:stresny-nosic";
const doc = (blocks: Block[], version: string | null = VERSION): string =>
	JSON.stringify(version === null ? { blocks } : { version, blocks });
const paragraph = (text: string, id?: string): Block => ({
	type: "paragraph",
	...(id ? { id } : {}),
	data: { text },
});
const header = (text: string, level = 2): Block => ({ type: "header", data: { text, level } });
const list = (id: string | undefined, items: unknown[], style = "unordered"): Block => ({
	type: "list",
	...(id ? { id } : {}),
	data: { style, items },
});
const table = (id: string | undefined, content: string[][], withHeadings = false): Block => ({
	type: "table",
	...(id ? { id } : {}),
	data: { withHeadings, content },
});

const FILM = "D5lm_R-m3BA";
const FILM_TITLE = "PRO-USER CoolZ – kompresorové autochladničky s powerbankou";
/** A video as CFM writes it: Editor.js' embed block, the film named by its watch and its embed address. */
const video = (changes: Record<string, unknown> = {}, id: string | undefined = "maky:video"): Block => ({
	type: "embed",
	...(id ? { id } : {}),
	data: {
		service: "youtube",
		source: `https://www.youtube.com/watch?v=${FILM}`,
		embed: `https://www.youtube.com/embed/${FILM}`,
		caption: FILM_TITLE,
		...changes,
	},
});

let labels: ContentLabels;
let comparison: ComparisonLabels;
beforeAll(async () => {
	labels = await getContentLabels("sk-SK", "sk-eur");
	comparison = await getComparisonLabels("sk-SK");
});

const parse = (content: string) => parseProductContent(content, { content: labels });
const htmlOf = (content: string): string =>
	(parse(content)?.blocks ?? []).map((block) => block.html).join("\n");
const issuesOf = (content: string) => parse(content)?.issues ?? [];
const count = (html: string, pattern: RegExp): number => html.match(pattern)?.length ?? 0;

/** What a shopper reads of some markup: tags dropped (as a space), entities read, whitespace one space. */
const visible = (html: string): string =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();

describe("the envelope", () => {
	it.each([
		["maky-content/1", { typed: true, template: null }],
		["maky-content/1:autochladnicka", { typed: true, template: "autochladnicka" }],
		["maky-content/1:strešný-nosič", { typed: false, template: null }],
		["maky-content/1:Upper", { typed: false, template: null }],
		["maky-content/2:autochladnicka", { typed: false, template: null }],
		["maky-content/0", { typed: false, template: null }],
		["maky-content/", { typed: false, template: null }],
		["2.30.0", { typed: false, template: null }],
		["", { typed: false, template: null }],
		[undefined, { typed: false, template: null }],
		[1, { typed: false, template: null }],
	])("reads %j", (version, expected) => {
		expect(readEnvelope(version)).toEqual(expected);
	});
});

describe("the markers", () => {
	it.each([
		["maky:callout:tip", { role: "callout", kind: "tip" }],
		["maky:callout:warn#2", { role: "callout", kind: "warn" }],
		["maky:benefits", { role: "benefits", kind: null }],
		["maky:inbox", { role: "inbox", kind: null }],
		["maky:features#3", { role: "features", kind: null }],
		["maky:steps", { role: "steps", kind: null }],
		["maky:faq", { role: "faq", kind: null }],
		["maky:specs", { role: "specs", kind: null }],
		["maky:documents", { role: "documents", kind: null }],
	])("reads %s", (id, expected) => {
		expect(readMarker(id)).toEqual(expected);
		expect(isUnknownRole(id)).toBe(false);
	});

	it.each(["maky:gallery", "maky:newrole", "maky:newrole:kind#2"])(
		"knows %s is well formed and a role it does not read",
		(id) => {
			expect(readMarker(id)).toBeNull();
			expect(isUnknownRole(id)).toBe(true);
		},
	);

	it.each([
		undefined,
		null,
		3,
		"",
		"benefits",
		"MAKY:benefits",
		"maky:",
		"maky:callout2",
		"maky:benefits#0",
		"maky:benefits#100",
		"x maky:benefits",
	])("does not take %j for a marker at all", (id) => {
		expect(readMarker(id)).toBeNull();
		expect(isUnknownRole(id)).toBe(false);
	});
});

describe("each role is drawn as itself", () => {
	it("a callout: a tip, a note or a warning, its title inside the box, named for assistive technology", () => {
		const html = htmlOf(
			doc([
				header("Tip", 3),
				paragraph("Vychlaďte ju doma.", "maky:callout:tip"),
				paragraph("Poznámka.", "maky:callout:info"),
				list("maky:callout:warn", ["Prvé varovanie.", "Druhé varovanie."]),
			]),
		);
		expect(html).toContain(
			`<aside class="maky-callout maky-callout-tip not-prose" role="note" aria-label="${labels.callout.tip}">`,
		);
		expect(html).toContain('<strong class="maky-callout-t">Tip</strong><p>Vychlaďte ju doma.</p>');
		expect(html).toContain(`aria-label="${labels.callout.info}"`);
		expect(html).toContain(`aria-label="${labels.callout.warn}"`);
		// A list of warnings stays a list of warnings: each one is its own item.
		expect(html).toContain("<ul><li>Prvé varovanie.</li><li>Druhé varovanie.</li></ul>");
		// The title was the heading above the block, so it is not a heading of its own as well.
		expect(html).not.toContain("<h3>");
	});

	it("benefits, the box and steps: the title and the text of each item", () => {
		const items = ["<strong>Tichá prevádzka</strong> Nehlučí.", "<strong>Len názov</strong>"];
		const html = htmlOf(
			doc([list("maky:benefits", items), list("maky:inbox", items), list("maky:steps", items, "ordered")]),
		);
		expect(html).toContain('<ul class="maky-benefits">');
		expect(html).toContain('<ul class="maky-inbox">');
		expect(html).toContain('<ol class="maky-steps">');
		expect(html).toContain(
			'<strong class="maky-t">Tichá prevádzka</strong><span class="maky-d">Nehlučí.</span>',
		);
		// An item without a text has a title and no empty text element.
		expect(html).toContain('<span class="maky-txt"><strong class="maky-t">Len názov</strong></span>');
		expect(count(html, /maky-ico-check/g)).toBe(2);
		expect(count(html, /maky-ico-package/g)).toBe(2);
	});

	it("a benefit without a leading title is all title, set as the titles of the others are", () => {
		const html = htmlOf(
			doc([
				list("maky:benefits", [
					"Aerodynamický profil znižuje hluk vetra",
					"<strong>Tichý chod</strong> Nehlučí.",
					'Odolná <em onclick="x()">anodizovaná</em> úprava<script>alert(1)</script>',
				]),
			]),
		);
		expect(html).toContain(
			'<span class="maky-txt"><strong class="maky-t">Aerodynamický profil znižuje hluk vetra</strong></span>',
		);
		// An item that has a title keeps it, with its text under it.
		expect(html).toContain('<strong class="maky-t">Tichý chod</strong><span class="maky-d">Nehlučí.</span>');
		// The text of an item without one is sanitized like every other text of the document.
		expect(html).toContain('<strong class="maky-t">Odolná <em>anodizovaná</em> úprava');
		for (const forbidden of ["<script", "onclick"]) expect(html, forbidden).not.toContain(forbidden);
		// Only the one item with a title has a grey text under it.
		expect(count(html, /class="maky-d"/g)).toBe(1);
	});

	it("features: an icon from the closed set, the generic mark for any other, and a caption", () => {
		const html = htmlOf(
			doc([
				list("maky:features", [
					{
						content: "<strong>Batéria</strong> Vydrží dlho.",
						items: [{ content: "Voliteľné príslušenstvo", items: [] }],
						meta: { icon: "battery" },
					},
					{ content: "<strong>Bez ikony</strong> text", items: [] },
					{ content: "<strong>Cudzia</strong> text", items: [], meta: { icon: "rocket" } },
				]),
			]),
		);
		expect(count(html, /class="maky-feature"/g)).toBe(3);
		expect(html).toContain("maky-ico-battery");
		expect(count(html, /maky-ico-sparkles/g)).toBe(2);
		expect(html).toContain('<span class="maky-cap">Voliteľné príslušenstvo</span>');
	});

	it("a FAQ: each question holds its answer, the first one open", () => {
		const html = htmlOf(
			doc([
				list("maky:faq", [
					{ content: "Ako ju zapojím?", items: [{ content: "Do zásuvky.", items: [] }] },
					{ content: "Je hlučná?", items: [{ content: "Nie.", items: [] }] },
				]),
			]),
		);
		expect(count(html, /<details class="maky-qa"/g)).toBe(2);
		expect(count(html, /<details class="maky-qa" open>/g)).toBe(1);
		expect(html.indexOf("open>")).toBeLessThan(html.indexOf("Ako ju zapojím?"));
		expect(html).toContain('<summary class="maky-q"><span>Ako ju zapojím?</span>');
		expect(html).toContain('<div class="maky-a">Do zásuvky.</div>');
	});

	it("specs: groups titled by a row with an empty second cell, a long value on the row's full width", () => {
		const html = htmlOf(
			doc([
				table("maky:specs", [
					["Chladenie", ""],
					["Objem", "32 l"],
					["Poznámka", "Hodnota, ktorá je dlhšia než jedna veta v tabuľke parametrov"],
					["Napájanie", ""],
					["Príkon", "60 W"],
				]),
			]),
		);
		expect(count(html, /<section class="maky-sg">/g)).toBe(2);
		expect(html).toContain('<h4 class="maky-sg-t">Chladenie</h4>');
		expect(html).toContain('<div class="maky-sr"><dt>Objem</dt><dd>32 l</dd></div>');
		expect(count(html, /class="maky-sr maky-sr-long"/g)).toBe(1);
	});

	it("a parameter sheet is a section a template may set as a card, with its rows as plain text", () => {
		const parsed = parse(
			doc([
				paragraph("Úvod."),
				header("Technické parametre"),
				table("maky:specs", [
					["Nosnosť", "do 75 kg (zostavy)"],
					["Skupina", ""],
					["Materiál <em>priečnikov</em>", "<strong>Hliník</strong>"],
				]),
			]),
		);
		const block = parsed?.blocks.find((b) => b.section === "specs");
		expect(parsed?.blocks.map((b) => b.section ?? "plain")).toEqual(["plain", "specs"]);
		expect(block?.title).toBe("Technické parametre");
		expect(block?.html).toContain('<h3 class="maky-h">Technické parametre</h3>');
		expect(block?.body).toContain('<div class="maky-specs">');
		expect(block?.body).not.toContain("Technické parametre");
		// The facts are text, never markup, and a group's title is not one.
		expect(block?.facts).toEqual([
			{ label: "Nosnosť", value: "do 75 kg (zostavy)" },
			{ label: "Materiál priečnikov", value: "Hliník" },
		]);
	});

	it("documents: a link, its kind of file, and a section a template may set as a card", () => {
		const parsed = parse(
			doc([
				header("Na stiahnutie"),
				list("maky:documents", [
					'<a href="https://example.test/navod.pdf">Návod</a> PDF · SK',
					'<a href="/dokumenty/list.pdf">List</a>',
				]),
			]),
		);
		const block = parsed?.blocks[0];
		expect(block?.section).toBe("documents");
		expect(block?.title).toBe("Na stiahnutie");
		expect(block?.body).toContain('<ul class="maky-docs">');
		expect(block?.html).toContain('<h3 class="maky-h">Na stiahnutie</h3>');
		expect(block?.body).toContain(
			'<a class="maky-doc-a" href="https://example.test/navod.pdf" target="_blank" rel="noopener noreferrer">Návod</a>',
		);
		expect(block?.body).toContain('<span class="maky-d">PDF · SK</span>');
	});

	it("a call to action: one link, drawn as a button that opens in the same tab", () => {
		const parsed = parse(
			doc([list("maky:cta", ['<a href="/sk/kontakt?produkt=NKR9944">Poradiť s výberom</a>'])]),
		);
		expect(parsed?.issues).toEqual([]);
		expect(parsed?.blocks[0]?.html).toBe(
			'<section class="maky-blk not-prose"><div class="maky-cta"><a class="maky-cta-a" href="/sk/kontakt?produkt=NKR9944">Poradiť s výberom</a></div></section>',
		);
	});

	it("a call to action that is not one plain link is not drawn as one, and loses no text", () => {
		for (const items of [
			['<a href="/sk/kontakt">A</a>', '<a href="/sk/kontakt">B</a>'],
			['<a href="javascript:alert(1)">Poradiť</a>'],
			['<a href="//evil.test/x">Poradiť</a>'],
			['<a href="/sk/kontakt">Poradiť</a> a ešte text'],
			["Bez odkazu"],
		]) {
			const parsed = parse(doc([list("maky:cta", items)]));
			expect(parsed?.issues.length, items.join("|")).toBeGreaterThan(0);
			expect(parsed?.blocks[0]?.html).not.toContain("maky-cta");
		}
	});

	it("a video: a link to its watch page and its title, with nothing of YouTube loaded", () => {
		const parsed = parse(doc([header("Video"), video()]));
		const block = parsed?.blocks[0];
		expect(parsed?.issues).toEqual([]);
		expect(parsed?.blocks).toHaveLength(1);
		// The video stays in the description: only the comparison and the documents are lifted.
		expect(block?.section).toBeUndefined();
		expect(block?.html).toBe(
			'<section class="maky-blk not-prose"><h3 class="maky-h">Video</h3>' +
				// The still, drawn in the stage under the play mark and asked of this site's own optimizer; `alt`
				// is the empty one. The words follow the stage: none of them is over the picture.
				'<div class="maky-video"><a class="maky-video-a" href="https://www.youtube.com/watch?v=D5lm_R-m3BA" target="_blank" rel="noopener noreferrer">' +
				'<span class="maky-video-stage"><img src="/_next/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2FD5lm_R-m3BA%2Fhqdefault.jpg&amp;w=640&amp;q=75" alt width="640" height="360" loading="lazy" decoding="async">' +
				'<span class="maky-video-play" aria-hidden="true"><span class="maky-ico maky-ico-play" aria-hidden="true"></span></span></span>' +
				'<span class="maky-video-txt"><span class="maky-video-sr">Prehrať video: </span>' +
				`<strong class="maky-video-t">${FILM_TITLE}</strong>` +
				'<span class="maky-video-n">YouTube · načíta sa až po kliknutí</span></span></a></div></section>',
		);
		// The page asks YouTube for nothing until the shopper does: no frame, no script, and the only
		// address in the markup that names another host is the link that opens the watch page. The one
		// picture is this site's own optimizer's address for the still; YouTube's host is only the
		// percent-encoded `url` it is asked to fetch, never an address the browser requests.
		for (const forbidden of ["<iframe", "<script", "<video", "youtube-nocookie", "/embed/"]) {
			expect(block?.html, forbidden).not.toContain(forbidden);
		}
		expect(block?.html.match(/<img /g)).toHaveLength(1);
		expect(block?.html.match(/src="[^"]*"/g)).toEqual([expect.stringMatching(/^src="\/_next\/image\?url=/)]);
		expect(block?.html.match(/https?:\/\/[^"\s<]+/g)).toEqual([`https://www.youtube.com/watch?v=${FILM}`]);
	});

	it("a video needs no heading above it, and its markup is kept whole by the second pass", () => {
		const parsed = parse(doc([video()]));
		const html = parsed?.blocks[0].html ?? "";
		expect(html).toContain('<section class="maky-blk not-prose"><div class="maky-video">');
		expect(html).not.toContain("<h3");
		// The renderer's own markup is exactly what the sanitizer lets through, so no class or attribute is dropped.
		expect(sanitizeBlock(html)).toBe(html);
	});

	it("a video is addressed by the identifier alone: the link is rebuilt from it, not copied", () => {
		// Whatever else the address says is not the identifier, so this is not a video the page draws.
		const html = htmlOf(doc([video()]));
		expect(html).toContain(`href="https://www.youtube.com/watch?v=${FILM}"`);
		expect(html.match(/href="/g)).toHaveLength(1);
	});

	it("a role's title is the heading directly above it, and only that", () => {
		const html = htmlOf(
			doc([
				header("Prečo si ju vybrať"),
				list("maky:benefits", ["<strong>A</strong> a"]),
				header("Nadpis nad odsekom"),
				paragraph("Obyčajný odsek."),
				header("Iný nadpis"),
				paragraph("Prvý odsek."),
				list("maky:inbox", ["<strong>B</strong> b"]),
			]),
		);
		expect(html).toContain(
			'<section class="maky-blk not-prose"><h3 class="maky-h">Prečo si ju vybrať</h3><ul class="maky-benefits">',
		);
		// A heading above a plain paragraph is that paragraph's heading and stays one.
		expect(html).toContain("<h2>Nadpis nad odsekom</h2>\n<p>Obyčajný odsek.</p>");
		// A heading with a paragraph between it and the block is not the block's title.
		expect(html).toContain("<h2>Iný nadpis</h2>");
		expect(html).toContain('<section class="maky-blk not-prose"><ul class="maky-inbox">');
	});
});

describe("nothing is lost when a role cannot be drawn", () => {
	const typed = (blocks: Block[]) => doc(blocks);

	it("shows a marked block that is not what its marker says as the standard block it is, and says so", () => {
		const content = typed([paragraph("Toto nie je zoznam.", "maky:benefits")]);
		expect(htmlOf(content)).toBe("<p>Toto nie je zoznam.</p>");
		expect(issuesOf(content)).toEqual([
			expect.objectContaining({
				severity: "warn",
				code: "malformed-block",
				block: 0,
				marker: "maky:benefits",
			}),
		]);
	});

	it("keeps the heading above a block it cannot draw as a heading, and reports the block once", () => {
		const content = typed([header("Výhody"), paragraph("Text namiesto zoznamu.", "maky:benefits")]);
		expect(htmlOf(content)).toBe("<h2>Výhody</h2>\n<p>Text namiesto zoznamu.</p>");
		expect(issuesOf(content)).toHaveLength(1);
	});

	it.each([
		["a FAQ item without an answer", list("maky:faq", [{ content: "Otázka?", items: [] }])],
		[
			"a FAQ item with two answers",
			list("maky:faq", [
				{
					content: "Otázka?",
					items: [
						{ content: "A.", items: [] },
						{ content: "B.", items: [] },
					],
				},
			]),
		],
		["an item with no text", list("maky:benefits", ["<strong></strong>", "  "])],
		[
			"a feature with two captions",
			list("maky:features", [
				{
					content: "<strong>A</strong> a",
					items: [
						{ content: "x", items: [] },
						{ content: "y", items: [] },
					],
				},
			]),
		],
		[
			"a specs table with a heading row",
			table(
				"maky:specs",
				[
					["Parameter", "Hodnota"],
					["Objem", "32 l"],
				],
				true,
			),
		],
		["a specs table with a row of three cells", table("maky:specs", [["a", "b", "c"]])],
		["a specs table with no value", table("maky:specs", [["Skupina", ""]])],
		["a callout of an unknown kind", paragraph("Text.", "maky:callout:loud")],
		["a callout carried by a quote", { type: "quote", id: "maky:callout:tip", data: { text: "Citát." } }],
	])("%s is shown as plain blocks, with its text", (_name, block) => {
		const content = typed([block]);
		const parsed = parse(content);
		expect(parsed?.blocks.length ?? 0).toBeGreaterThan(0);
		expect(parsed?.issues.map((issue) => issue.code)).toEqual(["malformed-block"]);
		expect(htmlOf(content)).not.toMatch(
			/class="maky-(benefits|inbox|features|faq|specs|callout|steps|docs|video)/,
		);
	});

	it.each([
		[
			"a paragraph in place of the embed",
			{ type: "paragraph", id: "maky:video", data: { text: "Film" } },
			"carried by an embed",
		],
		["of another service", video({ service: "vimeo" }), "is not youtube"],
		[
			"on another host",
			video({ source: "https://evil.example/watch?v=D5lm_R-m3BA" }),
			"not a youtube.com watch address",
		],
		[
			"on a look-alike host",
			video({ source: "https://www.youtube.com.evil.example/watch?v=D5lm_R-m3BA" }),
			"not a youtube.com watch address",
		],
		[
			"over plain http",
			video({ source: "http://www.youtube.com/watch?v=D5lm_R-m3BA" }),
			"not a youtube.com watch address",
		],
		[
			"with a second parameter",
			video({ source: "https://www.youtube.com/watch?v=D5lm_R-m3BA&autoplay=1" }),
			"not a youtube.com watch address",
		],
		[
			"with a short identifier",
			video({ source: "https://www.youtube.com/watch?v=D5lm_R-m3B" }),
			"not a youtube.com watch address",
		],
		["whose source is not text", video({ source: 7 }), "not a youtube.com watch address"],
		[
			"whose embed is another film",
			video({ embed: "https://www.youtube.com/embed/AAAAAAAAAAA" }),
			"embed address",
		],
		[
			"whose embed is on another host",
			video({ embed: "https://evil.example/embed/D5lm_R-m3BA" }),
			"embed address",
		],
		["with no embed", video({ embed: undefined }), "embed address"],
		["with no title", video({ caption: "" }), "has no title"],
		["with a title that is only markup", video({ caption: "<b> </b>" }), "has no title"],
	])("a video %s is not drawn, and says why", (_name, block, why) => {
		const content = typed([block]);
		expect(htmlOf(content)).not.toContain("maky-video");
		expect(htmlOf(content)).not.toContain("<iframe");
		expect(issuesOf(content)).toMatchObject([
			{ code: "malformed-block", detail: expect.stringContaining(why) },
		]);
	});

	it("keeps the heading above a video it cannot draw as the heading it is", () => {
		const content = typed([header("Video"), video({ service: "vimeo" })]);
		expect(htmlOf(content)).toBe("<h2>Video</h2>");
		expect(issuesOf(content).map((issue) => issue.code)).toEqual(["malformed-block"]);
	});

	it("draws no video for a reader that was not asked for the profile, or whose major version differs", () => {
		const blocks = [header("Video"), video()];
		expect((parseEditorJSToHtml(doc(blocks)) ?? []).join("\n")).toBe("<h2>Video</h2>");
		const newer = parseProductContent(doc(blocks, "maky-content/2:autochladnicka"), { content: labels });
		expect(newer?.blocks.map((block) => block.html).join("\n")).toBe("<h2>Video</h2>");
		// A listing or a search result is made of text only, and a film is none.
		expect(parseEditorJSToText(doc(blocks))).toBe("Video");
	});

	it("has nothing to show for an empty marked list, and so nothing to lose", () => {
		const content = typed([paragraph("Úvod."), list("maky:inbox", [])]);
		expect(htmlOf(content)).toBe("<p>Úvod.</p>");
		expect(issuesOf(content).map((issue) => issue.code)).toEqual(["malformed-block"]);
	});

	it("shows a marker it does not know as the standard block it is, and says so", () => {
		const content = typed([list("maky:gallery", ["Jedna", "Dva"])]);
		expect(htmlOf(content)).toBe("<ul><li>Jedna</li><li>Dva</li></ul>");
		expect(issuesOf(content)).toEqual([
			expect.objectContaining({ code: "unknown-role", marker: "maky:gallery" }),
		]);
	});

	it("never ignores a warning: one it cannot draw as a callout is shown as the block it is", () => {
		const asQuote = typed([{ type: "quote", id: "maky:callout:warn", data: { text: "Pozor na prepätie." } }]);
		expect(htmlOf(asQuote)).toContain("Pozor na prepätie.");
		expect(issuesOf(asQuote).map((issue) => issue.severity)).toEqual(["warn"]);
	});

	it("still reports what went wrong when nothing at all is left to show", () => {
		const content = typed([{ type: "raw", id: "maky:callout:warn", data: { text: "Pozor na prepätie." } }]);
		const parsed = parse(content);
		expect(parsed?.blocks).toEqual([]);
		expect(parsed?.issues.map((issue) => issue.code)).toEqual(["malformed-block", "warning-not-shown"]);
		// ...and a caller that only wants the blocks still gets "nothing to show".
		expect(parseEditorJSToHtml(content, { content: labels })).toBeNull();
	});

	it("reports a warning that reaches the page in no form as an ERROR", () => {
		// A block type the page never draws (raw HTML is dropped on purpose) that carries a warning's text.
		const content = typed([
			paragraph("Bezpečné."),
			{ type: "raw", id: "maky:callout:warn", data: { text: "Pozor na prepätie." } },
		]);
		expect(htmlOf(content)).not.toContain("Pozor");
		expect(issuesOf(content)).toEqual([
			expect.objectContaining({ severity: "warn", code: "malformed-block", block: 1 }),
			expect.objectContaining({
				severity: "error",
				code: "warning-not-shown",
				block: 1,
				marker: "maky:callout:warn",
			}),
		]);
		// A block of the same kind with nothing to say is no loss...
		const empty = typed([{ type: "raw", id: "maky:callout:warn", data: { text: "  <b></b> " } }]);
		expect(issuesOf(empty).map((issue) => issue.code)).not.toContain("warning-not-shown");
		// ...but one whose text this reader cannot find is assumed to have some, so it is reported.
		const unreadable = typed([{ type: "raw", id: "maky:callout:warn", data: { html: "<b>Pozor</b>" } }]);
		expect(issuesOf(unreadable).map((issue) => issue.code)).toContain("warning-not-shown");
	});

	it("reads no marker without the labels, or with a version it does not know, and shows every block plain", () => {
		const blocks = [
			header("Tip", 3),
			paragraph("Pozor na prepätie.", "maky:callout:warn"),
			list("maky:benefits", ["<strong>A</strong> a"]),
		];
		const plain = "<h3>Tip</h3>\n<p>Pozor na prepätie.</p>\n<ul><li><strong>A</strong> a</li></ul>";

		// A caller that does not ask for the profile gets the page as it has always been.
		expect((parseEditorJSToHtml(doc(blocks)) ?? []).join("\n")).toBe(plain);
		// A major version this reader does not know is read the way a reader that predates the profile reads it.
		const newer = parseProductContent(doc(blocks, "maky-content/2:autochladnicka"), { content: labels });
		expect(newer?.blocks.map((block) => block.html).join("\n")).toBe(plain);
		expect(newer).toMatchObject({ typed: false, template: null, issues: [] });
		// So does a document that has no version at all.
		expect(parseProductContent(doc(blocks, null), { content: labels })).toMatchObject({
			typed: false,
			template: null,
		});
	});

	it("keeps every word of a typed description in the text a listing or a search result is made of", () => {
		const text = parseEditorJSToText(
			doc([header("Tip", 3), paragraph("Pozor na prepätie.", "maky:callout:warn")]),
		);
		expect(text).toContain("Pozor na prepätie.");
	});
});

describe("Saleor's text cannot reach the markup", () => {
	it("is stripped of scripts, handlers, frames and any class or style of its own", () => {
		const html = htmlOf(
			doc([
				paragraph(
					'<img src=x onerror="alert(1)">Ahoj <script>alert(2)</script><a href="javascript:alert(3)" onclick="x()">odkaz</a>',
					"maky:callout:tip",
				),
				list("maky:benefits", [
					'<strong class="maky-callout-warn" style="color:red" onmouseover="z()">Názov</strong> text <iframe src="https://evil.test"></iframe><em onclick="y()">zvýraznené</em>',
				]),
				list("maky:features", [
					{ content: "<strong>Ikona</strong> text", items: [], meta: { icon: 'x" onmouseover="alert(1)' } },
				]),
			]),
		);
		for (const forbidden of [
			"<script",
			"<iframe",
			"<img",
			"onerror",
			"onclick",
			"onmouseover",
			"javascript:",
			"style=",
			"evil.test",
		]) {
			expect(html, forbidden).not.toContain(forbidden);
		}
		expect(html).toContain("Ahoj");
		expect(html).toContain("zvýraznené");
		// The class the forged element asked for is not the class on the page.
		expect(html).not.toContain("maky-callout-warn");
		expect(html).toContain("maky-ico-sparkles");
	});

	it("reaches the page as text only when it is the title of a video, and never as an address", () => {
		const html = htmlOf(
			doc([
				video({
					caption:
						'Film <script>alert(1)</script><iframe src="https://evil.test"></iframe><img src=x onerror="y()"><a href="https://evil.test/p" class="maky-video-a">odkaz</a> <em onclick="z()">dôležité</em>',
				}),
			]),
		);
		for (const forbidden of [
			"<script",
			"<iframe",
			"src=x",
			"onerror",
			"onclick",
			"evil.test/p",
			"alert(1)",
		]) {
			expect(html, forbidden).not.toContain(forbidden);
		}
		// The one picture is the renderer's own, from the identifier; the caption's `<img>` is gone.
		expect(html.match(/<img /g)).toHaveLength(1);
		expect(html).toContain("Film");
		expect(html).toContain("dôležité");
		// Only the link the renderer wrote opens anything.
		expect(html.match(/class="maky-video-a"/g)).toHaveLength(1);
		expect(html.match(/https:\/\/www\.youtube\.com\/watch\?v=/g)).toHaveLength(1);
	});

	it("never takes the fixed words, the classes or the icon names from the document", () => {
		const html = htmlOf(
			doc([
				paragraph("Text.", "maky:callout:tip"),
				list("maky:features", [
					{
						content: "<strong>A</strong> a",
						items: [],
						meta: { icon: "battery", class: "evil", label: "podvod" },
					},
				]),
			]),
		);
		expect(html).toContain(`aria-label="${labels.callout.tip}"`);
		expect(html).not.toContain("evil");
		expect(html).not.toContain("podvod");
	});

	it.each([
		"javascript:alert(1)",
		"data:text/html,<b>x</b>",
		"http://plain.example/x.pdf",
		"//other.example/x.pdf",
		"ftp://files.example/x.pdf",
		"https://exa mple.test/x.pdf",
		"",
	])("does not draw a document whose link is %j, and a script link reaches no page at all", (href) => {
		const content = doc([list("maky:documents", [`<a href="${href}">Návod</a>`])]);
		const html = htmlOf(content);
		expect(html).not.toContain("maky-docs");
		expect(html).not.toContain("javascript:");
		expect(issuesOf(content).map((issue) => issue.code)).toEqual(["malformed-block"]);
	});

	it("draws a document whose link is https or a path on this site, escaped once", () => {
		const html = htmlOf(
			doc([
				list("maky:documents", [
					'<a href="https://example.test/a?b=1&amp;c=2" rel="noopener noreferrer">Návod</a> PDF',
					'<a href="/dokumenty/b.pdf">List</a>',
				]),
			]),
		);
		expect(html).toContain('href="https://example.test/a?b=1&amp;c=2"');
		expect(html).not.toContain("&amp;amp;");
		expect(html).toContain('href="/dokumenty/b.pdf"');
	});
});

describe("the model comparison beside the roles", () => {
	it("is still one comparison table, and its title is a heading like every other block's", () => {
		const parsed = parseProductContent(COOLZ, { content: labels, comparison });
		const lifted = parsed?.blocks.filter((block) => block.section === "comparison") ?? [];
		expect(lifted).toHaveLength(1);
		expect(lifted[0].html).toContain('<h3 class="maky-h">Porovnanie modelov PRO-USER CoolZ</h3>');
		expect(count(lifted[0].html, /<table class="maky-cmp-table">/g)).toBe(1);
	});

	it("never reads a block that carries a marker as a comparison", () => {
		const content = doc([
			header("Parametre"),
			table(
				"maky:specs",
				[
					["Skupina", "", ""],
					["Objem", "32 l", "40 l"],
					["Príkon", "60 W", "60 W"],
				],
				true,
			),
		]);
		const parsed = parseProductContent(content, { content: labels, comparison });
		expect(parsed?.blocks.some((block) => block.section === "comparison")).toBe(false);
	});

	it("is the same table without the profile; only the roles around it are plain", () => {
		const typedTable = parseProductContent(COOLZ, { content: labels, comparison })?.blocks.find(
			(block) => block.section === "comparison",
		);
		const plain = parseProductContent(COOLZ, { comparison });
		const plainTable = plain?.blocks.find((block) => block.section === "comparison");
		expect(plain?.typed).toBe(false);
		expect(plainTable?.html).toContain('<table class="maky-cmp-table">');
		expect(typedTable?.html).toContain('<table class="maky-cmp-table">');
		expect(plain?.blocks.map((block) => block.html).join("")).not.toContain("maky-benefits");
	});
});

describe("the samples CFM's producer writes", () => {
	const provenance = JSON.parse(readSample("PROVENANCE.json")) as {
		profile: string;
		cfm_git_head: string;
		cfm_tree_state: string;
		files: Record<string, { sha256: string; git_blob_sha1: string; template: string }>;
	};

	it("come from a named, clean commit of the producer", () => {
		expect(provenance.cfm_git_head).toMatch(/^[0-9a-f]{40}$/);
		expect(provenance.cfm_tree_state).toBe("clean");
	});

	it("name the template each is typed with, and the document says the same", () => {
		const templates = Object.fromEntries(
			Object.entries(provenance.files).map(([name, entry]) => [name, entry.template]),
		);
		expect(templates).toEqual({
			"coolz-32.description.json": "autochladnicka",
			"gallery.description.json": "autochladnicka",
			"set-thule-71732.description.json": "stresny-nosic",
		});
		for (const [name, template] of Object.entries(templates)) {
			const version = (JSON.parse(readSample(name)) as { version: string }).version;
			expect(version, name).toBe(`maky-content/1:${template}`);
		}
	});

	it("are the bytes their provenance says they are", () => {
		expect(provenance.profile).toBe("maky-content/1");
		expect(Object.keys(provenance.files).sort()).toEqual([
			"coolz-32.description.json",
			"gallery.description.json",
			"set-thule-71732.description.json",
		]);
		for (const [name, expected] of Object.entries(provenance.files)) {
			const bytes = readFileSync(join(CONTRACT, name));
			expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(expected.sha256);
			const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
			expect(blob, name).toBe(expected.git_blob_sha1);
		}
	});

	it("are what Saleor stores: a version, blocks, and nothing else of a block but a type, an id and data", () => {
		for (const [sample, version] of [
			[COOLZ, VERSION],
			[GALLERY, VERSION],
			[RACK, RACK_VERSION],
		] as const) {
			const parsed = JSON.parse(sample) as { version: string; blocks: Block[]; time?: unknown };
			expect(Object.keys(parsed).sort()).toEqual(["blocks", "version"]);
			expect(parsed.version).toBe(version);
			for (const block of parsed.blocks) {
				expect(["paragraph", "header", "list", "table", "embed"]).toContain(block.type);
				expect(Object.keys(block).every((key) => ["type", "id", "data"].includes(key))).toBe(true);
				// What Saleor keeps of an embed is these fields (EditorJSEmbedDataModel); the producer sends four.
				if (block.type === "embed") {
					expect(Object.keys(block.data).sort()).toEqual(["caption", "embed", "service", "source"]);
				}
				if (block.id !== undefined) expect(readMarker(block.id), block.id).not.toBeNull();
			}
		}
	});

	it("CoolZ 32: every role CFM writes for the page is read, and nothing is left over", () => {
		const parsed = parseProductContent(COOLZ, { content: labels, comparison });
		const html = parsed?.blocks.map((block) => block.html).join("\n") ?? "";
		expect(parsed).toMatchObject({ typed: true, template: "autochladnicka", issues: [] });
		expect(count(html, /class="maky-callout maky-callout-tip/g)).toBe(1);
		expect(count(html, /<ul class="maky-benefits">/g)).toBe(1);
		expect(count(html, /<ul class="maky-inbox">/g)).toBe(1);
		expect(count(html, /<ul class="maky-features">/g)).toBe(1);
		expect(count(html, /class="maky-feature"/g)).toBe(4);
		expect(count(html, /<table class="maky-cmp-table">/g)).toBe(1);
		// The four features of the page, each with the icon the producer chose for it.
		for (const icon of ["battery", "stand", "smartphone", "lightbulb"])
			expect(html).toContain(`maky-ico-${icon}`);
		// The manufacturer's film, once, as a link that loads nothing; and the datasheet of this very model.
		expect(count(html, /class="maky-video"/g)).toBe(1);
		expect(html).toContain(`href="https://www.youtube.com/watch?v=${FILM}"`);
		expect(html).toContain(FILM_TITLE);
		// No frame and no player host. The only picture is the film's still, asked of this site.
		expect(html).not.toMatch(/<iframe|youtube-nocookie/);
		expect(html.match(/<img [^>]*>/g)).toEqual([
			expect.stringContaining('src="/_next/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F'),
		]);
		expect(count(html, /class="maky-doc"/g)).toBe(1);
		expect(html).toContain(
			'href="https://www.pro-user.com/public/attachments/20410/Datasheets/2510_PUE_Datasheets_koelboxen_CoolZ%2032.pdf"',
		);
	});

	it("CoolZ 32: the film stays in the description after the features, the datasheet and the comparison are cards of their own", () => {
		const parsed = parseProductContent(COOLZ, { content: labels, comparison });
		const sections = liftSections(parsed?.blocks ?? [], templateFor(parsed?.template));
		const description = sections.description.join("");
		expect(description).toContain('class="maky-video"');
		expect(description.indexOf("maky-features")).toBeLessThan(description.indexOf("maky-video"));
		expect(sections.comparison).toContain("maky-cmp-table");
		expect(sections.documents?.body).toContain('class="maky-docs"');
		expect(sections.documents?.body).toContain("CoolZ%2032.pdf");
		expect(sections.documents?.body).not.toContain("maky-video");
	});

	it("the gallery: every role and every icon, nothing refused", () => {
		const parsed = parseProductContent(GALLERY, { content: labels, comparison });
		const html = parsed?.blocks.map((block) => block.html).join("\n") ?? "";
		expect(parsed).toMatchObject({ typed: true, template: "autochladnicka", issues: [] });
		for (const kind of ["tip", "info", "warn"]) expect(html).toContain(`maky-callout-${kind}`);
		for (const role of ["benefits", "inbox", "features", "steps", "faq", "specs", "docs", "video"]) {
			expect(count(html, new RegExp(`class="maky-${role}"`, "g")), role).toBe(1);
		}
		for (const icon of FEATURE_ICONS) expect(html, icon).toContain(`maky-ico-${icon}`);
		expect(html).toContain("maky-ico-sparkles");
		expect(parsed?.blocks.filter((block) => block.section === "documents")).toHaveLength(1);
	});

	it("the roof-rack set: every role CFM writes for it is read, and the page is put together from it", () => {
		const parsed = parseProductContent(RACK, { content: labels, comparison });
		const html = parsed?.blocks.map((block) => block.html).join("\n") ?? "";
		expect(parsed).toMatchObject({ typed: true, template: "stresny-nosic", issues: [] });
		expect(count(html, /<ul class="maky-inbox">/g)).toBe(1);
		expect(count(html, /<ul class="maky-benefits">/g)).toBe(1);
		expect(count(html, /<div class="maky-specs">/g)).toBe(1);
		expect(count(html, /class="maky-callout maky-callout-warn/g)).toBe(1);
		expect(count(html, /class="maky-callout maky-callout-info/g)).toBe(1);
		// Every benefit of a set is one sentence with no title of its own: each is set as a title.
		expect(count(html, /<strong class="maky-t">/g)).toBeGreaterThanOrEqual(3);
		expect(html).not.toContain('class="maky-d"><');

		// The page: the sheet is a card of its own, the rest of the document stays in order.
		const template = templateFor(parsed?.template);
		const sections = liftSections(parsed?.blocks ?? [], template);
		expect(sections.specs?.title).toBe("Technické parametre");
		expect(sections.specs?.body).toContain('<div class="maky-specs">');
		expect(sections.description.join("")).not.toContain("maky-specs");
		expect(sections.description.join("")).toContain("maky-inbox");
		expect(sections.comparison).toBeNull();
		expect(sections.documents).toBeNull();
		// Nothing was lost between the document and the two places it is shown: every block's text
		// is in one of them, once (the sheet only changed places).
		const shown = visible(
			[...sections.description, sections.specs?.title ?? "", sections.specs?.body ?? ""].join(" "),
		);
		const blockTexts = (parsed?.blocks ?? []).map((block) => visible(block.html));
		expect(blockTexts.filter((text) => !shown.includes(text))).toEqual([]);
		expect(shown.length).toBe(visible(html).length);

		// The key facts are the sheet's first rows, as the sheet writes them.
		expect(sheetFacts(sections, template).slice(0, 4)).toEqual([
			{ label: "Nosnosť", value: "do 75 kg (zostavy)" },
			{ label: "Dĺžka priečnikov", value: "127 cm" },
			{ label: "Materiál priečnikov", value: "Hliník" },
			{ label: "Profil", value: "Aerodynamický" },
		]);
	});

	it("lose no word: everything a shopper could read in the document is on the page", () => {
		for (const [name, sample] of [
			["CoolZ 32", COOLZ],
			["the gallery", GALLERY],
			["the roof-rack set", RACK],
		] as const) {
			const source = JSON.parse(sample) as { blocks: Block[] };
			const page = visible((parse(sample)?.blocks ?? []).map((block) => block.html).join(" "));
			const strings: string[] = [];
			const collect = (value: unknown): void => {
				if (typeof value === "string") strings.push(visible(value));
				else if (Array.isArray(value)) value.forEach(collect);
				else if (value && typeof value === "object") {
					const record = value as Record<string, unknown>;
					if (typeof record.content === "string") strings.push(visible(record.content));
					collect(record.items);
				}
			};
			for (const block of source.blocks) {
				if (typeof block.data.text === "string") strings.push(visible(block.data.text));
				// A video's title is the one text its block has.
				if (block.type === "embed" && typeof block.data.caption === "string")
					strings.push(visible(block.data.caption));
				collect(block.data.items);
				// The comparison table has its own contract: its marks are words on the page.
				if (block.type === "table" && block.id === "maky:specs") {
					(block.data.content as string[][]).flat().forEach((cell) => strings.push(visible(cell)));
				}
			}
			const missing = strings.filter((text) => text && !page.includes(text));
			expect(missing, name).toEqual([]);
			expect(strings.length, name).toBeGreaterThan(10);
		}
	});
});

describe("the fixed words of every market", () => {
	it.each(LOCALES)("%s has the words of the blocks, and a plural of years that parses", async (locale) => {
		const words = await getContentLabels(locale, CHANNEL_OF[locale]);
		for (const kind of ["tip", "info", "warn"] as const) {
			expect(words.callout[kind], `${locale} ${kind}`).toMatch(/\S/);
			expect(words.callout[kind]).not.toMatch(/[{}]/);
		}
		expect(new Set(Object.values(words.callout)).size).toBe(3);
		// The words of a video's preview: the action, and where the film is hosted and that nothing loads before the click.
		for (const text of [words.video.play, words.video.note]) {
			expect(text, locale).toMatch(/\S/);
			expect(text).not.toMatch(/[{}<>]/);
		}
		expect(words.video.note).toContain("YouTube");
		expect(words.video.play).not.toBe(words.video.note);
		if (locale !== "sk-SK")
			expect(words.video.play, locale).not.toBe((await getContentLabels("sk-SK", "sk-eur")).video.play);

		const t = createTranslator({
			locale,
			messages: load(locale) as never,
			namespace: "product" as never,
		}) as unknown as (key: string, values?: Record<string, string | number>) => string;
		for (const years of [1, 2, 3, 5, 10, 21]) {
			const text = t("content.years", { count: years });
			expect(text, `${locale} ${years}`).toContain(String(years));
			expect(text).not.toMatch(/[{}#]/);
		}
		expect(t("content.range", { min: "−20", max: "+20" })).toContain("−20");
	});
});

describe("the words that lead to the configurator", () => {
	const PHRASE = "našom konfigurátore";
	const HREF = "/sk/konfigurator";
	const SENTENCE = `Pred nákupom odporúčame overiť kompatibilitu v ${PHRASE}.`;
	const LINKED = `<a href="${HREF}">${PHRASE}</a>`;
	const render = (content: string, words: ContentLabels = labels): string =>
		(parseProductContent(content, { content: words })?.blocks ?? []).map((block) => block.html).join("\n");
	/** The market's words without the configurator's: set when it is asked for, as `labels` is only read in `beforeAll`. */
	const withoutLink = (): ContentLabels => ({ ...labels, configurator: undefined });

	it("belong to the Slovak market, with that market's own address, and to no market whose wording is not known", async () => {
		expect(labels.configurator).toEqual({ phrase: PHRASE, href: HREF });
		expect((await getContentLabels("sk-SK", "sk-eur")).configurator).toEqual({ phrase: PHRASE, href: HREF });
		for (const locale of LOCALES.filter((name) => name !== "sk-SK")) {
			expect((await getContentLabels(locale, CHANNEL_OF[locale])).configurator, locale).toBeUndefined();
		}
	});

	it("are a link in a warning's list, and nothing else of the sentence changes", () => {
		const content = doc(
			[list("maky:callout:warn", ["Pred každou jazdou skontrolujte utiahnutie.", SENTENCE])],
			RACK_VERSION,
		);
		const html = render(content);
		expect(html).toContain(`<li>Pred nákupom odporúčame overiť kompatibilitu v ${LINKED}.</li>`);
		expect(html).toContain("<li>Pred každou jazdou skontrolujte utiahnutie.</li>");
		expect(count(html, /<a /g)).toBe(1);
		// A link is a change of markup, not of words: take the anchor away and the page is what it was.
		const plain = render(content, withoutLink());
		expect(plain).not.toContain("<a ");
		expect(html.replace(/<a [^>]*>|<\/a>/g, "")).toBe(plain);
	});

	it("are a link in a callout that is one paragraph, whatever its kind", () => {
		for (const kind of ["warn", "info", "tip"]) {
			const html = render(doc([paragraph(SENTENCE, `maky:callout:${kind}`)]));
			expect(html, kind).toContain(`<p>Pred nákupom odporúčame overiť kompatibilitu v ${LINKED}.</p>`);
		}
	});

	it("are a way in once per box: the first time they stand in plain text", () => {
		const html = render(doc([list("maky:callout:warn", [SENTENCE, SENTENCE])]));
		expect(count(html, /<a /g)).toBe(1);
		expect(html).toContain(
			`<li>Pred nákupom odporúčame overiť kompatibilitu v ${LINKED}.</li><li>Pred nákupom odporúčame overiť kompatibilitu v ${PHRASE}.</li>`,
		);
		// Each box has its own: two callouts are two ways in.
		const two = render(
			doc([paragraph(SENTENCE, "maky:callout:warn"), paragraph(SENTENCE, "maky:callout:info")]),
		);
		expect(count(two, /<a /g)).toBe(2);
	});

	it("keep the link the producer wrote, and are never a link inside a link", () => {
		const own = `Overte to v <a href="https://www.thule.com/sk-sk/">${PHRASE}</a> výrobcu.`;
		const html = render(doc([paragraph(own, "maky:callout:warn")]));
		expect(count(html, /<a /g)).toBe(1);
		expect(html).toContain('href="https://www.thule.com/sk-sk/"');
		expect(html).not.toContain(HREF);
		// ...and the words that follow a link of its own are still found.
		const after = render(
			doc([paragraph(`<a href="https://www.thule.com/">Thule</a>: ${SENTENCE}`, "maky:callout:warn")]),
		);
		expect(after).toContain(`overiť kompatibilitu v ${LINKED}.`);
		expect(count(after, /<a /g)).toBe(2);
	});

	it("are left as text when a tag cuts them in two, and when they are not said in a callout", () => {
		const cut = render(
			doc([paragraph("Overte to v našom <strong>konfigurátore</strong>.", "maky:callout:warn")]),
		);
		expect(cut).not.toContain("<a ");
		const elsewhere = render(
			doc([
				header("Overenie v našom konfigurátore", 3),
				paragraph("Pozor.", "maky:callout:warn"),
				list("maky:benefits", [SENTENCE]),
				paragraph(SENTENCE),
			]),
		);
		expect(elsewhere).not.toContain("<a ");
	});

	it("are written into the markup as an address that is the page's own", () => {
		const outcome = renderRole(
			{ type: "paragraph", data: { text: SENTENCE } },
			{ role: "callout", kind: "warn" },
			null,
			{ ...labels, configurator: { phrase: PHRASE, href: '/sk/a"b' } },
		);
		expect("html" in outcome && outcome.html).toContain('<a href="/sk/a&quot;b">');
	});
});

describe("the styles of the typed blocks", () => {
	const css = readFileSync(join(ROOT, "src/styles/brand.css"), "utf8");

	it("hold a mask for every icon a block can draw (an icon without one is drawn as a plain square)", () => {
		for (const name of ICON_NAMES) {
			expect(css, name).toMatch(new RegExp(`\\.maky-ico-${name}\\s*\\{[^}]*--maky-ico:\\s*url\\(`));
		}
	});

	it("hold a rule for every class the video's preview is drawn with (a class without one is drawn unstyled)", () => {
		const html = htmlOf(doc([header("Video"), video()]));
		const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)));
		for (const name of classes) {
			if (name === "not-prose") continue;
			expect(css, name).toContain(`.${name}`);
		}
		expect(classes.has("maky-video-a")).toBe(true);
	});

	it("underline a link inside a callout, so it reads as a link without depending on its colour", () => {
		const rule = css.match(/\.maky-callout-b a\s*\{([^}]*)\}/)?.[1] ?? "";
		expect(rule).toMatch(/text-decoration:\s*underline/);
	});

	it("stand the video's preview in the middle of its block, capped in width (on a phone it fills the block, so nothing moves there)", () => {
		const rule = css.match(/\.maky-video\s*\{([^}]*)\}/)?.[1] ?? "";
		expect(rule).toMatch(/max-width:\s*42rem/);
		expect(rule).toMatch(/margin-inline:\s*auto/);
	});
});

/**
 * A set's box that names its parts (`meta` of an item of `maky:inbox`): how many, of what unit, which code and
 * which published product. The picture and the link are the catalogue's answer for the product, not the
 * document's own words.
 */
describe("the contents of the box, when an item names a part", () => {
	const PART_ID = "UHJvZHVjdDoxMDIwNQ==";
	const part = (meta: Record<string, unknown> | null, text = "<strong>Bočnice 210 cm</strong> dva páry") => ({
		content: text,
		items: [],
		...(meta ? { meta } : {}),
	});
	const box = (items: unknown[]) =>
		doc([header("Obsah balenia", 3), list("maky:inbox", items)], RACK_VERSION);
	const withProducts = (products: ContentLabels["products"]) => (content: string) =>
		(parseProductContent(content, { content: { ...labels, products } })?.blocks ?? [])
			.map((block) => block.html)
			.join("\n");

	it("draws the count, the unit and the code under the part's name", () => {
		const html = htmlOf(box([part({ qty: 2, unit: "páry", code: "N10209" })]));
		expect(html).toContain('<span class="maky-part-qty">2 × páry · N10209</span>');
		// Not in the catalogue (or never asked): the package mark stays and nothing is a link.
		expect(html).toContain("maky-ico-package");
		expect(html).not.toContain("<a ");
	});

	it("makes the whole part a link to its page, with the catalogue's picture, when the catalogue has it", () => {
		const html = withProducts(
			new Map([
				[
					PART_ID,
					{
						href: "/sk/bocnice-210-n10209",
						image: "/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.webp&w=256&q=75",
					},
				],
			]),
		)(box([part({ productId: PART_ID, qty: 2, unit: "páry", code: "N10209" })]));
		expect(html).toContain('<a class="maky-part-a" href="/sk/bocnice-210-n10209">');
		expect(html).toContain(
			'<img src="/_next/image?url=https%3A%2F%2Fcdn.example%2Fa.webp&amp;w=256&amp;q=75"',
		);
		expect(html).not.toContain("maky-ico-package");
	});

	it("draws no link for a product the catalogue did not answer for: the id alone is never an address", () => {
		const html = withProducts(new Map())(box([part({ productId: PART_ID, qty: 1, unit: "sada" })]));
		expect(html).not.toContain("<a ");
		expect(html).not.toContain("<img");
		expect(html).toContain("1 × sada");
	});

	it('says "view the part" inside the link, and only where there is a link', () => {
		const products = new Map([[PART_ID, { href: "/sk/x", image: null }]]);
		const html = (map: typeof products) =>
			(
				parseProductContent(box([part({ productId: PART_ID, qty: 1 })]), {
					content: { ...labels, products: map, viewPart: "Pozrieť diel" },
				})?.blocks ?? []
			)
				.map((block) => block.html)
				.join("\n");
		expect(html(products)).toContain('<span class="maky-part-go">Pozrieť diel</span></a>');
		expect(html(new Map())).not.toContain("Pozrieť diel");
	});

	it("takes a picture only from the image optimizer, whatever the map holds", () => {
		const html = withProducts(new Map([[PART_ID, { href: "/sk/x", image: "https://evil.example/a.jpg" }]]))(
			box([part({ productId: PART_ID })]),
		);
		expect(html).toContain('<a class="maky-part-a" href="/sk/x">');
		expect(html).not.toContain("evil.example");
		expect(html).not.toContain("<img");
	});

	it("reads only a whole positive count, a short unit and a code of a code's shape", () => {
		const html = htmlOf(
			box([
				part({ qty: 0, unit: "<b>sada</b>", code: "N1 <script>" }),
				part({ qty: 2.5, code: "2×N10035+N30302" }),
			]),
		);
		expect(html).not.toContain("script");
		expect(html).not.toContain("0 ×");
		expect(html).not.toContain("2.5");
		expect(html).toContain('<span class="maky-part-qty">sada</span>');
		expect(html).toContain('<span class="maky-part-qty">2×N10035+N30302</span>');
	});

	it("leaves an item that carries no part untouched", () => {
		expect(htmlOf(box([part(null)]))).toContain('<li><span class="maky-tile"');
	});

	it("lists the products a document names once, in order, from the boxes only", () => {
		const blocks = (
			JSON.parse(
				box([
					part({ productId: "AAA=" }),
					part({ productId: "BBB=" }),
					part({ productId: "AAA=" }),
					part({ productId: "not an id" }),
				]),
			) as { blocks: Parameters<typeof contentProductIds>[0] }
		).blocks;
		expect(contentProductIds(blocks)).toEqual(["AAA=", "BBB="]);
		const elsewhere = [{ type: "list", id: "maky:benefits", data: { items: [part({ productId: "CCC=" })] } }];
		expect(contentProductIds(elsewhere as never)).toEqual([]);
	});
});

describe("a maker's PDF among the documents", () => {
	it("does not carry the mark that says a file is saved, which a PDF opened in a tab on the maker's host does not do", () => {
		const html = htmlOf(
			doc(
				[
					header("Návody", 3),
					list("maky:documents", [
						'<a href="https://www.lampa.it/pdf/AZ/N/N10205-M-01.pdf">Zostavenie koša</a> PDF',
					]),
				],
				RACK_VERSION,
			),
		);
		expect(html).toContain('<a class="maky-doc-a" href="https://www.lampa.it/pdf/AZ/N/N10205-M-01.pdf"');
		expect(html).not.toContain("maky-ico-download");
		const onSite = htmlOf(
			doc(
				[header("Návody", 3), list("maky:documents", ['<a href="/docs/n.pdf">Návod</a> PDF'])],
				RACK_VERSION,
			),
		);
		expect(onSite).toContain("maky-ico-download");
	});
});

describe("the sections and the facts of a described page", () => {
	const named = (text: string, kind: string): Block => ({
		type: "header",
		id: `maky:section:${kind}`,
		data: { text, level: 3 },
	});

	it("draws a heading that names its kind with the kind in its class, and any other id as it did", () => {
		const html = htmlOf(
			doc(
				[named("Pre ktorý Crafter?", "compatibility"), paragraph("Text."), named("Čo ja viem", "nonsense")],
				RACK_VERSION,
			),
		);
		expect(html).toContain('<h3 class="maky-sec maky-sec-compatibility">Pre ktorý Crafter?</h3>');
		expect(html).not.toContain("maky-sec-nonsense");
		// A kind this reader does not know is reported, like a role it does not know, and the heading stays plain.
		expect(issuesOf(doc([named("Čo ja viem", "nonsense")], RACK_VERSION)).map((issue) => issue.code)).toEqual(
			["unknown-role"],
		);
	});

	it("lifts the kind of product and the key facts of a roof-rack set, with the icons it names", () => {
		const content = parse(
			doc(
				[
					paragraph("Kompletný strešný kôš s montážnou sadou", "maky:kind"),
					list("maky:facts", [
						{ content: "<strong>420 × 180 × 7 cm</strong> Rozmery koša", items: [], meta: { icon: "ruler" } },
						{ content: "<strong>L4</strong> Verzia vozidla", items: [], meta: { icon: "nonsense" } },
					]),
					paragraph("Úvod."),
				],
				RACK_VERSION,
			),
		);
		const kind = content?.blocks.find((block) => block.section === "kind");
		const facts = content?.blocks.find((block) => block.section === "facts");
		expect(kind?.body).toBe("Kompletný strešný kôš s montážnou sadou");
		// An icon outside the closed set is none.
		expect(facts?.facts).toEqual([
			{ label: "Rozmery koša", value: "420 × 180 × 7 cm", icon: "ruler" },
			{ label: "Verzia vozidla", value: "L4" },
		]);
		expect(facts?.html).toContain('<ul class="maky-tiles">');
	});

	it("draws the compatibility facts as tiles that stay in the description", () => {
		const content = parse(
			doc(
				[list("maky:facts:compat", [{ content: "<strong>od 01/2017</strong> Obdobie výroby", items: [] }])],
				RACK_VERSION,
			),
		);
		expect(content?.blocks[0].section).toBeUndefined();
		expect(content?.blocks[0].html).toContain(
			'<li class="maky-tl"><span class="maky-tl-v">od 01/2017</span><span class="maky-tl-k">Obdobie výroby</span>',
		);
	});

	it("refuses a fact that is not a value and its name, and keeps its text", () => {
		const html = htmlOf(doc([list("maky:facts", [{ content: "len text", items: [] }])], RACK_VERSION));
		expect(html).toContain("len text");
		expect(html).not.toContain("maky-tiles");
		expect(
			issuesOf(doc([list("maky:facts", [{ content: "len text", items: [] }])], RACK_VERSION)),
		).toHaveLength(1);
	});

	it("draws the accessories as cards of their own, with their own words for the link", () => {
		const products = new Map([
			["UHJvZHVjdDox", { href: "/sk/valec", image: "/_next/image?url=%2Fa.jpg&w=256&q=75" }],
		]);
		const html = parseProductContent(
			doc(
				[
					list("maky:inbox:accessories", [
						{
							content: "<strong>Valec</strong> Opora pri nakladaní.",
							items: [],
							meta: { productId: "UHJvZHVjdDox", code: "N10234" },
						},
					]),
				],
				RACK_VERSION,
			),
			{ content: { ...labels, products } },
		)?.blocks[0].html;
		expect(html).toContain('<ul class="maky-inbox maky-inbox-acc">');
		expect(html).toContain('href="/sk/valec"');
		expect(html).toContain(`<span class="maky-part-go">${labels.viewAccessory}</span>`);
		expect(labels.viewAccessory).not.toBe(labels.viewPart);
	});
});
