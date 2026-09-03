import { describe, expect, it } from "vitest";
import { buildPageMetadata } from "./metadata";

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
