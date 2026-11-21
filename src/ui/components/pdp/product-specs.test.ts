import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { getComparisonLabels } from "@/lib/comparison-labels";
import { getContentLabels } from "@/lib/content-labels";
import { parseProductContent } from "@/lib/editorjs";
import { withGalleryPhotos } from "@/lib/gallery-photos";
import { formatProductAttributeValue, type AttributeInput } from "@/lib/product-attributes";
import { layoutFor, liftSections, sheetFacts, templateFor } from "@/lib/product-templates";
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

/**
 * A Nordrive Kargo page, from the sample both repositories are to agree on (`set-kargo-crafter-NKR9944`):
 * the description carries pictures of its own, so it is set as sections, the maker's PDFs get their card and
 * the gallery's second photo is not drawn beside it.
 */
describe("a bike carrier's page (Pro-USER Diamant FG3)", async () => {
	// The description is rebuilt from CFM's text preview of 18. 11. 2026 (`docs/contracts/maky-content/`
	// `nosic-bicyklov-diamant-fg3.description.json`), not CFM's own document: it shows what the reader makes of
	// that text, not what Saleor holds. The gallery's items are fixtures too, with the alt CFM wrote for each.
	const sample = readFileSync(
		path.join(process.cwd(), "docs/contracts/maky-content/nosic-bicyklov-diamant-fg3.description.json"),
		"utf8",
	);
	const ALTS: Record<string, string> = {
		"fg3-sklopeny.jpg": "Nosič Pro-USER Diamant FG3 sklopený aj s bicyklami na ťažnom zariadení auta",
		"fg3-predny.jpg":
			"Nosič 3 bicyklov Pro-USER Diamant FG3 – pohľad zozadu so svetlami a držiakom evidenčného čísla",
		"fg3-rameno.jpg": "Odnímateľné upínacie rameno nosiča Pro-USER Diamant FG3",
		"fg3-popruh-ebike.jpg": "Široký uzamykateľný popruh upínacieho ramena na ráme elektrobicykla",
		"fg3-zlozeny.jpg": "Zložený nosič bicyklov Pro-USER Diamant FG3",
		"rozsirenie-91749.jpg": "Prídavný nosič +1 bicykel Pro-USER pre rad Diamant FG",
	};
	const media = Object.entries(ALTS).map(([name, alt]) => ({
		url: `https://cdn.maky.store/media/products/${name}`,
		photo: `https://cdn.maky.store/thumbnails/products/${name}_1024.webp`,
		type: "IMAGE",
		alt,
		metadata: [{ key: "cfm_source_url", value: `https://carfitmanager.com/media/fixture/${name}` }],
	}));
	const labels = await getContentLabels(SK, "sk-eur");
	const attributes = [
		attribute("bike_capacity", "Počet bicyklov", "3"),
		attribute("max_load", "Max. nosnosť", "60"),
		attribute("weight", "Hmotnosť nosiča", "22,3"),
		{
			attribute: {
				name: "Vhodný pre e-bike",
				slug: "ebike-compatible",
				externalReference: "cfm:attribute:ebike_compatible",
				inputType: "BOOLEAN",
				unit: null,
			},
			values: [{ name: "Áno", boolean: true }],
		},
		attribute("manufacturer", "Výrobca", "Pro-USER"),
	] as AttributeInput[];

	const prepare = (description: string) => {
		const content = parseProductContent(withGalleryPhotos(description, media), { content: labels });
		const template = layoutFor(templateFor(content?.template), content?.blocks ?? []);
		return { content, template, sections: liftSections(content?.blocks ?? [], template) };
	};
	const { content, template, sections } = prepare(sample);
	const page = () =>
		render(
			ProductSpecs({
				descriptionHtml: sections.description,
				documents: sections.documents,
				specs: sections.specs,
				template,
				attributes,
				locale: SK,
				image: { url: "/gallery-second.jpg", alt: "druhá fotka galérie" },
			}),
		);

	it("is read as the bike carrier's template, as sections, with nothing the reader had to refuse", () => {
		expect(content?.template).toBe("nosic-bicyklov");
		expect(content?.issues).toEqual([]);
		expect(template.id).toBe("nosic-bicyklov");
		expect(template.sections).toBe(true);
	});

	it("says each parameter once: an attribute the sheet already names is not a second row, whatever its value says", async () => {
		const html = await page();
		const sheet = html.slice(
			html.indexOf('id="technical-parameters"'),
			html.indexOf('id="product-documents"'),
		);
		// The sheet's own wording stays ("3 (+1 s rozšírením TK91749)"), the attribute's "3" is not printed beside it.
		expect(sheet.match(/<dt[^>]*>Počet bicyklov<\/dt>/g)).toHaveLength(1);
		expect(rowValue(sheet, "Počet bicyklov")).toBe("3 (+1 s rozšírením TK91749)");
		expect(sheet.match(/<dt[^>]*>Max\. nosnosť<\/dt>/g)).toHaveLength(1);
		expect(rowValue(sheet, "Max. nosnosť")).toBe("60 kg");
		expect(sheet.match(/<dt[^>]*>Vhodný pre e-bike<\/dt>/g)).toHaveLength(1);
		// What the sheet does not say is kept: the maker is the product's own.
		expect(rowValue(sheet, "Výrobca")).toBe("Pro-USER");
		// The sheet keeps the producer's groups.
		for (const group of ["Kapacita", "Bicykle", "Upevnenie na auto", "Funkcie a zabezpečenie", "Rozmery"]) {
			expect(sheet).toContain(group);
		}
	});

	it("calls each photograph by the alt CFM wrote in the gallery, and keeps its caption as the caption", async () => {
		const html = await page();
		for (const [name, alt] of Object.entries(ALTS)) {
			expect(html, name).toContain(
				`src="https://cdn.maky.store/thumbnails/products/${name}_1024.webp" alt="${alt}"`,
			);
		}
		expect(html).toContain(
			"<figcaption>Sklopený nosič s naloženými bicyklami uvoľní prístup k piatym dverám.</figcaption>",
		);
		// The alt is not the caption's text, and the caption is not the alt's.
		expect(html).not.toContain('alt="Sklopený nosič s naloženými bicyklami uvoľní');
		expect(html).not.toContain(`<figcaption>${ALTS["fg3-sklopeny.jpg"]}</figcaption>`);
		expect(html.match(/<figcaption>/g)?.length).toBeGreaterThanOrEqual(6);
	});

	it("falls back to the caption as the alt for a photograph the gallery does not hold, as before", async () => {
		const { sections: bare } = prepare(
			sample.replace(
				/"https:\/\/carfitmanager\.com\/media\/fixture\/fg3-rameno\.jpg"/,
				'"https://carfitmanager.com/media/fixture/unknown.jpg"',
			),
		);
		const html = await render(
			ProductSpecs({ descriptionHtml: bare.description, template, attributes: [], locale: SK }),
		);
		expect(html).toContain('alt="Upínacie ramená sa dajú nasadiť aj odobrať."');
	});

	it("keeps the producer's facts in the text, next to the paragraph that asks the shopper to compare them", async () => {
		const html = await page();
		const card = html.slice(html.indexOf('<article id="product-description"'), html.indexOf("</article>"));
		expect(sections.facts).toBeNull();
		expect(card).toContain("maky-tiles");
		for (const value of ["3 bicykle (+1)", "135 cm", "8 cm", "35 cm", "23 cm"]) expect(card).toContain(value);
		expect(card.indexOf("Aké bicykle na nosič naložíte")).toBeLessThan(card.indexOf("maky-tiles"));
	});

	it("opens with the band the product's attributes make, not with rows of the sheet", async () => {
		const band = await render(
			ProductHighlights({ attributes, locale: SK, template, sheet: sheetFacts(sections, template) }),
		);
		expect(band).toContain("Pre 3 bicykle");
		expect(band).not.toContain("Počet bicyklov");
		expect(sheetFacts(sections, template)).toEqual([]);
	});

	it("sets the maker's manual in a card of its own, after the parameters and before the questions", async () => {
		const html = await page();
		expect(html).toContain('href="#product-documents"');
		expect(html.indexOf('id="technical-parameters"')).toBeLessThan(html.indexOf('id="product-documents"'));
		expect(html.indexOf('id="product-documents"')).toBeLessThan(html.indexOf('id="product-faq"'));
		const documents = html.slice(html.indexOf('id="product-documents"'), html.indexOf('id="product-faq"'));
		expect(documents).toContain("Návod výrobcu (PDF)");
		expect(documents).toContain("Pro-USER Diamant FG – návod na montáž a bezpečnostné pokyny");
		// Once: not in the assembly section as well.
		expect(html.match(/návod na montáž a bezpečnostné pokyny/g)).toHaveLength(1);
	});

	it("does not draw the gallery's second photo beside the description, which shows its own", async () => {
		expect(await page()).not.toContain("druhá fotka galérie");
	});

	it("puts the two films in the text with the click that opens them, and loads nothing of YouTube", async () => {
		const html = await page();
		expect(html.match(/maky-video-a/g)).toHaveLength(2);
		expect(html).not.toContain("<iframe");
	});

	it("is the generic page for the same document without the template's name: nothing is lifted", () => {
		const unnamed = JSON.stringify({ ...(JSON.parse(sample) as object), version: "maky-content/1" });
		const generic = prepare(unnamed);
		expect(generic.template.id).toBe("generic");
		expect(generic.sections.specs).toBeNull();
		expect(generic.sections.documents).toBeNull();
	});
});

