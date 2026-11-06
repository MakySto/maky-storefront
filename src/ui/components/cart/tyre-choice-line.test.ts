import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { TyreChoiceLine } from "./tyre-choice-line";

/**
 * What the cart, the checkout summary and the order say about the tyre size a snow chain was added with.
 *
 * The component is a client component on purpose (`locale-binding.test.ts` refuses a server component that asks for
 * translations without a locale), so it speaks the language of the provider around it: these tests render it under
 * the real message files, and look for raw keys as well as for words, since a missing next-intl key does not fail
 * anything, it prints its own path.
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

/** The provider as the tests use it: its children go in as the third argument, so the type does not ask for the prop. */
const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
}>;

const render = (locale: string, metadata: Parameters<typeof TyreChoiceLine>[0]["metadata"]) =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "UTC", messages: messages(locale) },
			createElement(TyreChoiceLine, { metadata }),
		),
	);

const SIZE = [
	{ key: "maky_tyre_mode", value: "size" },
	{ key: "maky_tyre_list", value: "snehove-retaze-20261105" },
	{ key: "maky_tyre_size", value: "145/70 R12" },
	{ key: "maky_tyre_basis", value: "manufacturer_list_2026_10" },
];

const SIZE_NOT = [
	{ key: "maky_tyre_mode", value: "size" },
	{ key: "maky_tyre_list", value: "snehove-retaze-20261105" },
	{ key: "maky_tyre_size", value: "195/75 R16" },
	{ key: "maky_tyre_condition_mode", value: "not" },
	{ key: "maky_tyre_condition_tyres", value: "Kleber / Michelin / Continental" },
	{ key: "maky_tyre_basis", value: "manufacturer_list_2026_10" },
];

const SIZE_ONLY = [
	{ key: "maky_tyre_mode", value: "size" },
	{ key: "maky_tyre_list", value: "snehove-retaze-20261105" },
	{ key: "maky_tyre_size", value: "215/60 R16" },
	{ key: "maky_tyre_condition_mode", value: "only" },
	{ key: "maky_tyre_condition_tyres", value: "Bridgestone Duravis Rxxx" },
	{ key: "maky_tyre_basis", value: "manufacturer_list_2026_10" },
];

const CODE = [
	{ key: "maky_tyre_mode", value: "code" },
	{ key: "maky_tyre_list", value: "snehove-retaze-20261105" },
];

describe("TyreChoiceLine", () => {
	it("says the size the line was added with", () => {
		const html = render("sk-SK", SIZE);
		expect(html).toContain("Rozmer pneumatík: 145/70 R12");
		expect(html).not.toContain("Iba na pneumatiky");
		expect(html).not.toContain("Nie na pneumatiky");
	});

	it("adds the condition the list attached to that size, in the right direction", () => {
		const not = render("sk-SK", SIZE_NOT);
		expect(not).toContain("Rozmer pneumatík: 195/75 R16");
		expect(not).toContain("Nie na pneumatiky: Kleber / Michelin / Continental");

		const only = render("sk-SK", SIZE_ONLY);
		expect(only).toContain("Rozmer pneumatík: 215/60 R16");
		expect(only).toContain("Iba na pneumatiky: Bridgestone Duravis Rxxx");
	});

	it("says plainly that the customer chose the product without a size", () => {
		const html = render("sk-SK", CODE);
		expect(html).toContain("Rozmer neuvedený, produkt zvolený bez rozmeru");
		expect(html).not.toContain("Rozmer pneumatík:");
	});

	it("renders nothing for every other line: no metadata, no tyre metadata, a half-written one", () => {
		expect(render("sk-SK", [])).toBe("");
		expect(render("sk-SK", null)).toBe("");
		expect(render("sk-SK", undefined)).toBe("");
		expect(render("sk-SK", [{ key: "gift_note", value: "Ahoj" }])).toBe("");
		// A size mode without a size is no statement at all.
		expect(render("sk-SK", [{ key: "maky_tyre_mode", value: "size" }])).toBe("");
	});

	it("speaks the language of the market around it, not Slovak", () => {
		expect(render("en-US", SIZE_NOT)).toContain("Tire size: 195/75 R16");
		expect(render("de-DE", SIZE)).toContain("145/70 R12");
		expect(render("de-DE", SIZE)).not.toContain("Rozmer");
		expect(render("pl-PL", CODE)).not.toContain("Rozmer neuvedený");
	});

	it.each(LOCALES)("%s: every state is written out, with no raw message key", (locale) => {
		for (const metadata of [SIZE, SIZE_NOT, SIZE_ONLY, CODE]) {
			const html = render(locale, metadata);
			expect(html, locale).not.toBe("");
			expect(html, locale).not.toMatch(/tyreSize\.|MISSING_MESSAGE|lineSize|lineCode|lineOnly|lineNot/);
		}
		// Every state names what it needs: the size, and the makes of the condition.
		expect(render(locale, SIZE)).toContain("145/70 R12");
		expect(render(locale, SIZE_NOT)).toContain("Kleber / Michelin / Continental");
		expect(render(locale, SIZE_ONLY)).toContain("Bridgestone Duravis Rxxx");
	});
});
