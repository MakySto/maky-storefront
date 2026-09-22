import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { DEFAULT_OG_IMAGE, buildPageMetadata, marketOpenGraph, rootMetadata } from "./metadata";

describe("root favicon metadata", () => {
	it("offers Google an explicitly sized square icon of at least 48 pixels", () => {
		const iconEntries = (rootMetadata.icons as { icon: Array<{ sizes?: string }> }).icon;
		const hasEligibleIcon = iconEntries.some(({ sizes }) => {
			const dimensions = sizes?.match(/^(\d+)x(\d+)$/);
			if (!dimensions) return false;

			const width = Number(dimensions[1]);
			const height = Number(dimensions[2]);
			return width === height && width >= 48;
		});

		expect(iconEntries[0]).toMatchObject({
			url: "/android-chrome-192x192.png",
			sizes: "192x192",
			type: "image/png",
		});
		expect(hasEligibleIcon).toBe(true);
	});
});

describe("accepted product SEO title policy", () => {
	it("keeps a 70-character SEO title byte-for-byte and omits the suffix", () => {
		const title = "x".repeat(70);
		const metadata = buildPageMetadata({ channel: "sk-eur", title, titleSource: "seo" });
		expect(metadata.title).toBe(title);
		expect(metadata.openGraph && "title" in metadata.openGraph ? metadata.openGraph.title : null).toBe(title);
	});

	it("adds the store suffix when an accepted SEO title plus suffix fits 65 characters", () => {
		const title = "x".repeat(50);
		expect(buildPageMetadata({ channel: "sk-eur", title, titleSource: "seo" }).title).toBe(
			`${title} | MAKY.STORE`,
		);
	});

	it("keeps the legacy 60-character word-boundary trim for a name fallback", () => {
		const title = `${"long ".repeat(20)}product`;
		const metadata = buildPageMetadata({ channel: "sk-eur", title, titleSource: "fallback" });
		expect(String(metadata.title)).toContain("… | MAKY.STORE");
	});
});

type OpenGraphOf = { images?: unknown; siteName?: string; locale?: string; url?: string; type?: string };
const og = (metadata: ReturnType<typeof buildPageMetadata>) => metadata.openGraph as OpenGraphOf;

describe("Open Graph", () => {
	it("the generic share card really is 1200×630 — the only image the site may say that of", () => {
		const png = readFileSync(path.join(process.cwd(), "src/app", DEFAULT_OG_IMAGE.url));
		expect(png.readUInt32BE(16)).toBe(DEFAULT_OG_IMAGE.width);
		expect(png.readUInt32BE(20)).toBe(DEFAULT_OG_IMAGE.height);
		expect([DEFAULT_OG_IMAGE.width, DEFAULT_OG_IMAGE.height]).toEqual([1200, 630]);
	});

	it("a page's own image is published without claimed dimensions", () => {
		const image = "https://cdn.maky.store/products/nosic.jpg";
		const metadata = buildPageMetadata({ channel: "sk-eur", title: "Nosič", image, url: "/sk/nosic" });
		expect(og(metadata).images).toEqual([{ url: image, alt: "Nosič" }]);
	});

	it("a page with no image of its own falls back to the generic card, never to none", () => {
		for (const image of [undefined, null, ""]) {
			const metadata = buildPageMetadata({ channel: "sk-eur", title: "O nás", image });
			expect(og(metadata).images).toEqual([DEFAULT_OG_IMAGE]);
		}
	});

	it("names the site and the market's locale on every page it builds", () => {
		for (const [market, { saleorSlug, locale }] of Object.entries(CHANNEL_MAP)) {
			const metadata = buildPageMetadata({ channel: saleorSlug, title: "X", url: `/${market}/x` });
			expect(og(metadata), market).toMatchObject({
				type: "website",
				siteName: "MAKY.STORE",
				locale: locale.replace("-", "_"),
				url: `/${market}/x`,
			});
		}
	});

	it("marketOpenGraph carries every shared field, and the url only when given", () => {
		expect(marketOpenGraph("de-eur")).toEqual({
			type: "website",
			siteName: "MAKY.STORE",
			locale: "de_DE",
			images: [DEFAULT_OG_IMAGE],
		});
		expect(marketOpenGraph("ca-cad", "https://maky.store/ca")).toMatchObject({
			locale: "en_CA",
			url: "https://maky.store/ca",
		});
	});

	it("the root layout uses the same card", () => {
		expect((rootMetadata.openGraph as OpenGraphOf).images).toEqual([DEFAULT_OG_IMAGE]);
	});
});
