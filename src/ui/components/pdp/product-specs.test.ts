import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { getComparisonLabels } from "@/lib/comparison-labels";
import { getContentLabels } from "@/lib/content-labels";
import { parseProductContent } from "@/lib/editorjs";
import { formatProductAttributeValue, type AttributeInput } from "@/lib/product-attributes";
import { liftSections, sheetFacts, templateFor } from "@/lib/product-templates";
import { ProductHighlights } from "./product-highlights";
import { ProductSpecs } from "./product-specs";

/**
 * The parameters table and the key-facts band, rendered with the market's own message catalogue.
 *
 * The car-fridge page began to write units and years in the table ("60 W", "3 roky"). The attribute
 * names in the real catalogue already carry them — the production warranty is "Záruka (roky)" — so
 * the first deployment printed "Záruka (roky) 2 roky". The sandbox names the previews were made from
 * ("Záruka") could not show it; these tests run both kinds of name through the real components.
 */

const NBSP = "\u00a0";
const SK = "sk-SK";

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
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

// The click that opens a video is a client component that draws nothing. Its place in the page is
// what is tested here, so it is replaced by a marker that shows where it was put.
vi.mock("./video-click-to-play", () => ({
	VideoClickToPlay: () => createElement("i", { id: "video-click-to-play" }),
}));

const render = async (element: Promise<ReactNode> | ReactNode): Promise<string> =>
	renderToStaticMarkup(createElement(Fragment, null, await element));

const attribute = (key: string, name: string, value: string): AttributeInput => ({
	attribute: {
		name,
		slug: key.replace(/_/g, "-"),
		externalReference: `cfm:attribute:${key}`,
		inputType: "NUMERIC",
		unit: null,
	},
	values: [{ name: value }],
});

/** The value printed beside a row's name, or null when there is no such row. */
const rowValue = (html: string, label: string): string | null => {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`<dt[^>]*>${escaped}</dt><dd[^>]*>([^<]*)</dd>`).exec(html)?.[1] ?? null;
};

/** A CoolZ's parameters, named the way the catalogue names its attributes or the way the sandbox did. */
const cooler = (names: { warranty: string; power: string; netVolume: string; height: string }) => [
	attribute("volume", "Objem", "19"),
	attribute("net_volume", names.netVolume, "17"),
	attribute("rated_power", names.power, "60"),
	attribute("interior_height", names.height, "287"),
	attribute("warranty_years", names.warranty, "3"),
];

const STATING = {
	warranty: "Záruka (roky)",
	power: "Menovitý výkon (W)",
	netVolume: "Čistý objem (l)",
	height: "Výška vnútra (mm)",
};
const PLAIN = {
	warranty: "Záruka",
	power: "Menovitý výkon",
	netVolume: "Čistý objem",
	height: "Výška vnútra",
};

describe("the car fridge's parameters table", () => {
	const fridge = templateFor("autochladnicka");

	it("prints the bare number where the name already says the unit, never the unit twice", async () => {
		const html = await render(ProductSpecs({ attributes: cooler(STATING), locale: SK, template: fridge }));
		expect(rowValue(html, "Záruka (roky)")).toBe("3");
		expect(rowValue(html, "Menovitý výkon (W)")).toBe("60");
		expect(rowValue(html, "Čistý objem (l)")).toBe("17");
		expect(rowValue(html, "Výška vnútra (mm)")).toBe("287");
		expect(html).not.toMatch(/\(roky\)<\/dt><dd[^>]*>[^<]*roky/);
	});

	it("writes the unit where the name does not", async () => {
		const html = await render(ProductSpecs({ attributes: cooler(PLAIN), locale: SK, template: fridge }));
		expect(rowValue(html, "Záruka")).toBe("3 roky");
		expect(rowValue(html, "Menovitý výkon")).toBe(`60${NBSP}W`);
		expect(rowValue(html, "Čistý objem")).toBe(`17${NBSP}l`);
		expect(rowValue(html, "Výška vnútra")).toBe(`287${NBSP}mm`);
	});

	it("leaves the older units alone: the volume was always written with its litres", async () => {
		const html = await render(ProductSpecs({ attributes: cooler(STATING), locale: SK, template: fridge }));
		expect(rowValue(html, "Objem")).toBe(`19${NBSP}l`);
	});

	it("prints a product of another kind the way its page always did", async () => {
		// The generic page's flat list — a product that is not a fridge but has the warranty attribute.
		const html = await render(
			ProductSpecs({
				attributes: [
					attribute("warranty_years", "Záruka (roky)", "2"),
					attribute("weight", "Hmotnosť", "4,2"),
				],
				locale: SK,
			}),
		);
		expect(rowValue(html, "Záruka (roky)")).toBe("2");
		expect(rowValue(html, "Hmotnosť")).toBe(`4,2${NBSP}kg`);
	});
});

