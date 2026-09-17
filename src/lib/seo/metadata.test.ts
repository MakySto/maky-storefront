import { describe, expect, it } from "vitest";
import { buildPageMetadata, rootMetadata } from "./metadata";

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
		const metadata = buildPageMetadata({ title, titleSource: "seo" });
		expect(metadata.title).toBe(title);
		expect(metadata.openGraph && "title" in metadata.openGraph ? metadata.openGraph.title : null).toBe(title);
	});

	it("adds the store suffix when an accepted SEO title plus suffix fits 65 characters", () => {
		const title = "x".repeat(50);
		expect(buildPageMetadata({ title, titleSource: "seo" }).title).toBe(`${title} | MAKY.STORE`);
	});

	it("keeps the legacy 60-character word-boundary trim for a name fallback", () => {
		const title = `${"long ".repeat(20)}product`;
		const metadata = buildPageMetadata({ title, titleSource: "fallback" });
		expect(String(metadata.title)).toContain("… | MAKY.STORE");
	});
});
