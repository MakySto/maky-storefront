import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchView } from "./search-view";

describe("searchView", () => {
	it("tells an outage apart from an empty answer", () => {
		expect(searchView({ unavailable: true, pagination: { totalCount: 0 } })).toBe("unavailable");
		expect(searchView({ pagination: { totalCount: 0 } })).toBe("empty");
		expect(searchView({ pagination: { totalCount: 3 } })).toBe("results");
	});

	it.each([
		"sk-SK",
		"cs-CZ",
		"de-DE",
		"de-AT",
		"en-US",
		"en-CA",
		"es-ES",
		"fr-FR",
		"hu-HU",
		"it-IT",
		"pl-PL",
		"ro-RO",
	])("has the outage texts in %s", (locale) => {
		const messages = JSON.parse(
			readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8"),
		) as { search: Record<string, string>; common: Record<string, string> };
		expect(messages.search.unavailableTitle).toBeTruthy();
		expect(messages.search.unavailableHelp).toContain("{query}");
		expect(messages.common.retry).toBeTruthy();
		expect(messages.search.correctedFrom).toContain("{query}");
	});
});
