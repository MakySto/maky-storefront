import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { type GenerationCandidate } from "@/lib/fitment/selector-plan";
import { candidateLabel } from "./candidate-label";

/**
 * How two generations of one year are told apart (owner, 2026-11-27): an overlap is ordinary, the
 * older generation is still sold when the newer one arrives, and the shopper picks the older or the
 * newer one. Never by an internal code alone.
 */

const messages = (locale: string) =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as {
		fitment: { selector: Record<string, string> };
	};
const translator = (locale = "sk-SK") =>
	createTranslator({
		locale,
		messages: messages(locale) as never,
		namespace: "fitment" as never,
	}) as unknown as (key: string) => string;

const generation = (over: Partial<GenerationCandidate>): GenerationCandidate => ({
	id: "g",
	name: "X",
	productionYearFrom: 2000,
	productionYearTo: null,
	bodyTypes: null,
	doors: null,
	roofTypes: null,
	...over,
});

const OLD = generation({
	id: "a",
	name: "8PA",
	productionYearFrom: 2004,
	productionYearTo: 2013,
	bodyTypes: ["hatchback"],
});
const NEW = generation({
	id: "b",
	name: "8VA",
	productionYearFrom: 2012,
	productionYearTo: 2020,
	bodyTypes: ["hatchback"],
});

describe("two generations in one year", () => {
	const t = translator();

	it("calls them the older and the newer generation, with the years each was built", () => {
		expect(candidateLabel(OLD, t, [OLD, NEW])).toBe("Staršia generácia · 2004–2013 · 8PA");
		expect(candidateLabel(NEW, t, [OLD, NEW])).toBe("Novšia generácia · 2012–2020 · 8VA");
		// The order they arrive in does not decide which is which.
		expect(candidateLabel(OLD, t, [NEW, OLD])).toBe("Staršia generácia · 2004–2013 · 8PA");
	});

	it("says the body as well where it tells the two apart", () => {
		const estate = { ...NEW, bodyTypes: ["estate"] as GenerationCandidate["bodyTypes"] };
		expect(candidateLabel(OLD, t, [OLD, estate])).toBe("Staršia generácia · Hatchback · 2004–2013 · 8PA");
		expect(candidateLabel(estate, t, [OLD, estate])).toBe("Novšia generácia · Kombi · 2012–2020 · 8VA");
	});

	it("writes a generation still in production with an open end", () => {
		const open = { ...NEW, productionYearTo: null };
		expect(candidateLabel(open, t, [OLD, open])).toBe("Novšia generácia · 2012– · 8VA");
	});

	it("makes nothing up for two that start in the same year: they read as before", () => {
		const nw = generation({ id: "a", name: "NW", productionYearFrom: 2019, bodyTypes: ["suv"] });
		const nw4 = generation({ id: "b", name: "NW4", productionYearFrom: 2019, bodyTypes: ["suv"] });
		expect(candidateLabel(nw, t, [nw, nw4])).toBe("SUV · 2019– · NW");
		expect(candidateLabel(nw4, t, [nw, nw4])).toBe("SUV · 2019– · NW4");
	});

	it("does not rank three candidates, and reads alone as before", () => {
		const third = generation({ id: "c", name: "8Y", productionYearFrom: 2020, bodyTypes: ["hatchback"] });
		expect(candidateLabel(OLD, t, [OLD, NEW, third])).toBe("Hatchback · 2004–2013 · 8PA");
		expect(candidateLabel(OLD, t)).toBe("Hatchback · 2004–2013 · 8PA");
	});

	it.each([
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
	])("%s has both words", (locale) => {
		const selector = messages(locale).fitment.selector;
		expect(selector.generationOlder).toEqual(expect.any(String));
		expect(selector.generationNewer).toEqual(expect.any(String));
		expect(selector.generationOlder).not.toBe(selector.generationNewer);
		expect(candidateLabel(OLD, translator(locale), [OLD, NEW])).toContain(selector.generationOlder);
	});
});
