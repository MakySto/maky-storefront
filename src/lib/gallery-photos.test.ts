import { describe, expect, it } from "vitest";
import { parseEditorJSToHtml } from "./editorjs";
import { galleryPhotoMap, withGalleryPhotos } from "./gallery-photos";

const CFM = "https://carfitmanager.com/media/filer_public/ab/cd/kit.jpg";
const ORIGINAL = "https://cdn.maky.store/media/products/kit_1a2b3c.jpg";
const COPY = "https://cdn.maky.store/thumbnails/products/kit_1a2b3c_thumbnail_1080.webp";

type Block = { data: { file?: { url: string }; caption?: string; alt?: string } };

const document = (...urls: string[]) =>
	JSON.stringify({
		blocks: [
			{ type: "paragraph", data: { text: "Text" } },
			...urls.map((url) => ({ type: "image", data: { file: { url }, caption: "Súprava" } })),
		],
	});

const item = (photo: string, source?: string, type = "IMAGE", alt?: string | null) => ({
	url: ORIGINAL,
	photo,
	type,
	alt,
	metadata: source ? [{ key: "cfm_source_url", value: source }] : [],
});

describe("the description's photographs and the gallery", () => {
	it("points a photograph at the gallery's copy of the same file", () => {
		const result = withGalleryPhotos(document(CFM), [item(COPY, CFM)]);
		const blocks = (JSON.parse(result as string) as { blocks: Block[] }).blocks;
		expect(blocks[1].data.file?.url).toBe(COPY);
		expect(blocks[1].data.caption).toBe("Súprava");
	});

	it("shows the copy as it is, from Saleor's CDN, and no longer asks CFM", () => {
		const html = parseEditorJSToHtml(withGalleryPhotos(document(CFM), [item(COPY, CFM)]) as string)?.join("");
		expect(html).toContain(`<img src="${COPY}"`);
		expect(html).not.toContain("carfitmanager.com");
	});

	it("keeps the CFM address where the gallery holds no marked copy", () => {
		const text = document(CFM);
		expect(withGalleryPhotos(text, [item(COPY)])).toBe(text);
		expect(withGalleryPhotos(text, [item(COPY, "https://carfitmanager.com/media/other.jpg")])).toBe(text);
		expect(withGalleryPhotos(text, [])).toBe(text);
		expect(withGalleryPhotos(text, null)).toBe(text);
	});

	it("rewrites only the photographs it can match", () => {
		const other = "https://carfitmanager.com/media/filer_public/ef/01/bars.jpg";
		const blocks = (
			JSON.parse(withGalleryPhotos(document(CFM, other), [item(COPY, CFM)]) as string) as { blocks: Block[] }
		).blocks;
		expect(blocks.map((b) => b.data.file?.url)).toEqual([undefined, COPY, other]);
	});

	it("takes a copy only from an image on a Saleor media host", () => {
		expect(galleryPhotoMap([item("https://evil.example/kit.jpg", CFM)]).size).toBe(0);
		expect(galleryPhotoMap([item("http://cdn.maky.store/kit.jpg", CFM)]).size).toBe(0);
		expect(galleryPhotoMap([item(COPY, CFM, "VIDEO")]).size).toBe(0);
		expect(galleryPhotoMap([{ ...item(COPY, CFM), photo: null }]).size).toBe(0);
		expect(
			galleryPhotoMap([item("https://api.maky.store/thumbnail/UHJvZHVjdE1lZGlh/1080/webp/", CFM)]).get(CFM),
		).toBe("https://api.maky.store/thumbnail/UHJvZHVjdE1lZGlh/1080/webp/");
	});

	it("takes the first of two items that claim one source", () => {
		const second = "https://cdn.maky.store/thumbnails/products/kit_other_thumbnail_1080.webp";
		expect(galleryPhotoMap([item(COPY, CFM), item(second, CFM)]).get(CFM)).toBe(COPY);
	});

	describe("the photograph's alt", () => {
		const blocksOf = (result: string) => (JSON.parse(result) as { blocks: Block[] }).blocks;

		it("is the alt CFM wrote on the gallery item, set on the description's photograph; the caption stays", () => {
			const alt = "Nosič Pro-USER Diamant FG3 sklopený aj s bicyklami na ťažnom zariadení";
			const block = blocksOf(withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", alt)]) as string)[1];
			expect(block.data.alt).toBe(alt);
			expect(block.data.caption).toBe("Súprava");
			expect(block.data.file?.url).toBe(COPY);
		});

		it("is drawn as the picture's alt and the caption is drawn as the caption, each its own text", () => {
			const html = parseEditorJSToHtml(
				withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", "Rameno nosiča")]) as string,
			)?.join("");
			expect(html).toContain('alt="Rameno nosiča"');
			expect(html).toContain("<figcaption>Súprava</figcaption>");
		});

		it("sets none where the gallery item has none: the caption then stands in, as it always did", () => {
			for (const alt of [undefined, null, "", "   "]) {
				const result = withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", alt)]) as string;
				expect(blocksOf(result)[1].data.alt).toBeUndefined();
				expect(parseEditorJSToHtml(result)?.join("")).toContain('alt="Súprava"');
			}
		});

		it("sets none on a photograph the gallery does not hold, whatever another item says", () => {
			const other = "https://carfitmanager.com/media/filer_public/ef/01/bars.jpg";
			const blocks = blocksOf(
				withGalleryPhotos(document(CFM, other), [item(COPY, CFM, "IMAGE", "Súprava")]) as string,
			);
			expect(blocks[1].data.alt).toBe("Súprava");
			expect(blocks[2].data.alt).toBeUndefined();
		});

		it("takes the alt of the same item the copy comes from: the first of two that claim one source", () => {
			const second = "https://cdn.maky.store/thumbnails/products/kit_other_thumbnail_1080.webp";
			const result = withGalleryPhotos(document(CFM), [
				item(COPY, CFM, "IMAGE", "první"),
				item(second, CFM, "IMAGE", "druhý"),
			]) as string;
			expect(blocksOf(result)[1].data.alt).toBe("první");
		});

		it("is plain text: spaces are tidied, a long one is cut, quotes and angle brackets never become markup", () => {
			const tidy = blocksOf(
				withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", "  Nosič \n\t FG3  ")]) as string,
			);
			expect(tidy[1].data.alt).toBe("Nosič FG3");
			const long = blocksOf(
				withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", "a".repeat(500))]) as string,
			);
			expect(long[1].data.alt).toHaveLength(300);
			const nasty = '"><script>alert(1)</script> Nosič "FG3" & <b>';
			const html =
				parseEditorJSToHtml(
					withGalleryPhotos(document(CFM), [item(COPY, CFM, "IMAGE", nasty)]) as string,
				)?.join("") ?? "";
			expect(html).not.toContain("<script");
			expect(html).not.toContain("<b>");
			expect(html).toContain(
				'alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; Nosič &quot;FG3&quot; &amp; &lt;b&gt;"',
			);
			expect(html.match(/<img /g)).toHaveLength(1);
		});

		it("is not an alt for a photograph that did not match, and leaves a document with no match untouched", () => {
			const text = document(CFM);
			expect(
				withGalleryPhotos(text, [item(COPY, "https://carfitmanager.com/media/other.jpg", "IMAGE", "Cudzia")]),
			).toBe(text);
		});
	});

	it("leaves what is not an Editor.js document as it came", () => {
		for (const text of ["", null, undefined, "Obyčajný text", "[1,2]", '{"blocks":"x"}']) {
			expect(withGalleryPhotos(text, [item(COPY, CFM)])).toBe(text);
		}
	});
});