describe("a Kargo set's page", async () => {
	const sample = readFileSync(
		path.join(process.cwd(), "docs/contracts/maky-content/set-kargo-crafter-NKR9944.description.json"),
		"utf8",
	);
	const labels = await getContentLabels(SK, "sk-eur");
	const content = parseProductContent(sample, { content: labels });
	const template = layoutFor(templateFor(content?.template), content?.blocks ?? []);
	const sections = liftSections(content?.blocks ?? [], template);
	const page = () =>
		render(
			ProductSpecs({
				descriptionHtml: sections.description,
				documents: sections.documents,
				specs: sections.specs,
				template,
				attributes: [],
				locale: SK,
				image: { url: "/gallery-second.jpg", alt: "druhá fotka galérie" },
			}),
		);

	it("is set as the sections of one card, under one heading for the whole description", async () => {
		const html = await page();
		expect(html).toContain('id="product-description" aria-label="Popis produktu"');
		expect(html.match(/id="product-description"/g)).toHaveLength(1);
		// One raised card for the description; a hairline and a gap between its sections, not a card each.
		const card = html.slice(html.indexOf('<article id="product-description"'), html.indexOf("</article>"));
		// The fixed words are no heading any more (the other cards keep theirs): the card is named by a label.
		expect(card).not.toContain("product-description-heading");
		expect(card.match(/<section class="[^"]*border-t/g)?.length).toBeGreaterThan(5);
		expect(card).toContain("<h3>Čo dostanete v balení</h3>");
		// The questions and the closing stand in cards of their own, after the parameters.
		expect(html.indexOf('id="technical-parameters"')).toBeLessThan(html.indexOf('id="product-faq"'));
		expect(card).not.toContain("maky-faq");
	});

	it("writes the kind of section over a heading that names it, in the shopper's language", async () => {
		const html = await page();
		for (const word of ["Kompatibilita", "Využitie v praxi", "Vhodné doplnky", "O značke", "Poradíme vám"]) {
			expect(html).toMatch(new RegExp(`uppercase">[^<]*<span[^>]*></span>${word}</p>`));
		}
		// The introduction has no small title: "Popis produktu" over the producer's own heading was the
		// fixed phrase again, in another place (2026-11-17).
		expect(html).not.toMatch(/uppercase">[^<]*<span[^>]*><\/span>Popis produktu<\/p>/);
		expect(html).not.toContain("Popis produktu</");
	});

	it("draws the introduction's own heading as the second-level heading when the description has no title", async () => {
		const html = await page();
		const card = html.slice(html.indexOf('<article id="product-description"'), html.indexOf("</article>"));
		// Kargo writes the heading as an h3 with its kind; the page draws it as the h2 under the product's h1.
		expect(card).toMatch(/<h2 class="maky-sec maky-sec-intro">[^<]+<\/h2>/);
		expect(card).not.toMatch(/<h3 class="maky-sec maky-sec-intro"/);
		expect(card.match(/<h2[ >]/g)).toHaveLength(1);
	});

	it("puts a lone picture of a section beside its text and several in a row under it, none among the paragraphs", async () => {
		const html = await page();
		const beside = html.split("lg:grid lg:grid-cols-2").slice(1);
		expect(beside.length).toBeGreaterThan(1);
		// The picture column is at least half the card, and the text column holds no picture.
		for (const part of beside) expect(part.split('class="maky-figs')[0]).not.toContain("<figure>");
		// Every second lone picture stands on the left.
		expect(html).toContain("lg:order-1");
		expect(html).toContain("lg:order-2");
		const rows = await render(
			ProductSpecs({
				descriptionHtml: [
					"<h3>Doplnky</h3>",
					"<p>Text</p>",
					"<figure><img src='/a.jpg' alt=''></figure>",
					"<figure><img src='/b.jpg' alt=''></figure>",
				],
				template: { ...template, sections: true },
				attributes: [],
				locale: SK,
			}),
		);
		expect(rows).toContain("sm:grid-cols-2 xl:grid-cols-3");
	});

	it("sets a section with pictures under its small headings as pairs, one picture for each", async () => {
		const html = await render(
			ProductSpecs({
				descriptionHtml: [
					"<h3>Konštrukcia a upevnenie</h3>",
					"<h4>Moduly</h4>",
					"<p>Text modulov</p>",
					"<figure><img src='/a.jpg' alt=''></figure>",
					"<h4>Upevnenie</h4>",
					"<p>Text upevnenia</p>",
					"<figure><img src='/b.jpg' alt=''></figure>",
				],
				template: { ...template, sections: true },
				attributes: [],
				locale: SK,
			}),
		);
		expect(html.match(/lg:grid lg:grid-cols-2/g)).toHaveLength(2);
		expect(html.indexOf("Text modulov")).toBeLessThan(html.indexOf("/a.jpg"));
		expect(html.indexOf("/a.jpg")).toBeLessThan(html.indexOf("Text upevnenia"));
		// The pair's text and its picture change sides from one pair to the next.
		expect(html).toContain("lg:order-2");
	});

	it("does not draw the gallery's photo beside it: the description shows its own pictures", async () => {
		const html = await page();
		expect(html).not.toContain("gallery-second.jpg");
		expect(html).toContain("<figure>");
	});

	it("keeps the maker's PDFs in the assembly, under the steps, and not in a card of their own", async () => {
		const html = await page();
		expect(html).not.toContain('<article id="product-documents"');
		expect(html).not.toContain('href="#product-documents"');
		expect(html.match(/lampa\.it\/pdf\/AZ\/N\/N10205-M-01\.pdf/g)).toHaveLength(1);
		const steps = html.indexOf('class="maky-steps"');
		const docs = html.indexOf('class="maky-docs"');
		const warning = html.indexOf("maky-callout-warn");
		expect(steps).toBeGreaterThan(0);
		expect(steps).toBeLessThan(docs);
		expect(docs).toBeLessThan(warning);
	});

	it("keeps the set's sheet in its own card and every section of the document, in its order", async () => {
		const html = await page();
		expect(html).toContain('<section id="technical-parameters"');
		const order = [
			"Prečo kôš Kargo Rack",
			"Čo dostanete v balení",
			"Doplnky ku košu",
			"Montáž a návody",
			"Dôležité upozornenia",
		];
		const at = order.map((heading) => html.indexOf(heading));
		expect(at.every((index) => index > 0)).toBe(true);
		expect([...at].sort((a, b) => a - b)).toEqual(at);
	});

	it("is one card with the gallery photo beside it for a description that carries no pictures of its own", async () => {
		const thule = parseProductContent(
			readFileSync(
				path.join(process.cwd(), "docs/contracts/maky-content/set-thule-71732.description.json"),
				"utf8",
			),
			{ content: labels },
		);
		const laid = layoutFor(templateFor(thule?.template), thule?.blocks ?? []);
		expect(laid.sections).toBeUndefined();
		const html = await render(
			ProductSpecs({
				descriptionHtml: liftSections(thule?.blocks ?? [], laid).description,
				template: laid,
				attributes: [],
				locale: SK,
				image: { url: "/gallery-second.jpg", alt: "druhá fotka galérie" },
			}),
		);
		expect(html.match(/<article/g)).toHaveLength(1);
		expect(html).toContain("gallery-second.jpg");
	});
});

