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
	listed: false,
	unknownText: false,
	vehicleInUse: false,
	entry: "steps",
	loading: false,
	saving: false,
	error: null,
	open: noop,
	setText: noop,
	pickWidth: noop,
	pickProfile: noop,
	pickRim: noop,
	setEntry: noop,
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

/** The three fields in the order they stand on the page: the options a shopper can pick, and whether the field is open. */
const selects = (html: string) =>
	[...html.matchAll(/<select\b([^>]*)>(.*?)<\/select>/gs)].map((match) => {
		const options = [...match[2].matchAll(/<option\b([^>]*)>(.*?)<\/option>/gs)].map((option) => ({
			value: /value="([^"]*)"/.exec(option[1])?.[1] ?? "",
			text: option[2],
			selected: /\sselected=""/.test(option[1]),
		}));
		return {
			disabled: /\sdisabled=""/.test(match[1]),
			options: options.filter((option) => option.value !== ""),
		};
	});

describe("nothing entered yet", () => {
	const html = render();

	it("asks for the size and says where it is written", () => {
		expect(html).toContain("Rozmer vašich pneumatík");
		expect(html).toContain("Nájdete ho na boku pneumatiky. Zadáte ho raz, obchod si ho zapamätá.");
		expect(html).toContain("Šírka");
		expect(html).toContain("Profil");
		expect(html).toContain("Priemer disku");
	});

	it("offers the three fields in the order a tyre is read, and only the first is open", () => {
		const [width, profile, rim] = selects(html);
		expect(width.disabled).toBe(false);
		expect(profile.disabled).toBe(true);
		expect(rim.disabled).toBe(true);
		// Every width the list holds, ascending, once.
		const widths = tyreSteps().widths.map((entry) => String(entry.value));
		expect(width.options.map((option) => option.value)).toEqual(widths);
		expect(profile.options).toHaveLength(0);
		expect(rim.options).toHaveLength(0);
	});

	it("cannot be confirmed without a size, offers nothing to forget, and offers the whole size typed", () => {
		const use = buttons(html).find((button) => button.text === "Zadajte rozmer");
		expect(use?.disabled).toBe(true);
		expect(html).not.toContain("Zabudnúť rozmer");
		expect(buttons(html).some((button) => button.text === "Zadať celý rozmer")).toBe(true);
	});

	it("keeps the way to read a size one click away and closed, with the numbers explained", () => {
		expect(html).toMatch(/<details\b(?![^>]*\sopen)/);
		expect(html).toContain("Kde nájdem rozmer?");
		expect(html).toContain("šírka v mm");
		expect(html).toContain("profil v %");
		expect(html).toContain("priemer disku");
		expect(html).toContain("Rozmer 205/55 R16 sa číta takto");
	});

	it("puts only buttons of type button into the page, since it is mounted beside the add-to-cart form", () => {
		for (const { attributes } of buttons(html)) expect(attributes).toMatch(/type="button"/);
		expect(html).not.toMatch(/<form\b/);
		expect(html).not.toMatch(/<input[^>]*\sname=/);
		expect(html).not.toMatch(/<select[^>]*\sname=/);
	});
});

describe("the steps", () => {
	it("offers the profiles of the chosen width, opens the next field, and marks what was chosen", () => {
		const [width, profile, rim] = selects(render({ width: 205, steps: tyreSteps(205) }));
		expect(width.options.find((option) => option.selected)?.value).toBe("205");
		expect(profile.disabled).toBe(false);
		expect(profile.options.map((option) => option.value)).toEqual(
			(tyreSteps(205).profiles ?? []).map((value) => String(value)),
		);
		expect(profile.options.some((option) => option.value === "55")).toBe(true);
		expect(rim.disabled).toBe(true);
	});

	it("offers the rims of the chosen width and profile, spelled with their R", () => {
		const [, , rim] = selects(render({ width: 205, profile: 55, steps: tyreSteps(205, 55) }));
		expect(rim.disabled).toBe(false);
		expect(rim.options.some((option) => option.value === "16" && option.text === "R16")).toBe(true);
		expect(rim.options.map((option) => option.value)).toEqual(tyreSteps(205, 55).rims);
	});

	it("shows the whole path when it is complete: the three choices are on, and the size is ready to use", () => {
		const html = render({
			width: 205,
			profile: 55,
			rim: "16",
			steps: tyreSteps(205, 55),
			match: "205/55 R16",
			listed: true,
		});
		const fields = selects(html);
		expect(fields.map((field) => field.options.find((option) => option.selected)?.value)).toEqual([
			"205",
			"55",
			"16",
		]);
		expect(html).toContain("205/55 R16 · rozmer máme v zozname");
		const use = buttons(html).find((button) => button.text === "Použiť rozmer 205/55 R16");
		expect(use?.disabled).toBe(false);
	});

	it("keeps the chosen width on screen even if it is not one of the usual ones", () => {
		const rare = tyreSteps().widths.find((width) => !width.common)!.value;
		const [width] = selects(render({ width: rare, steps: tyreSteps(rare) }));
		expect(width.options.some((option) => option.value === String(rare) && option.selected)).toBe(true);
	});
});

