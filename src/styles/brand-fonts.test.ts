import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const brandCss = readFileSync(join(__dirname, "brand.css"), "utf8");
const shell = readFileSync(join(__dirname, "../ui/components/document-shell.tsx"), "utf8");

/**
 * `--font-sans` named "Geist" while next/font's @font-face family is "GeistSans". Nothing
 * failed: the woff2 was preloaded on every page, `document.fonts` reported it "unloaded",
 * and every visitor read the site in their own system font. The only reliable link between
 * the token and the loaded face is the CSS variable next/font sets on <html>.
 */
describe("brand font token", () => {
	const sans = brandCss.match(/--font-sans:\s*([^;]+);/)?.[1] ?? "";

	it("reads the variable next/font sets, not a guessed family name", () => {
		expect(sans).toMatch(/^var\(--font-geist-sans\b/);
	});

	it("is fed by the <html> class that defines that variable", () => {
		expect(shell).toContain("GeistSans.variable");
	});

	it("still ends in a generic family, so a page without the class stays sans-serif", () => {
		expect(sans.trim()).toMatch(/sans-serif$/);
	});
});
