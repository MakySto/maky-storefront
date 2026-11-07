import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentType, createElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ addListingItemToCartAction: vi.fn() }));

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
const fit = (kind: TyreCardFitKind, size = SIZE): TyreCardFit => ({ size, kind });

describe("the card's line about the tyre size", () => {
	it("says what the product page's row says, for each of the four answers", () => {
		const t = messages("sk-SK").tyreSize as Record<string, string>;
		const words: Record<TyreCardFitKind, string> = {
			fits: t.fitFitsTitle.replace("{size}", SIZE),
			"fits-supplier": t.fitSupplierTitle.replace("{size}", SIZE),
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

	it("shows a confirmed fit in the fit colours and a doubtful or open one in the unconfirmed colours", () => {
		const fits = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit("fits") }));
		expect(fits).toContain("text-fitment-fits");
		for (const kind of ["fits-supplier", "ask"] as const) {
			const html = inLocale("sk-SK", createElement(TyreFitLine, { fit: fit(kind) }));
			expect(html, kind).toContain("text-fitment-unconfirmed");
			expect(html, kind).not.toContain("text-fitment-fits");
		}
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
	const card = (tyreFit?: TyreCardFit): ProductCardData => ({
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
	});
	const html = (product: ProductCardData) => inLocale("sk-SK", createElement(ProductCard, { product }));

	it("carries the line when the card has a verdict, and nothing when it has none", () => {
		expect(html(card(fit("fits")))).toContain('data-testid="card-tyre-fit"');
		expect(html(card(fit("ask")))).toContain('data-fit="ask"');
		expect(html(card())).not.toContain("card-tyre-fit");
	});

	it("still sends the shopper to the page, where the size is confirmed, and offers no quick add", () => {
		for (const kind of ["fits", "ask", "no-fit"] as const) {
			const withFit = html(card(fit(kind)));
			expect(withFit, kind).toContain('href="/snow-chains"');
			expect(withFit, kind).not.toContain("<form");
		}
	});
});
