import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentType, createElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

import { TYRE_FIELDS } from "@/lib/tyre-size/fields";
import type { TyreCardFit, TyreCardFitKind } from "@/lib/tyre-size/types";
import { ProductCard, type ProductCardData } from "./product-card";
import { TyreFitLine } from "./tyre-fit-line";

/**
 * What a snow-chain card says about the size the shopper gave: the product page's answers, in its own words.
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

// Loosely typed on purpose: the files are the fixture, and next-intl is not type-augmented.
const messages = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		any
	>;

/** The provider as the tests use it: its children go in as the third argument, so the type does not ask for the prop. */
const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
}>;

const inLocale = (locale: string, child: ReturnType<typeof createElement>) =>
	renderToStaticMarkup(
		createElement(Provider, { locale, timeZone: "UTC", messages: messages(locale) }, child),
	);

/** next-intl escapes an apostrophe the way React does, so the expected text has to as well. */
const escaped = (text: string) => text.replace(/'/g, "&#x27;");

const SIZE = "205/55 R16";
const fit = (kind: TyreCardFitKind, size = SIZE): TyreCardFit =>
	kind === "fits" ? { size, kind, answer: null } : { size, kind };

describe("the card's line about the tyre size", () => {
	it("says what the product page's row says, for each of the three answers", () => {
		const t = messages("sk-SK").tyreSize as Record<string, string>;
		const words: Record<TyreCardFitKind, string> = {
			fits: t.fitFitsTitle.replace("{size}", SIZE),
			ask: t.cardAsk,
			"no-fit": t.fitNoFitTitle.replace("{size}", SIZE),
		};
		for (const kind of Object.keys(words) as TyreCardFitKind[]) {
			const html = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit(kind) }));
			expect(html, kind).toContain(escaped(words[kind]));
			expect(html, kind).toContain(`data-fit="${kind}"`);
			expect(html, kind).toContain('data-testid="card-tyre-fit"');
		}
	});

	it("shows a fit in the fit colours and an open question in the unconfirmed colours, and nothing in between", () => {
		const fits = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("fits") }));
		expect(fits).toContain("text-fitment-fits");
		expect(fits).not.toContain("text-fitment-unconfirmed");
		const ask = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("ask") }));
		expect(ask).toContain("text-fitment-unconfirmed");
		expect(ask).not.toContain("text-fitment-fits");
	});

	it("has no 'check it yourself' warning for a size the shop holds, whichever list holds it (owner, 2026-11-07)", () => {
		for (const locale of LOCALES) {
			const t = messages(locale).tyreSize as Record<string, string>;
			expect(t.fitSupplierTitle, locale).toBeUndefined();
			expect(t.sourceSupplier, locale).toBeUndefined();
		}
		// A tick, never the warning triangle, on every green card.
		const html = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("fits") }));
		expect(html).toContain("lucide-check");
		expect(html).not.toContain("lucide-triangle-alert");
	});

	it("keeps 'does not fit' quiet: no red, no filled badge, because 130 cards may say it at once", () => {
		const html = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("no-fit") }));
		expect(html).toContain("text-text-tertiary");
		expect(html).not.toContain("fitment-no-fit");
		expect(html).not.toMatch(/\bbg-/);
	});

	it("asks without a size in the words: the question is about the tyres, the size is already known", () => {
		const html = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("ask") }));
		expect(html).not.toContain(SIZE);
	});

	it("uses the market's own words, with the size filled in, in every language", () => {
		for (const locale of LOCALES) {
			const t = messages(locale).tyreSize as Record<string, string>;
			const noFit = inLocale(locale, createElement(TyreFitLine, { fit: fit("no-fit") }));
			expect(noFit, locale).toContain(escaped(t.fitNoFitTitle.replace("{size}", SIZE)));
			expect(noFit, locale).not.toContain("{size}");
			const plain = inLocale(locale, createElement(TyreFitLine, { fit: fit("fits") }));
			expect(plain, locale).toContain(escaped(t.fitFitsTitle.replace("{size}", SIZE)));
			expect(plain, locale).not.toContain("{size}");
			const ask = inLocale(locale, createElement(TyreFitLine, { fit: fit("ask") }));
			expect(ask, locale).toContain(escaped(t.cardAsk));
		}
	});
});