/**
 * A car fridge's page with the manufacturer's film and datasheet, made from the real description CFM
 * writes for CoolZ 32 (the shared sample): the film stays in the description card with the click that
 * opens it, the datasheet is a card of its own, and nothing of YouTube is on the page before a click.
 */
describe("a car fridge's page with its video", async () => {
	const fridge = templateFor("autochladnicka");
	const sample = readFileSync(
		path.join(process.cwd(), "docs/contracts/maky-content/coolz-32.description.json"),
		"utf8",
	);
	const content = parseProductContent(sample, {
		content: await getContentLabels(SK, "sk-eur"),
		comparison: await getComparisonLabels(SK),
	});
	const sections = liftSections(content?.blocks ?? [], fridge);

	const page = (description: string[]) =>
		render(
			ProductSpecs({
				descriptionHtml: description,
				comparisonHtml: sections.comparison,
				documents: sections.documents,
				template: fridge,
				attributes: cooler(STATING),
				locale: SK,
			}),
		);

	it("holds the film in the description card, with the click that opens it", async () => {
		const html = await page(sections.description);
		const card = html.slice(html.indexOf('id="product-description"'), html.indexOf('id="model-comparison"'));
		expect(card).toContain('class="maky-video"');
		expect(card).toContain('href="https://www.youtube.com/watch?v=D5lm_R-m3BA"');
		expect(html.match(/id="video-click-to-play"/g)).toHaveLength(1);
	});

	it("loads nothing of YouTube before a click: no frame, no video, no address of YouTube's but the link", async () => {
		const html = await page(sections.description);
		expect(html).not.toMatch(/<iframe|youtube-nocookie|<video/);
		expect(html.match(/youtube\.com/g)).toHaveLength(1);
		// The one picture asks this site's own optimizer; YouTube's still host is only the percent-encoded
		// address it is asked to fetch, so the shopper's browser has no request to make to it.
		const pictures = html.match(/<img [^>]*>/g) ?? [];
		expect(pictures).toHaveLength(1);
		expect(pictures[0]).toContain(
			'src="/_next/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2FD5lm_R-m3BA%2Fhqdefault.jpg',
		);
		expect(html.match(/https?:\/\/i\.ytimg\.com/g)).toBeNull();
	});

	it("sets the datasheet in the card of its own, under the name the page navigation uses", async () => {
		const html = await page(sections.description);
		expect(html).toContain('<article id="product-documents"');
		expect(html).toContain('href="#product-documents"');
		expect(html).toContain("Na stiahnutie");
		expect(html).toContain("CoolZ%2032.pdf");
	});

	it("ships no click for a page that has no video", async () => {
		const withoutVideo = sections.description.filter((html) => !html.includes("maky-video"));
		expect(withoutVideo.length).toBeLessThan(sections.description.length);
		const html = await page(withoutVideo);
		expect(html).not.toContain("video-click-to-play");
		expect(html).not.toContain("maky-video");
	});
});

describe("the key-facts band", () => {
	it("keeps the unit: the name is not beside the value there", async () => {
		const html = await render(
			ProductHighlights({
				attributes: cooler(STATING),
				locale: SK,
				template: templateFor("autochladnicka"),
			}),
		);
		expect(html).toContain(`Príkon 60${NBSP}W`);
		expect(html).toContain(`Objem 19${NBSP}l`);
	});
});

/**
 * A roof-rack set's page, made from the real description CFM writes for one (the shared sample, a
 * Thule set typed as `maky-content/1:stresny-nosic`): the sheet in a card of its own, the band
 * from its first rows. The page is tried with no attributes and with the maker alone: which
 * attributes a production set carries was not read, and the card must be right either way.
 */
