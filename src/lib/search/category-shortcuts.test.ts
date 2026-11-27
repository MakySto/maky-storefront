import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { categoriesFor } from "@/config/categories";
import { categorySegment } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import {
	MAX_CATEGORY_SHORTCUTS,
	matchCategoryShortcuts,
	sameWord,
	shortcutWords,
} from "./category-shortcuts";

/**
 * The words below are the ones the live search was asked on 2026-11-27. Abroad every one that
 * names a shelf answered 0 results; in Slovakia they answered more than twenty thousand in no
 * useful order. The shelf they name is what the page now offers.
 *
 * The candidates are built the way the search page builds them: the menu's categories, their
 * labels from the market's own message file and their localized address as a second name.
 */
function candidatesOf(market: string) {
	const locale = CHANNEL_MAP[market]!.locale;
	const nav = (
		JSON.parse(fs.readFileSync(`src/i18n/messages/${locale}.json`, "utf8")) as { nav: Record<string, string> }
	).nav;
	return {
		locale,
		candidates: categoriesFor("home").map((category) => ({
			slug: category.slug,
			label: nav[category.key]!,
			aliases: [categorySegment(market, category.slug)],
		})),
	};
}

function shelvesFor(market: string, query: string): string[] {
	const { locale, candidates } = candidatesOf(market);
	return matchCategoryShortcuts(query, candidates, locale).map((candidate) => candidate.slug);
}

describe("a search that names a shelf is offered that shelf", () => {
	it.each([
		["de", "Dachträger", ["stresne-nosice"]],
		["de", "Dachbox", ["stresne-boxy"]],
		["de", "Fahrradträger", ["nosice-bicyklov"]],
		["de", "Dachträger Golf", ["stresne-nosice"]],
		["de", "Schneeketten 205/55 R16", ["snehove-retaze"]],
		["de", "Kühlbox", ["autochladnicky"]],
		["at", "Dachträger", ["stresne-nosice"]],
		["cz", "střešní nosič", ["stresne-nosice"]],
		["cz", "střešní box", ["stresne-boxy"]],
		["pl", "bagażnik dachowy", ["stresne-nosice"]],
		["hu", "tetőcsomagtartó", ["stresne-nosice"]],
		["it", "barre portatutto", ["stresne-nosice"]],
		["fr", "barres de toit", ["stresne-nosice"]],
		["es", "barras de techo", ["stresne-nosice"]],
		["ro", "bare transversale", ["stresne-nosice"]],
		["us", "roof rack", ["stresne-nosice"]],
		["sk", "strešný box", ["stresne-boxy"]],
		["sk", "nosič bicyklov", ["nosice-bicyklov"]],
		["sk", "stresny nosic octavia", ["stresne-nosice"]],
		["sk", "nosič na lyže", ["nosice-lyzi"]],
		["sk", "chladnička", ["autochladnicky"]],
	])("%s: %s", (market, query, expected) => {
		expect(shelvesFor(market, query)).toEqual(expected);
	});

	it("offers every shelf of a kind when only the kind is named", () => {
		expect(shelvesFor("sk", "nosič")).toEqual(["stresne-nosice", "nosice-bicyklov", "nosice-lyzi"]);
		expect(shelvesFor("de", "Träger")).toEqual(["stresne-nosice", "nosice-bicyklov", "nosice-lyzi"]);
		expect(shelvesFor("sk", "box")).toEqual(["stresne-boxy"]);
		expect(shelvesFor("de", "ski")).toEqual(["nosice-lyzi"]);
	});

	it("puts the shelf that was named in full before the ones the words are only part of", () => {
		const { locale } = candidatesOf("sk");
		const candidates = [
			{ slug: "part", label: "Strešné nosiče a koše" },
			{ slug: "whole", label: "Strešné nosiče" },
		];
		expect(matchCategoryShortcuts("strešné nosiče", candidates, locale).map(({ slug }) => slug)).toEqual([
			"whole",
			"part",
		]);
	});
});

describe("a search that names no shelf is left alone", () => {
	it.each([
		["sk", "thule"],
		["sk", "kuga"],
		["sk", "octavia"],
		["de", "golf"],
		["de", "thule"],
		["us", "thule"],
		["sk", "M0000964"],
		["sk", "205/55 R16"],
		["de", "auto"],
		["ro", "auto"],
		["sk", "na"],
		["sk", "   "],
	])("%s: %s", (market, query) => {
		expect(shelvesFor(market, query)).toEqual([]);
	});

	it("never offers more than fits in one row", () => {
		const candidates = Array.from({ length: 9 }, (_, index) => ({
			slug: `s${index}`,
			label: `Nosiče ${index}x`,
		}));
		expect(matchCategoryShortcuts("nosič", candidates, "sk-SK")).toHaveLength(MAX_CATEGORY_SHORTCUTS);
	});
});

describe("words", () => {
	it("are compared without diacritics, case, numbers and filler", () => {
		expect(shortcutWords("Nosič na LYŽE 205/55 R16", "sk-SK")).toEqual(["nosic", "lyze", "r16"]);
		expect(shortcutWords("Łańcuchy śniegowe", "pl-PL")).toEqual(["lancuchy", "sniegowe"]);
		expect(shortcutWords("Kühlboxen fürs Auto", "de-DE")).toEqual(["kuhlboxen"]);
	});

	it("fold the written-out umlauts in German only", () => {
		expect(shortcutWords("kuehlboxen-fuers-auto", "de-AT")).toEqual(["kuhlboxen"]);
		expect(shortcutWords("blue", "en-US")).toEqual(["blue"]);
	});

	it("meet across endings and inside compounds, and not across different words", () => {
		expect(sameWord("dachbox", "dachboxen")).toBe(true);
		expect(sameWord("dachowy", "dachowe")).toBe(true);
		expect(sameWord("fahrrad", "fahrradtrager")).toBe(true);
		expect(sameWord("kuhlbox", "autokuhlboxen")).toBe(true);
		expect(sameWord("golf", "dachtrager")).toBe(false);
		expect(sameWord("thule", "tetto")).toBe(false);
		expect(sameWord("stan", "stresne")).toBe(false);
	});
});
