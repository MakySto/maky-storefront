import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import { tyrePickerData, tyreSizeIndex } from "@/lib/tyre-size/size-index";
import type { TyrePickerData } from "@/lib/tyre-size/types";

import { TyreSizeGate, useTyreSizeGate } from "./tyre-size-picker";

/**
 * The first thing a customer meets on a snow chain's page: the tyre-size choice, with nothing chosen.
 *
 * The behaviour (which sizes follow which rim, when a choice is complete, what the form carries) is
 * `lib/tyre-size/picker-state`, which has its own tests against the server's check. This pins what the component
 * draws from it on first render, which is also what a visitor gets before any JavaScript runs: the form already
 * carries "no size", the size list waits for a rim, and the buy buttons (which read the gate) are told it is not
 * complete. A real browser run of the same page, on desktop and on a phone, is in the pull request.
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
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as {
		tyreSize: Record<string, string>;
	};

/** What the buy buttons see: null outside a gate, "incomplete" or "complete" inside one. */
function Probe() {
	const gate = useTyreSizeGate();
	return createElement("span", {
		"data-gate": gate === null ? "none" : gate.complete ? "complete" : "incomplete",
	});
}

/** The provider and the gate as the tests use them: children go in as the third argument, so the types do not ask for the prop. */
const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
}>;
const Gate = TyreSizeGate as unknown as ComponentType<{ data: TyrePickerData }>;

const provide = (locale: string, child: ReactNode) =>
	renderToStaticMarkup(
		createElement(Provider, { locale, timeZone: "UTC", messages: messages(locale) }, child),
	);

const gated = (code: string, locale = "sk-SK") =>
	provide(locale, createElement(Gate, { data: tyrePickerData(code)! }, createElement(Probe)));

const selects = (html: string) =>
	[...html.matchAll(/<select\b([^>]*)>(.*?)<\/select>/gs)].map((match) => ({
		attributes: match[1],
		options: [...match[2].matchAll(/<option\b/g)].length,
		// The attribute, not the word: the classes carry `disabled:cursor-not-allowed`.
		disabled: /\sdisabled=""/.test(match[1]),
	}));

/** React escapes text in markup: "won't" is written "won&#x27;t". */
const escaped = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#x27;");

const codes = Object.keys(tyreSizeIndex().products);
const withManySources = codes.find((code) => tyrePickerData(code)!.rims.length > 1)!;
const withOneRim = codes.find((code) => tyrePickerData(code)!.rims.length === 1);
const fromSupplier = codes.find((code) => !tyrePickerData(code)!.fromManufacturerList);
const fromManufacturer = codes.find((code) => tyrePickerData(code)!.fromManufacturerList);

describe("the gate the buy buttons read", () => {
	it("is absent outside a snow chain's page, so every other product is bought as before", () => {
		expect(provide("sk-SK", createElement(Probe))).toContain('data-gate="none"');
	});

	it("starts incomplete: nothing is chosen for the customer", () => {
		expect(gated("N16061")).toContain('data-gate="incomplete"');
	});
});

describe("the picker on first render", () => {
	const html = gated("N16061");
	const t = messages("sk-SK").tyreSize;

	it("carries 'no size' in the form already, under the field names the server reads", () => {
		expect(html).toContain(`<input type="hidden" name="${TYRE_FIELDS.mode}" value="size"/>`);
		expect(html).toContain(`<input type="hidden" name="${TYRE_FIELDS.size}" value=""/>`);
		expect(html).toContain(`<input type="hidden" name="${TYRE_FIELDS.condition}" value=""/>`);
	});

	it("names no field on the visible selects: the three hidden ones are the whole choice", () => {
		for (const select of selects(html)) expect(select.attributes).not.toMatch(/\bname=/);
	});

	it("offers every rim of the code, and holds the size list until one is chosen", () => {
		const [rim, size] = selects(html);
		expect(rim.options).toBe(tyrePickerData("N16061")!.rims.length + 1);
		expect(rim.disabled).toBe(false);
		expect(size.disabled).toBe(true);
		expect(size.options).toBe(1);
		expect(html).toContain(escaped(t.sizePlaceholderFirst));
	});

	it("says what the customer is choosing, and how to find it on a tyre", () => {
		expect(html).toContain(escaped(t.heading));
		expect(html).toContain(escaped(t.intro));
		expect(html).toContain(escaped(t.notListed));
	});

	it("offers the way out for a customer who knows the code, unticked", () => {
		expect(html).toContain(escaped(t.knowsCode));
		expect(html).not.toContain(escaped(t.knowsCodeNote));
	});

	it("shows no condition before a size is chosen", () => {
		expect(html).not.toContain(escaped(t.confirmOnly.split("{")[0]));
		expect(html).not.toContain(escaped(t.confirmNot.split("{")[0]));
	});
});

describe("a code with a single rim", () => {
	it("takes that rim for the customer and offers its sizes, but still chooses no size", () => {
		expect(withOneRim, "the list holds a code with one rim").toBeDefined();
		const data = tyrePickerData(withOneRim!)!;
		const html = gated(withOneRim!);
		const all = selects(html);
		expect(all).toHaveLength(1);
		expect(all[0].disabled).toBe(false);
		expect(all[0].options).toBe(data.rims[0].sizes.length + 1);
		expect(html).toContain('data-gate="incomplete"');
		expect(html).toContain(`<input type="hidden" name="${TYRE_FIELDS.size}" value=""/>`);
	});
});

describe("where the sizes come from, said in the customer's language", () => {
	it("a manufacturer's list says so", () => {
		expect(fromManufacturer).toBeDefined();
		const t = messages("sk-SK").tyreSize;
		const html = gated(fromManufacturer!);
		expect(html).toContain(escaped(t.sourceManufacturer));
		expect(html).not.toContain(escaped(t.sourceSupplier));
	});

	it("the previous shop's cards are not passed off as one", () => {
		expect(fromSupplier).toBeDefined();
		const t = messages("sk-SK").tyreSize;
		const html = gated(fromSupplier!);
		expect(html).toContain(escaped(t.sourceSupplier));
		expect(html).not.toContain(escaped(t.sourceManufacturer));
	});
});

describe.each(LOCALES)("%s", (locale) => {
	it("draws the picker in its own language, with no raw message key", () => {
		const html = gated(withManySources, locale);
		const t = messages(locale).tyreSize;
		expect(html).toContain(escaped(t.heading));
		expect(html).toContain(escaped(t.rim));
		expect(html).toContain(escaped(t.knowsCode));
		expect(html).not.toMatch(/tyreSize\.|MISSING_MESSAGE/);
	});
});
