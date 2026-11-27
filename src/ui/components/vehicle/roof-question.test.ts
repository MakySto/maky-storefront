import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ channel: "sk-eur" }) }));

import { type RoofType } from "@/lib/fitment/contract";
import { type RoofAnswer } from "@/lib/fitment/selector-types";
import { RoofQuestion } from "./roof-question";

/**
 * The selector's roof question, as the shopper reads it (owner, 2026-11-27).
 *
 * Three things were wrong with it and are pinned here: the roofs had no pictures, "Iný typ" was an answer that could
 * only end on "nothing found", and a shopper who could not tell their roof got one sentence and no way further.
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

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const messages = (locale: string) =>
	JSON.parse(read(`src/i18n/messages/${locale}.json`)) as { fitment: Record<string, unknown> };

const ALL_ROOFS: RoofType[] = [
	"raised-rails",
	"flush-rails",
	"naked-roof",
	"fixpoint",
	"t-track",
	"rain-gutter",
];

function render(
	props: { roofTypes?: RoofType[]; answer?: RoofAnswer; guidePath?: string | null } = {},
	locale = "sk-SK",
) {
	const t = createTranslator({ locale, messages: messages(locale) as never, namespace: "fitment" as never });
	return renderToStaticMarkup(
		createElement(RoofQuestion, {
			roofTypes: props.roofTypes ?? ["flush-rails", "naked-roof"],
			answer: props.answer,
			onAnswer: () => undefined,
			guidePath: props.guidePath ?? null,
			onLeave: () => undefined,
			t: t as unknown as (key: string) => string,
		}),
	);
}

/** The roof buttons: the ones that carry a drawing. */
const cards = (html: string) =>
	html.match(/<button[^>]*aria-pressed="(?:true|false)"[^>]*><svg.*?<\/button>/g) ?? [];

describe("every roof on offer is a picture, its name and how to tell it", () => {
	it("draws each offered roof, names it in the shop's words and says what to look for", () => {
		const html = render({ roofTypes: ["raised-rails", "flush-rails", "naked-roof"] });
		const found = cards(html);
		expect(found).toHaveLength(3);
		expect(found[0]).toContain("Klasické lyžiny");
		expect(found[0]).toContain("Medzi lyžinou a strechou je medzera");
		expect(found[1]).toContain("Integrované lyžiny");
		expect(found[2]).toContain("Hladká strecha");
		expect(found[2]).toContain("pod lem dverí");
	});

	it("offers nothing but the roofs it was given: no 'another type'", () => {
		const html = render();
		expect(cards(html)).toHaveLength(2);
		expect(html).not.toContain("Iný typ");
		expect(html).not.toContain("Klasické lyžiny");
	});

	it("draws all six roof types differently", () => {
		const drawings = ALL_ROOFS.map(
			(roof) => cards(render({ roofTypes: [roof] }))[0]!.match(/<svg.*?<\/svg>/)![0],
		);
		expect(new Set(drawings).size).toBe(6);
	});

	it("asks for confirmation even when one roof is on offer, and preselects nothing", () => {
		const html = render({ roofTypes: ["flush-rails"] });
		expect(html).toContain("Overte typ strechy");
		expect(cards(html)).toHaveLength(1);
		expect(html).not.toContain('aria-pressed="true"');
	});

	it("marks the chosen roof and no other", () => {
		const html = render({ answer: { kind: "confirmed", roofType: "naked-roof" } });
		const found = cards(html);
		expect(found[0]).toContain('aria-pressed="false"');
		expect(found[1]).toContain('aria-pressed="true"');
	});
});

describe("a shopper who cannot tell their roof", () => {
	it("has the help one press away: closed at first, and it says what it opens", () => {
		const html = render();
		expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Neviem, aký typ strechy mám/);
		expect(html).toMatch(/<div id="[^"]+" hidden=""/);
		expect(html).toContain("Pozrite sa na strechu zboku");
		expect(html).toContain("Pokračovať bez typu strechy");
	});

	it("links the detailed guide in a new tab, in the shopper's market, only where there is one", () => {
		expect(render()).not.toContain("Podrobný návod");
		const html = render({ guidePath: "/poradna#typ-strechy" });
		expect(html).toMatch(
			/<a[^>]*href="\/sk\/poradna#typ-strechy"[^>]*>Podrobný návod, ako spoznať typ strechy/,
		);
		const link = html.match(/<a[^>]*poradna[^>]*>/)![0];
		expect(link).toContain('target="_blank"');
		expect(html).toContain("(otvorí sa v novej karte)");
	});

	it("is told what going on without a roof type means, with the help left open", () => {
		const html = render({ answer: { kind: "unsure" } });
		expect(html).toMatch(/aria-expanded="true"[^>]*>Neviem, aký typ strechy mám/);
		expect(html).not.toMatch(/<div id="[^"]+" hidden=""/);
		expect(html).toMatch(/role="status"[^>]*>Bez typu strechy vám kompatibilitu nevieme potvrdiť/);
		expect(cards(html).every((card) => card.includes('aria-pressed="false"'))).toBe(true);
	});

	it("is told what the list is and how to ask when their roof is not on it", () => {
		const html = render();
		expect(html).toContain("Váš typ strechy tu nie je?");
		expect(html).toMatch(/<a[^>]*href="\/sk\/kontakt"[^>]*>Napíšte nám, overíme to\./);
	});
});

describe("the words exist in every language", () => {
	const source = read("src/ui/components/vehicle/roof-question.tsx");
	const asked = [...source.matchAll(/"selector\.(roof[A-Za-z]+|confirmRoofType|chooseRoofType)"/g)].map(
		(m) => m[1]!,
	);

	it("finds the keys the question asks for", () => {
		expect(new Set(asked).size).toBeGreaterThanOrEqual(15);
	});

	it.each(LOCALES)("%s has every key, a name for each roof, and none of the retired ones", (locale) => {
		const fitment = messages(locale).fitment;
		const selector = fitment.selector as Record<string, unknown>;
		for (const key of asked) expect(selector[key], `${locale} selector.${key}`).toEqual(expect.any(String));
		for (const key of [
			"roofOther",
			"roofOtherHelp",
			"roofUnsure",
			"roofUnsureHelp",
			"roofYes",
			"roofSingleQuestion",
		])
			expect(selector[key], `${locale} selector.${key}`).toBeUndefined();
		// Rendered with every roof: a missing name or hint would print its own key path.
		const html = render({ roofTypes: ALL_ROOFS, guidePath: "/poradna#typ-strechy" }, locale);
		expect(html).not.toMatch(/fitment\.|selector\./);
		expect(cards(html)).toHaveLength(6);
	});
});
