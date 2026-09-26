import { describe, expect, it } from "vitest";
import { formatPageTitle, formatPageTitleOnce, meaningfulTitle } from "./brand";

describe("formatPageTitleOnce", () => {
	it("suffixes a title that does not name the shop", () => {
		expect(formatPageTitleOnce("Autochladničky")).toBe("Autochladničky | MAKY.STORE");
		expect(formatPageTitleOnce("Autochladničky")).toBe(formatPageTitle("Autochladničky"));
	});

	it("leaves a title that already names the shop alone, wherever the name is", () => {
		expect(formatPageTitleOnce("Strešné boxy | MAKY.STORE")).toBe("Strešné boxy | MAKY.STORE");
		expect(formatPageTitleOnce("MAKY.STORE – strešné boxy")).toBe("MAKY.STORE – strešné boxy");
		expect(formatPageTitleOnce("Strešné boxy | maky.store")).toBe("Strešné boxy | maky.store");
	});

	it("trims what the data brought with it", () => {
		expect(formatPageTitleOnce("  Autochladničky ")).toBe("Autochladničky | MAKY.STORE");
	});
});

describe("meaningfulTitle", () => {
	// CFM's category translations carried seoTitle "MAKY.STORE" in all eleven foreign languages
	// (2026-09-26), and every foreign roof-rack category was titled just that.
	it("treats a title that is only the shop's name as no title", () => {
		expect(meaningfulTitle("MAKY.STORE")).toBeNull();
		expect(meaningfulTitle("  maky.store ")).toBeNull();
		expect(meaningfulTitle("| MAKY.STORE")).toBeNull();
		expect(meaningfulTitle("MAKY.STORE — ")).toBeNull();
		expect(meaningfulTitle("")).toBeNull();
		expect(meaningfulTitle(null)).toBeNull();
		expect(meaningfulTitle(undefined)).toBeNull();
	});

	it("keeps any title that says something, trimmed", () => {
		expect(meaningfulTitle(" Dachträger ")).toBe("Dachträger");
		expect(meaningfulTitle("Strešné boxy | MAKY.STORE")).toBe("Strešné boxy | MAKY.STORE");
	});
});
