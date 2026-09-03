import { describe, expect, it } from "vitest";
import { parseEditorJSToHtml, parseEditorJSToText } from "./editorjs";

const document = (blocks: unknown[]) => JSON.stringify({ time: 1, version: "2.30", blocks });

describe("safe Editor.js rendering", () => {
	it("renders supported text and table blocks", () => {
		const result = parseEditorJSToHtml(
			document([
				{ type: "paragraph", data: { text: "Kompletný <strong>set</strong>" } },
				{ type: "table", data: { withHeadings: true, content: [["Parameter", "Hodnota"], ["Nosnosť", "75 kg"]] } },
			]),
		);
		expect(result?.join(" ")).toContain("<strong>set</strong>");
		expect(result?.join(" ")).toContain("<thead>");
		expect(result?.join(" ")).toContain("75 kg");
	});

	it("renders images with stable dimensions and lazy loading", () => {
		const result = parseEditorJSToHtml(
			document([{ type: "image", data: { file: { url: "https://img.example/rack.webp" }, caption: "Nosič" } }]),
		)?.join("");
		expect(result).toContain('width="1024"');
		expect(result).toContain('height="768"');
		expect(result).toContain('loading="lazy"');
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