/**
 * The description's title: CFM's first block, a heading of the second level, is the card's heading in
 * place of the fixed words ("Popis produktu", "Produktbeschreibung"). Without one the card has no
 * heading and the text starts the card.
 */
describe("the title of a description", () => {
	const intro = "<p>SnowDrive S-16 sú zosilnené snehové reťaze.</p>";
	const card = (html: string) =>
		html.slice(html.indexOf('<article id="product-description"'), html.indexOf("</article>"));
	const page = (descriptionHtml: string[], locale = SK) =>
		render(ProductSpecs({ descriptionHtml, attributes: [], locale }));

	it("is the heading of the card, once, and the fixed words are not said", async () => {
		const html = await page([
			"<h2>Snehové reťaze na diskoch R14 až R19: zosilnené články, montáž zvonka</h2>",
			intro,
			"<h2>Rozmery pneumatík pre kód N16105</h2>",
			"<p>Tabuľka.</p>",
		]);
		const description = card(html);
		expect(description).toContain('aria-labelledby="product-description-heading"');
		expect(description).toContain(
			'<h2 id="product-description-heading" class="text-text-primary mb-5 text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">Snehové reťaze na diskoch R14 až R19: zosilnené články, montáž zvonka</h2>',
		);
		expect(description.match(/Snehové reťaze na diskoch R14 až R19/g)).toHaveLength(1);
		expect(description).not.toContain("Popis produktu");
		// The text runs on under it; a heading further down stays a heading of the text.
		expect(description.indexOf("product-description-heading")).toBeLessThan(
			description.indexOf("zosilnené snehové reťaze"),
		);
		expect(description).toContain("<h2>Rozmery pneumatík pre kód N16105</h2>");
	});

	it("is said in the market's language and is nowhere replaced by the fixed words", async () => {
		const html = await page(
			["<h2>Schneeketten auf Felgen R14 bis R19: verstärkte Glieder</h2>", "<p>Text.</p>"],
			"de-DE",
		);
		expect(html).toContain("Schneeketten auf Felgen R14 bis R19: verstärkte Glieder</h2>");
		expect(html).not.toContain("Produktbeschreibung</h2>");
	});

	it("leaves the card without any heading when the description has none, and starts it with the text", async () => {
		const html = await page([intro, "<h2>Rozmery pneumatík pre kód N16105</h2>", "<p>Tabuľka.</p>"]);
		const description = card(html);
		expect(description).toContain('id="product-description" aria-label="Popis produktu"');
		expect(description).not.toContain("product-description-heading");
		expect(description).not.toContain("Popis produktu</h2>");
		expect(description.indexOf("<h2>")).toBeGreaterThan(description.indexOf("zosilnené snehové reťaze"));
	});

	it("does not mistake a heading of another level at the top for the title", async () => {
		const html = await page(["<h3>Pre aké auto</h3>", intro]);
		expect(card(html)).toContain("<h3>Pre aké auto</h3>");
		expect(card(html)).not.toContain("product-description-heading");
	});

	it("is the heading of a description set as sections too", async () => {
		const html = await render(
			ProductSpecs({
				descriptionHtml: [
					"<h2>Strešný nosič na hladkú strechu</h2>",
					"<p>Úvod.</p>",
					"<h3>Pre aké auto</h3>",
					"<p>Auto.</p>",
				],
				attributes: [],
				locale: SK,
				template: { ...templateFor("stresny-nosic"), sections: true },
			}),
		);
		const description = card(html);
		expect(description).toContain('aria-labelledby="product-description-heading"');
		expect(description.match(/Strešný nosič na hladkú strechu/g)).toHaveLength(1);
		expect(description.indexOf("product-description-heading")).toBeLessThan(
			description.indexOf("<h3>Pre aké auto</h3>"),
		);
		expect(html).not.toContain('class="sr-only"');
	});
});
