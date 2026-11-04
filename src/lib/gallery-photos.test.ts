import { describe, expect, it } from "vitest";
import { parseEditorJSToHtml } from "./editorjs";
import { galleryPhotoMap, withGalleryPhotos } from "./gallery-photos";

const CFM = "https://carfitmanager.com/media/filer_public/ab/cd/kit.jpg";
const ORIGINAL = "https://cdn.maky.store/media/products/kit_1a2b3c.jpg";
const COPY = "https://cdn.maky.store/thumbnails/products/kit_1a2b3c_thumbnail_1080.webp";

type Block = { data: { file?: { url: string }; caption?: string } };

const document = (...urls: string[]) =>
	JSON.stringify({
		blocks: [
			{ type: "paragraph", data: { text: "Text" } },
			...urls.map((url) => ({ type: "image", data: { file: { url }, caption: "Súprava" } })),
		],
	});

const item = (photo: string, source?: string, type = "IMAGE") => ({
	url: ORIGINAL,
	photo,
	type,
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

	it("leaves what is not an Editor.js document as it came", () => {
		for (const text of ["", null, undefined, "Obyčajný text", "[1,2]", '{"blocks":"x"}']) {
			expect(withGalleryPhotos(text, [item(COPY, CFM)])).toBe(text);
		}
	});
});
