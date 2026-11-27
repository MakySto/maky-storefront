import { describe, expect, it } from "vitest";

import { documentLangFor } from "./document-lang";
import { LOCALE_MAP } from "@/config/locale";

describe("documentLangFor", () => {
	it("gives every configured locale the tag its market layout writes", () => {
		for (const [key, config] of Object.entries(LOCALE_MAP)) {
			expect(documentLangFor(key)).toBe(config.locale);
		}
	});

	it("names German for a German checkout, not the store default", () => {
		const german = Object.keys(LOCALE_MAP).find((key) => LOCALE_MAP[key].locale === "de-DE");
		expect(german).toBeDefined();
		expect(documentLangFor(german!)).toBe("de-DE");
		expect(documentLangFor(german!)).not.toBe("sk-SK");
	});

	it("passes an unknown locale through instead of inventing one", () => {
		expect(documentLangFor("nl-NL")).toBe("nl-NL");
	});
});
