import { describe, expect, it } from "vitest";
import { parseEditorJSToHtml, parseEditorJSToText, TABLE_SCROLL_CLASS } from "./editorjs";

const document = (blocks: unknown[]) => JSON.stringify({ time: 1, version: "2.30", blocks });

describe("safe Editor.js rendering", () => {
	it("renders supported text and table blocks", () => {
		const result = parseEditorJSToHtml(
			document([
				{ type: "paragraph", data: { text: "Kompletný <strong>set</strong>" } },
				{
					type: "table",
					data: {
						withHeadings: true,
						content: [
							["Parameter", "Hodnota"],
							["Nosnosť", "75 kg"],
						],
					},
				},
			]),
		);
		expect(result?.join(" ")).toContain("<strong>set</strong>");
		expect(result?.join(" ")).toContain("<thead>");
		expect(result?.join(" ")).toContain("75 kg");
	});

	it("renders images with stable dimensions and lazy loading", () => {
		const result = parseEditorJSToHtml(
			document([
				{ type: "image", data: { file: { url: "https://img.example/rack.webp" }, caption: "Nosič" } },
			]),
		)?.join("");
		expect(result).toContain('width="1024"');
		expect(result).toContain('height="768"');
		expect(result).toContain('loading="lazy"');
	});

	it("asks this site's optimizer for a photograph that CFM serves", () => {
		const url = "https://carfitmanager.com/media/kargo/ford-tourneo-courier-b460.jpg";
		const result = parseEditorJSToHtml(
			document([{ type: "image", data: { file: { url }, caption: "Upevnenie na strechu" } }]),
		)?.join("");
		const encoded = encodeURIComponent(url);
		expect(result).toContain(`src="/_next/image?url=${encoded}&amp;w=1080&amp;q=75"`);
		expect(result).toContain('loading="lazy"');
		expect(result).toContain("<figcaption>Upevnenie na strechu</figcaption>");
		expect(result).not.toContain(`src="${url}"`);
	});

	it("leaves every other address, and a CFM address that is not a media path, as it came", () => {
		for (const url of [
			"https://img.example/rack.webp",
			"https://carfitmanager.com/admin/logo.png",
			"https://carfitmanager.com/media/a.jpg?x=1",
			"https://carfitmanager.com.example.com/media/a.jpg",
			"http://carfitmanager.com/media/a.jpg",
		]) {
			const result = parseEditorJSToHtml(document([{ type: "image", data: { file: { url } } }]))?.join("");
			expect(result, url).not.toContain("/_next/image");
			expect(result, url).not.toContain("srcset");
		}
	});

	it("drops iframe, raw, and unknown blocks", () => {
		const result = parseEditorJSToHtml(
			document([
				{ type: "embed", data: { embed: "https://video.example", html: "<iframe></iframe>" } },
				{ type: "raw", data: { html: "<script>alert(1)</script>" } },
				{ type: "future", data: { text: "secret fallback" } },
				{ type: "paragraph", data: { text: "Bezpečný text" } },
			]),
		)?.join("");
		expect(result).toBe("<p>Bezpečný text</p>");
		expect(result).not.toContain("iframe");
		expect(result).not.toContain("script");
	});

	it("never prints malformed or non-Editor JSON", () => {
		expect(parseEditorJSToHtml('{"unexpected":"raw json"}')).toBeNull();
		expect(parseEditorJSToHtml("{broken")).toBeNull();
		expect(parseEditorJSToText('{"unexpected":"raw json"}')).toBeNull();
	});
});

/**
 * A representative Nordrive-shaped description: a specification table, a very
 * long unbroken value, a list, a link and an image.
 *
 * None of the 60 live sk products sampled on 2026-09-05 carries a table block,
 * so this fixture is the test — waiting for a wide table to reach production
 * before fixing the renderer is how the page starts panning sideways on a phone.
 */
const NORDRIVE_DESCRIPTION = JSON.stringify({
	blocks: [
		{ type: "header", data: { level: 2, text: "Technické parametre" } },
		{
			type: "table",
			data: {
				withHeadings: true,
				content: [
					["Parameter", "Hodnota", "Norma", "Poznámka", "Objednávacie číslo"],
					["Nosnosť", "75 kg", "ISO 11154", "pri rovnomernom zaťažení", "NDR-1234-5678-90"],
					["Materiál", "hliník", "EN 573-3", "eloxovaný", "NDR-OOOOOOOOOOOOOOOOOOOOOOOOOOOO"],
				],
			},
		},
		{ type: "list", data: { style: "unordered", items: ["Priečniky", "Pätky", "Montážny kit"] } },
		{ type: "paragraph", data: { text: 'Viac v <a href="/sk/poradna">poradni</a>.' } },
		{
			type: "image",
			data: { file: { url: "https://cdn.maky.store/a.jpg" }, caption: "Nordrive", width: 1600, height: 900 },
		},
	],
});

describe("wide content does not widen the page", () => {
	const html = () => parseEditorJSToHtml(NORDRIVE_DESCRIPTION)!.join("");

	it("wraps a table in a scroll container", () => {
		expect(html()).toContain(`<div class="${TABLE_SCROLL_CLASS}"><table>`);
	});

	it("keeps the table itself semantic inside the wrapper", () => {
		const out = html();
		expect(out).toContain("<thead><tr><th>Parameter</th>");
		expect(out).toContain("<td>75 kg</td>");
	});

	it("renders every other block type alongside it", () => {
		const out = html();
		expect(out).toContain("<h2>Technické parametre</h2>");
		expect(out).toContain("<li>Montážny kit</li>");
		expect(out).toContain('href="/sk/poradna"');
		expect(out).toContain('<img src="https://cdn.maky.store/a.jpg"');
	});

	it("still strips a script hidden in a table cell", () => {
		const evil = JSON.stringify({
			blocks: [{ type: "table", data: { content: [["<script>alert(1)</script>ok"]] } }],
		});
		const out = parseEditorJSToHtml(evil)!.join("");
		expect(out).not.toContain("<script");
		expect(out).toContain("ok");
	});

	it("refuses any class other than the scroll container's", () => {
		// `class` was whitelisted on div solely for the wrapper. Nothing from
		// Saleor may use it as a styling channel.
		const evil = JSON.stringify({
			blocks: [{ type: "paragraph", data: { text: '<div class="fixed inset-0 z-50">hijack</div>' } }],
		});
		const out = parseEditorJSToHtml(evil)!.join("");
		expect(out).not.toContain("fixed inset-0");
		expect(out).not.toContain("z-50");
	});

	it("drops a forged scroll-container class smuggled through content", () => {
		const evil = JSON.stringify({
			blocks: [{ type: "table", data: { content: [[`<div class="${TABLE_SCROLL_CLASS}">x</div>`]] } }],
		});
		const out = parseEditorJSToHtml(evil)!.join("");
		// Exactly one wrapper: the one the renderer emitted.
		expect(out.split(TABLE_SCROLL_CLASS).length - 1).toBe(1);
	});

	it("leaves plain text extraction free of the wrapper", () => {
		expect(parseEditorJSToText(NORDRIVE_DESCRIPTION)).not.toContain("div");
	});
});
