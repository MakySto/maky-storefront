import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

/**
 * The words of the key-facts band, as a phone sets them.
 *
 * On a phone the band is two columns and the text beside the icon has 72 to 127 px of room (92 px on a
 * 360 px screen, 107 px on a 390 px one). A word wider than that is broken in the middle, with no
 * hyphen: "Leistungsaufn / ahme 80 W" in Germany and Austria and "Teljesítményf / elvétel 80 W" in
 * Hungary (looked at in Chromium on the five PRO-USER fridge pages, 2026-10-08). The phrases of the
 * other markets are short words that fit: the widest ten-letter word measured 85 px in the band's
 * bold 15 px type, and an eleven-letter one 95.
 *
 * A phrase with a long word marks where it may split by a soft hyphen (U+00AD, written `\u00AD` in the
 * message files), so the break reads "Leistungs- / aufnahme". It is invisible where the word fits and
 * needs no hyphenation dictionary in the browser, which `hyphens: auto` does.
 */

const MESSAGES = path.join(process.cwd(), "src/i18n/messages");
const LOCALES = readdirSync(MESSAGES)
	.filter((file) => file.endsWith(".json"))
	.map((file) => file.slice(0, -".json".length))
	.sort();

// Loosely typed on purpose: the files are the fixture, and next-intl is not type-augmented.
const load = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8")) as Record<string, any>;

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** A line may break at a space, a hyphen, a slash or a soft hyphen — not at a no-break space. */
const BREAKS = /[ \-\u2010\u00AD/]+/;

/** The longest run of letters the band's bold 15 px type fits into a 360 px phone. */
const LONGEST_RUN = 10;

const runsOf = (phrase: string): string[] => phrase.split(BREAKS);

describe("the words of the key-facts band", () => {
	it("reads every market's message file", () => {
		expect(LOCALES).toHaveLength(12);
	});

	it("breaks a phrase where a line may break, and nowhere else", () => {
		expect(runsOf("Leistungs\u00ADaufnahme 80\u00A0W")).toEqual(["Leistungs", "aufnahme", "80\u00A0W"]);
		expect(runsOf("Bluetooth-Steuerung")).toEqual(["Bluetooth", "Steuerung"]);
		expect(runsOf("Leistungsaufnahme 80\u00A0W").some((run) => run.length > LONGEST_RUN)).toBe(true);
	});

	it.each(LOCALES)("%s: no phrase has a word a phone cannot fit or break", (locale) => {
		const messages = load(locale);
		const t = createTranslator({
			locale,
			messages: messages as never,
			namespace: "product" as never,
		}) as unknown as Translate;
		const keys = Object.keys(messages.product).filter((key) => key.startsWith("highlight"));
		expect(keys.length).toBeGreaterThanOrEqual(6);

		const tooLong = new Set<string>();
		for (const key of keys) {
			// 1, 2, 5 and 22 reach the one, few, many and other forms of every market's plural rules.
			for (const count of [1, 2, 5, 22]) {
				for (const run of runsOf(t(key, { value: "80\u00A0W", count }))) {
					if (run.length > LONGEST_RUN) tooLong.add(`${key}: ${run}`);
				}
			}
		}
		expect([...tooLong]).toEqual([]);
	});

	it("keeps the wording: a soft hyphen only marks where a word may split", () => {
		const plain = (locale: string, key: string): string =>
			String(load(locale).product[key]).replaceAll("\u00AD", "");
		expect(plain("de-DE", "highlightPower")).toBe("Leistungsaufnahme {value}");
		expect(plain("de-AT", "highlightPower")).toBe("Leistungsaufnahme {value}");
		expect(plain("hu-HU", "highlightPower")).toBe("Teljesítményfelvétel {value}");
		expect(plain("hu-HU", "highlightLoadPerBike")).toBe("Kerékpáronként legfeljebb {value}");
		expect(plain("hu-HU", "highlightBikes")).toBe(
			"{count, plural, one {# kerékpárhoz} other {# kerékpárhoz}}",
		);
	});
});
