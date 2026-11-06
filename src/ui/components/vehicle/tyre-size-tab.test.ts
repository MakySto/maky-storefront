import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// The tab draws a state it is handed; it calls the server for nothing while it is rendered.
vi.mock("@/lib/tyre-size/actions", () => ({
	loadTyreStep: vi.fn(),
	rememberTyreSize: vi.fn(),
	forgetTyreSize: vi.fn(),
}));

import { tyreSteps } from "@/lib/tyre-size/size-lookup";

import { TyreSizeTab, type TyreSelector } from "./tyre-size-tab";

/**
 * The second tab of the vehicle selector, in the states a shopper meets it in. The state itself (typing, the steps,
 * the stale-answer guard) is the hook's; the tab only draws what it is handed, so these tests hand it each state and
 * look at the words and at what can be pressed.
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

const messages = (locale: string) =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
	children?: ReactNode;
}>;

const noop = () => {};
const selector = (patch: Partial<TyreSelector> = {}): TyreSelector => ({
	steps: tyreSteps(),
	current: null,
	text: "",
	width: undefined,
	profile: undefined,
	rim: undefined,
	match: null,
	unknownText: false,
	allWidths: false,
	loading: false,
	saving: false,
	error: null,
	open: noop,
	setText: noop,
	pickWidth: noop,
	pickProfile: noop,
	pickRim: noop,
	toggleAllWidths: noop,
	save: noop,
	forget: noop,
	...patch,
});

const render = (patch: Partial<TyreSelector> = {}, locale = "sk-SK") =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "UTC", messages: messages(locale) },
			createElement(TyreSizeTab, { selector: selector(patch) }),
		),
	);

const buttons = (html: string) =>
	[...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs)].map((match) => ({
		attributes: match[1],
		text: match[2].replace(/<[^>]+>/g, "").trim(),
		disabled: /\sdisabled=""/.test(match[1]),
	}));

describe("nothing entered yet", () => {
	const html = render();

	it("explains how a size is read, asks for it, and offers the steps", () => {
		expect(html).toContain("Rozmer vašich pneumatík");
		expect(html).toContain("205");
		expect(html).toContain("šírka v mm");
		expect(html).toContain("Poznáte rozmer? Napíšte ho");
		expect(html).toContain("alebo po krokoch");
		expect(html).toContain("1 · Šírka");
	});

	it("shows the usual widths first and keeps the rest behind 'more'", () => {
		const widths = tyreSteps().widths;
		const common = widths.filter((width) => width.common);
		const chips = buttons(html).filter((button) => /^\d{3}$/.test(button.text));
		expect(chips.map((chip) => chip.text)).toEqual(common.map((width) => String(width.value)));
		expect(chips.length).toBeLessThan(widths.length);
		expect(buttons(html).some((button) => button.text === "ďalšie")).toBe(true);
	});

	it("offers no profile or rim before a width, and cannot be confirmed without a size", () => {
		expect(html).not.toContain("2 · Profil");
		expect(html).not.toContain("3 · Priemer disku");
		const use = buttons(html).find((button) => button.text === "Zadajte rozmer");
		expect(use?.disabled).toBe(true);
		expect(html).not.toContain("Zabudnúť rozmer");
	});

	it("puts only buttons of type button into the page, since it is mounted beside the add-to-cart form", () => {
		for (const { attributes } of buttons(html)) expect(attributes).toMatch(/type="button"/);
		expect(html).not.toMatch(/<form\b/);
		expect(html).not.toMatch(/<input[^>]*\sname=/);
	});
});

describe("a size the list holds", () => {
	const html = render({ text: "205/55r16", match: "205/55 R16" });

	it("confirms it in the list's own spelling and lets the shopper use it", () => {
		expect(html).toContain("Rozmer 205/55 R16 máme v zozname");
		const use = buttons(html).find((button) => button.text === "Použiť rozmer 205/55 R16");
		expect(use).toBeDefined();
		expect(use?.disabled).toBe(false);
	});
});

describe("a size the list does not hold", () => {
	const html = render({ text: "145/70 R22", unknownText: true });

	it("says so, and does not offer to use it", () => {
		expect(html).toContain("Tento rozmer nemáme v zozname");
		expect(html).toContain('aria-invalid="true"');
		expect(buttons(html).find((button) => button.text === "Zadajte rozmer")?.disabled).toBe(true);
	});
});

describe("the steps", () => {
	it("offers the profiles of the chosen width, then its rims, and marks what was chosen", () => {
		const profiles = render({ width: 205, steps: tyreSteps(205) });
		expect(profiles).toContain("2 · Profil");
		expect(profiles).not.toContain("3 · Priemer disku");
		expect(buttons(profiles).some((button) => button.text === "55")).toBe(true);

		const rims = render({ width: 205, profile: 55, steps: tyreSteps(205, 55) });
		expect(rims).toContain("3 · Priemer disku");
		expect(buttons(rims).some((button) => button.text === "R16")).toBe(true);
		expect(rims).toContain('aria-pressed="true"');
	});

	it("keeps the chosen width on screen even if it is not one of the usual ones", () => {
		const rare = tyreSteps().widths.find((width) => !width.common)!.value;
		const html = render({ width: rare, steps: tyreSteps(rare) });
		expect(buttons(html).some((button) => button.text === String(rare))).toBe(true);
	});

	it("shows every width once 'more' is open, and a way back", () => {
		const html = render({ allWidths: true });
		const chips = buttons(html).filter((button) => /^\d{3}$/.test(button.text));
		expect(chips).toHaveLength(tyreSteps().widths.length);
		expect(buttons(html).some((button) => button.text === "menej")).toBe(true);
	});
});

describe("a size already remembered", () => {
	it("offers to forget it, by name", () => {
		const html = render({ current: "205/55 R16", text: "205/55 R16", match: "205/55 R16" });
		expect(buttons(html).some((button) => button.text === "Zabudnúť rozmer 205/55 R16")).toBe(true);
	});
});

describe("when the server says no", () => {
	it("tells the shopper, as an alert, and for the right action", () => {
		expect(render({ error: "save" })).toContain("Rozmer sa nepodarilo uložiť");
		expect(render({ error: "forget", current: "205/55 R16" })).toContain("Rozmer sa nepodarilo zabudnúť");
		expect(render({ error: "save" })).toContain('role="alert"');
	});
});

describe("in every language", () => {
	const states: [string, Partial<TyreSelector>][] = [
		["empty", {}],
		["a match", { text: "205/55 R16", match: "205/55 R16", current: "205/55 R16" }],
		["no match", { text: "x", unknownText: true }],
		["width and profile", { width: 205, profile: 55, steps: tyreSteps(205, 55) }],
		["all widths", { allWidths: true }],
		["errors", { error: "save" }],
	];

	it.each(LOCALES)("%s: every state is words, never a raw key or an unfilled placeholder", (locale) => {
		for (const [name, patch] of states) {
			const html = render(patch, locale);
			expect(html, `${locale} ${name}`).not.toMatch(/tyreSize\.[A-Za-z]+/);
			expect(html, `${locale} ${name}`).not.toMatch(/\{(size|tyres)\}/);
		}
	});
});
