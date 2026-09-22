import { describe, expect, it } from "vitest";
import { formatPageTitle, formatPageTitleOnce } from "./brand";

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