describe("a roof-rack set's page", async () => {
	const rack = templateFor("stresny-nosic");
	const sample = readFileSync(
		path.join(process.cwd(), "docs/contracts/maky-content/set-thule-71732.description.json"),
		"utf8",
	);
	const content = parseProductContent(sample, { content: await getContentLabels(SK, "sk-eur") });
	const sections = liftSections(content?.blocks ?? [], rack);
	const maker = attribute("manufacturer", "Výrobca", "Thule");

	const specs = (extra: Partial<Parameters<typeof ProductSpecs>[0]> = {}) =>
		render(
			ProductSpecs({
				descriptionHtml: sections.description,
				specs: sections.specs,
				template: rack,
				attributes: [],
				locale: SK,
				...extra,
			}),
		);

	it("sets the description's parameter sheet in a card of its own, titled by the document, with a jump link", async () => {
		const html = await specs();
		expect(html).toMatch(/<h2 id="technical-parameters-heading"[^>]*>Technické parametre<\/h2>/);
		expect(html).toContain('<section id="technical-parameters"');
		expect(html).toContain('href="#technical-parameters"');
		// The sheet's rows are the document's, once: not in the description's card as well.
		expect(rowValue(html, "Nosnosť")).toBe("do 75 kg (zostavy)");
		expect(rowValue(html, "Typ upevnenia")).toBe("na klasické lyžiny");
		expect(html.match(/<dt>Nosnosť<\/dt>/g)).toHaveLength(1);
		// The rest of the document stays in the description.
		expect(html).toContain("maky-inbox");
		expect(html).toContain("maky-callout-warn");
	});

	it("keeps the product's own attributes in the same card, under the sheet: no row is dropped", async () => {
		const html = await specs({ attributes: [maker] });
		expect(html.indexOf("T-drážka v priečniku")).toBeLessThan(html.indexOf("Výrobca"));
		expect(rowValue(html, "Výrobca")).toBe("Thule");
		expect(html.match(/id="technical-parameters"/g)).toHaveLength(1);
	});

	it("is the page it always was for the same product without the template's sheet", async () => {
		const html = await specs({ specs: null, template: templateFor(null), attributes: [maker] });
		// The generic page lifts nothing: the card holds the attributes only.
		expect(rowValue(html, "Výrobca")).toBe("Thule");
		expect(rowValue(html, "Nosnosť")).toBeNull();
	});

	it("opens with the sheet's first four rows as the key facts, the value over its name, without icons", async () => {
		const html = await render(
			ProductHighlights({
				attributes: [maker],
				locale: SK,
				template: rack,
				sheet: sheetFacts(sections, rack),
			}),
		);
		expect(html.match(/<li/g)).toHaveLength(4);
		for (const [value, label] of [
			["do 75 kg (zostavy)", "Nosnosť"],
			["127 cm", "Dĺžka priečnikov"],
			["Hliník", "Materiál priečnikov"],
			["Aerodynamický", "Profil"],
		]) {
			expect(html).toMatch(new RegExp(`>${value.replace(/[()]/g, "\\$&")}</span><span[^>]*>${label}</span>`));
		}
		// No icon is guessed for a row of text.
		expect(html).not.toContain("<svg");
		expect(html).not.toContain("Farba");
	});

	it("keeps the band the attributes make when they make one: the sheet does not mix in", async () => {
		const html = await render(
			ProductHighlights({
				attributes: [
					attribute("bike_capacity", "Počet bicyklov", "2"),
					attribute("max_load", "Nosnosť", "60"),
				],
				locale: SK,
				template: rack,
				sheet: sheetFacts(sections, rack),
			}),
		);
		expect(html).toContain("Pre 2 bicykle");
		expect(html).not.toContain("do 75 kg");
	});

	it("has no band at all when the sheet gives fewer than two rows", async () => {
		const html = await render(
			ProductHighlights({
				attributes: [],
				locale: SK,
				template: rack,
				sheet: [{ label: "Nosnosť", value: "do 75 kg (zostavy)" }],
			}),
		);
		expect(html).toBe("");
	});

	it("builds no band from a sheet for a template that does not say so", async () => {
		const html = await render(
			ProductHighlights({ attributes: [], locale: SK, template: templateFor(null), sheet: [] }),
		);
		expect(html).toBe("");
		expect(sheetFacts(sections, templateFor(null))).toEqual([]);
	});
});

describe.each([
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
])("the warranty in %s", (locale) => {
	// Each market's own plural gives the word its attribute name would carry in brackets.
	const t = createTranslator({ locale, messages: load(locale) as never, namespace: "product" as never });
	const years = (count: number) => t("content.years" as never, { count } as never) as string;
	const word = years(2)
		.replace(/[^\p{L}]+/gu, " ")
		.trim();
	const beside = { nameBesideValue: true };

	it("is the bare number under a name that says years in the market's words", () => {
		expect(word).not.toBe("");
		const stated = attribute("warranty_years", `Warranty (${word})`, "3");
		expect(formatProductAttributeValue(stated, locale, undefined, years, beside)).toEqual(["3"]);
	});

	it("is the plural under a name that does not", () => {
		const plain = attribute("warranty_years", "Warranty", "3");
		expect(formatProductAttributeValue(plain, locale, undefined, years, beside)).toEqual([years(3)]);
		expect(years(3)).toMatch(/3/);
	});
});