describe("the whole size typed", () => {
	it("shows one input instead of the three fields, with a way back to the steps", () => {
		const html = render({ entry: "text" });
		expect(selects(html)).toHaveLength(0);
		expect(html).toContain("Celý rozmer");
		expect(html).toContain('placeholder="napr. 205/55 R16"');
		expect(html).toContain("Nezvyčajný rozmer, napríklad 175 R13 alebo 4.00-12? Napíšte ho celý.");
		expect(buttons(html).some((button) => button.text === "Vybrať po častiach")).toBe(true);
	});

	it("confirms a size the list holds in the list's own spelling and lets the shopper use it", () => {
		const html = render({ entry: "text", text: "205/55r16", match: "205/55 R16", listed: true });
		expect(html).toContain("205/55 R16 · rozmer máme v zozname");
		const use = buttons(html).find((button) => button.text === "Použiť rozmer 205/55 R16");
		expect(use).toBeDefined();
		expect(use?.disabled).toBe(false);
		expect(html).toContain("border-fitment-fits");
	});

	it("remembers a well-formed size the list does not hold, and says the shop cannot verify it", () => {
		const html = render({ entry: "text", text: "205/40 R21", match: "205/40 R21", listed: false });
		expect(html).toContain("205/40 R21 · tento rozmer nemáme v zozname reťazí");
		expect(html).toContain("Rozmer si zapamätáme, vhodnosť reťazí vám však musíme overiť.");
		// A real tyre, so the shopper may use it; it is not the green of a size that was found.
		const use = buttons(html).find((button) => button.text === "Použiť rozmer 205/40 R21");
		expect(use?.disabled).toBe(false);
		expect(html).toContain("text-fitment-unconfirmed");
		expect(html).not.toContain("rozmer máme v zozname");
	});

	it("says what it is told when the text is not a size at all, and does not offer to use it", () => {
		const html = render({ entry: "text", text: "205/55 R61", unknownText: true });
		expect(html).toContain("Toto nevyzerá ako rozmer pneumatiky");
		expect(html).toContain(
			"Skontrolujte, či ste ho prepísali presne z boku pneumatiky, napríklad 205/55 R16.",
		);
		expect(html).toContain('aria-invalid="true"');
		expect(buttons(html).find((button) => button.text === "Zadajte rozmer")?.disabled).toBe(true);
	});
});

describe("a size already remembered", () => {
	it("offers to forget it, by name", () => {
		const html = render({
			current: "205/55 R16",
			entry: "text",
			text: "205/55 R16",
			match: "205/55 R16",
			listed: true,
		});
		expect(buttons(html).some((button) => button.text === "Zabudnúť rozmer 205/55 R16")).toBe(true);
	});
});

describe("when a car is in use", () => {
	it("says the size is remembered for that car, and says nothing of it otherwise", () => {
		expect(render({ vehicleInUse: true })).toContain("Rozmer si zapamätáme pre vaše vybrané vozidlo.");
		expect(render({ vehicleInUse: false })).not.toContain("pre vaše vybrané vozidlo");
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
		["width and profile", { width: 205, profile: 55, steps: tyreSteps(205, 55) }],
		[
			"a full path",
			{ width: 205, profile: 55, rim: "16", steps: tyreSteps(205, 55), match: "205/55 R16", listed: true },
		],
		["typed", { entry: "text" }],
		[
			"a listed match",
			{ entry: "text", text: "205/55 R16", match: "205/55 R16", listed: true, current: "205/55 R16" },
		],
		["an unlisted match", { entry: "text", text: "205/40 R21", match: "205/40 R21", listed: false }],
		["no match", { entry: "text", text: "x", unknownText: true }],
		["a car in use", { vehicleInUse: true }],
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
