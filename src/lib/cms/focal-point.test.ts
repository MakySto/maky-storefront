import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { CmsImage } from "@/ui/components/cms/cms-media";
import { cmsMediaObjectPosition, readMedia, type CmsMedia } from "./blocks";

const { brandsFromDocs } = await import("./brands");

/**
 * Pages contract v3 §2 (`__fixtures__/provider-v3/pages-content.md`): `public-media` carries
 * `focalX`/`focalY` (0–100, percent, default 50/50), and a picture cropped with
 * `object-fit: cover` is positioned at `<focalX>% <focalY>%`. A missing or invalid value is
 * the centre — never a reason to drop the picture.
 */

const upload = (focal: Record<string, unknown> = {}) => ({
	id: "018f1000-0000-7000-8000-000000000103",
	alt: "Detail strešného nosiča",
	url: "https://cms-media.maky.store/media/provider-v3/rack.webp",
	mimeType: "image/webp",
	width: 2400,
	height: 1600,
	...focal,
});

function parsed(value: unknown): CmsMedia {
	const result = readMedia(value);
	if (result.kind !== "ok") throw new Error(`expected usable media, got ${result.kind}`);
	return result.media;
}

describe("focal point — parsing", () => {
	it("reads the editor's focal point", () => {
		expect(parsed(upload({ focalX: 30, focalY: 65 }))).toMatchObject({ focalX: 30, focalY: 65 });
	});

	it("reads the provider fixture's focal point as delivered", () => {
		const pack = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__/provider-v2");
		const response = JSON.parse(
			readFileSync(join(pack, "fixtures/rest/page-image.sk.published.depth-1.json"), "utf8"),
		) as { docs: [{ layout: [{ media: unknown }] }] };
		expect(parsed(response.docs[0].layout[0].media)).toMatchObject({ focalX: 48, focalY: 52 });
	});

	it("is the centre when missing", () => {
		expect(parsed(upload())).toMatchObject({ focalX: 50, focalY: 50 });
		expect(parsed(upload({ focalX: null, focalY: undefined }))).toMatchObject({ focalX: 50, focalY: 50 });
	});

	it.each([
		["a string", "30"],
		["negative", -1],
		["above 100", 100.5],
		["NaN", Number.NaN],
		["infinite", Number.POSITIVE_INFINITY],
		["an object", { x: 30 }],
	])("is the centre when %s, and the picture is kept", (_label, value) => {
		const media = parsed(upload({ focalX: value, focalY: value }));
		expect(media).toMatchObject({ focalX: 50, focalY: 50 });
	});

	it("decides each axis on its own", () => {
		expect(parsed(upload({ focalX: 10, focalY: "top" }))).toMatchObject({ focalX: 10, focalY: 50 });
	});

	it("accepts both edges and a fraction", () => {
		expect(parsed(upload({ focalX: 0, focalY: 100 }))).toMatchObject({ focalX: 0, focalY: 100 });
		expect(parsed(upload({ focalX: 33.333333, focalY: 66.666666 }))).toMatchObject({
			focalX: 33.33,
			focalY: 66.67,
		});
	});
});

describe("focal point — rendering", () => {
	it("is the object-position, `<focalX>% <focalY>%`", () => {
		expect(cmsMediaObjectPosition({ focalX: 30, focalY: 65 })).toBe("30% 65%");
		expect(cmsMediaObjectPosition({ focalX: 50, focalY: 50 })).toBe("50% 50%");
	});

	it("positions a CmsImage crop at the focal point, with object-cover", () => {
		const html = renderToStaticMarkup(
			createElement(CmsImage, { media: parsed(upload({ focalX: 30, focalY: 65 })) }),
		);
		expect(html).toMatch(/class="[^"]*object-cover[^"]*"/);
		expect(html).toContain("object-position:30% 65%");
	});

	it("keeps the centre for a picture with no focal point, as before", () => {
		const html = renderToStaticMarkup(createElement(CmsImage, { media: parsed(upload()) }));
		expect(html).toContain("object-position:50% 50%");
	});

	it("carries a brand's banner focal point through the Payload brand entry", () => {
		const [thule] = brandsFromDocs(
			[{ slug: "thule", name: "Thule", heroImage: upload({ focalX: 20, focalY: 80 }), markets: null }],
			"SK",
		);
		expect(thule?.heroImage && cmsMediaObjectPosition(thule.heroImage)).toBe("20% 80%");
	});
});
