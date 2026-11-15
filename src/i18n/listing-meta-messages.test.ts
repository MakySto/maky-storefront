import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

/**
 * The sentences a category and a brand page fall back to in a search result, in every market's
 * language, formatted the way the page formats them. next-intl is not type-checked against the
 * message files, so a plural branch a language needs and does not have fails only here.
 */
const LOCALES = [
	"cs-CZ",
	"de-AT",
	"de-DE",
	"en-CA",
	"en-US",
	"es-ES",
	"fr-FR",
	"hu-HU",
	"it-IT",
	"pl-PL",
	"ro-RO",
	"sk-SK",
] as const;

const messagesOf = (locale: string) =>
	JSON.parse(readFileSync(path.join(__dirname, "messages", `${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

/** The longest category name the Slovak catalogue has today is 34 characters. */
const LONG_NAME = "Náhradné diely k nosičom bicyklov";

describe.each(LOCALES)("listing sentences in %s", (locale) => {
	const t = createTranslator({ locale, messages: messagesOf(locale) as never });
	const sentence = (count: number, category = "Snehové reťaze") =>
		(t as unknown as (key: string, values: Record<string, unknown>) => string)(
			"plp.categoryMetaDescription",
			{
				category,
				count,
			},
		);

	it("says the category, how many products it holds and the 14 days of the returns page", () => {
		for (const count of [1, 2, 4, 5, 22, 145, 26837]) {
			const text = sentence(count);
			expect(text.startsWith("Snehové reťaze "), text).toBe(true);
			expect(text, text).toContain("MAKY.STORE");
			expect(text.replace(/[\s.,  ’']/g, ""), text).toContain(String(count));
			expect(text, text).toContain("14");
			expect(text, text).not.toMatch(/[{}#]/);
		}
	});

	it("never promises free delivery or thirty days", () => {
		const text = sentence(145).toLowerCase();
		expect(text).not.toMatch(/zadarmo|zdarma|gratis|kostenlos|free|gratuit|ingyen|darmow|gratuito/);
		expect(text).not.toContain("30");
	});

	it("fits a search result, also for the longest category name and the fullest category", () => {
		expect(sentence(26837, LONG_NAME).length).toBeLessThanOrEqual(160);
	});

	it("names the maker and its categories on a brand page", () => {
		const text = (t as unknown as (key: string, values: Record<string, unknown>) => string)(
			"brands.brandDescriptionCategories",
			{ brand: "Thule", categories: "Strešné nosiče (9 666), Strešné boxy (41)" },
		);
		expect(text).toContain("Thule");
		expect(text).toContain("Strešné nosiče (9 666), Strešné boxy (41)");
		expect(text).not.toMatch(/[{}]/);
	});
});