describe("on the listing card", () => {
	const card = (tyreFit?: TyreCardFit, more: Partial<ProductCardData> = {}): ProductCardData => ({
		id: "product-1",
		name: "Snow chains",
		slug: "snow-chains",
		productCode: "N16128",
		variantId: "variant-1",
		quantityAvailable: 50,
		availabilityMode: "sale_to_order",
		price: 59.9,
		currency: "EUR",
		image: "",
		href: "/snow-chains",
		channel: "sk-eur",
		isPurchasable: true,
		tyreFit,
		...more,
	});
	const html = (product: ProductCardData, purchase: "stepper" | "button" = "button") =>
		inLocale("sk-SK", createElement(ProductCard, { product, purchase }));
	/** The value of a hidden input of the card's form, by name. */
	const field = (markup: string, name: string): string | null =>
		markup.match(new RegExp(`<input type="hidden" name="${name}" value="([^"]*)"`))?.[1] ?? null;
	const t = messages("sk-SK") as { common: Record<string, string>; tyreSize: Record<string, string> };

	it("carries the line when the card has a verdict, and nothing when it has none", () => {
		expect(html(card(fit("fits")))).toContain('data-testid="card-tyre-fit"');
		expect(html(card(fit("ask")))).toContain('data-fit="ask"');
		expect(html(card())).not.toContain("card-tyre-fit");
	});

	it("adds in one click when the card holds a size that fits, with that size, like a roof rack with the car chosen", () => {
		const markup = html(card(fit("fits")));
		expect(markup).toContain("<form");
		expect(markup).toContain(escaped(t.common.addToCartShort));
		expect(markup).not.toContain(escaped(t.common.viewDetail));
		expect(field(markup, TYRE_FIELDS.mode)).toBe("size");
		expect(field(markup, TYRE_FIELDS.size)).toBe(SIZE);
		expect(field(markup, TYRE_FIELDS.answer)).toBe("");
		expect(field(markup, "variantId")).toBe("variant-1");
		expect(field(markup, "quantity")).toBe("1");
	});

	it("sends the answer that made it fit along with the size, because the server checks the pair", () => {
		const markup = html(card({ size: SIZE, kind: "fits", answer: "Michelin" }));
		expect(field(markup, TYRE_FIELDS.answer)).toBe("Michelin");
	});

	it("sends the shopper to the page, and to the question, when the size depends on their tyres", () => {
		const markup = html(card(fit("ask")));
		expect(markup).toContain('href="/snow-chains"');
		expect(markup).toContain(escaped(t.tyreSize.buttonAsk));
		expect(markup).not.toContain("<form");
	});

	it("sends the shopper to the page when the size does not fit, and when no size is known", () => {
		for (const withFit of [card(fit("no-fit")), card(undefined)]) {
			const markup = html(withFit);
			expect(markup).toContain('href="/snow-chains"');
			expect(markup).toContain(escaped(t.common.viewDetail));
			expect(markup).not.toContain("<form");
		}
	});

	it("still links to the page when the product cannot be bought right now, whatever it fits", () => {
		for (const more of [{ quantityAvailable: 0 }, { isPurchasable: false }, { variantId: null }]) {
			const markup = html(card(fit("fits"), more));
			expect(markup, JSON.stringify(more)).not.toContain("<form");
			expect(markup, JSON.stringify(more)).toContain('href="/snow-chains"');
		}
	});

	it("keeps every other product's add exactly as it was, with no tyre field", () => {
		const markup = html(card(undefined, { productCode: "A7604" }));
		expect(markup).toContain("<form");
		expect(field(markup, TYRE_FIELDS.mode)).toBeNull();
		expect(field(markup, TYRE_FIELDS.size)).toBeNull();
	});
});
