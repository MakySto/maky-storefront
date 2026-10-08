import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentProps, type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { AddToCart } from "./add-to-cart";

/**
 * The block under a product's price, for a product the shop shows but cannot sell in the market.
 *
 * It used to say so three times, in the availability line, in a line under it and on a switched-off buy
 * button, beside a stepper that could not be used (a car fridge in the United States and Canada, owner,
 * 2026-10-08). Now the sentence is said once and the buy row is the one way forward, "request a quote",
 * a link to the contact page. A product that can be ordered keeps its stepper and button exactly as they were.
 */

/** The provider as the tests use it: its children go in as the third argument, so the type does not ask for the prop. */
const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
}>;

const MESSAGES = path.join(process.cwd(), "src/i18n/messages");
const LOCALES = readdirSync(MESSAGES)
	.filter((file) => file.endsWith(".json"))
	.map((file) => file.slice(0, -".json".length))
	.sort();

// Loosely typed on purpose: the files are the fixture, and next-intl is not type-augmented.
const load = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8")) as Record<string, any>;

type Props = ComponentProps<typeof AddToCart>;

const render = (locale: string, props: Partial<Props>): string =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "Europe/Bratislava", messages: load(locale) },
			createElement(AddToCart, { price: "499,00 €", ...props }),
		),
	);

const QUOTE_HREF = "/us/kontakt#quote=PRO-USER%20CoolZ%2083%20l%20(TK20410)";
const NOT_ORDERABLE: Partial<Props> = {
	disabled: true,
	disabledReason: "unavailable",
	quoteHref: QUOTE_HREF,
};

/** Text between tags is HTML-escaped; the apostrophe of "n'est" arrives as `&#x27;`. */
const escaped = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
const occurrences = (html: string, text: string): number => html.split(text).length - 1;

describe("a product that cannot be ordered in the market", () => {
	it("says so once and offers a quote, in the words of every market", () => {
		expect(LOCALES).toHaveLength(12);
		for (const locale of LOCALES) {
			const messages = load(locale);
			const html = render(locale, NOT_ORDERABLE);
			expect(occurrences(html, escaped(messages.cart.addUnavailable)), `${locale}: the sentence`).toBe(1);
			expect(html, `${locale}: the link`).toContain(`<a `);
			expect(html, `${locale}: the target`).toContain(`href="${QUOTE_HREF}"`);
			expect(html, `${locale}: the label`).toContain(escaped(messages.product.requestQuote));
			expect(occurrences(html, "<a "), `${locale}: one link`).toBe(1);
		}
	});

	it("has no stepper and no button that can only be switched off", () => {
		for (const locale of LOCALES) {
			const html = render(locale, NOT_ORDERABLE);
			expect(html, locale).not.toContain("<button");
			expect(html, locale).not.toContain('name="quantity"');
		}
	});

	it("keeps the price, and the line that says it includes VAT", () => {
		const html = render("sk-SK", NOT_ORDERABLE);
		expect(html).toContain("499,00 €");
		expect(html).toContain(load("sk-SK").product.priceWithVat);
	});

	it("reads, in Slovak, as one sentence and one button", () => {
		const html = render("sk-SK", NOT_ORDERABLE);
		expect(html).toContain("Tento produkt momentálne nie je dostupný na objednanie.");
		expect(occurrences(html, "Tento produkt momentálne nie je dostupný na objednanie.")).toBe(1);
		expect(html).toContain("Požiadať o ponuku");
	});

	it("is the purchase colour of the buy button it stands in for, never the brand copper", () => {
		// One primary-action colour per page (CLAUDE.md section 4): the link takes the green `bg-primary` the
		// buy button has, not `bg-action-primary`, which is the brand's copper.
		const tokens = (html: string): string[] =>
			(html.match(/<(?:a|button)\b[^>]*class="([^"]*)"/g) ?? []).flatMap((tag) =>
				(/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/),
			);
		const quote = tokens(render("sk-SK", NOT_ORDERABLE));
		expect(quote).toContain("bg-primary");
		expect(quote).toContain("text-primary-foreground");
		expect(quote).not.toContain("bg-action-primary");
		const buy = tokens(render("sk-SK", { disabled: false }));
		expect(buy).toContain("bg-primary");
		expect(buy).toContain("text-primary-foreground");
	});

	it("shows the sentence alone where no way to ask is given", () => {
		const html = render("sk-SK", { disabled: true, disabledReason: "unavailable" });
		expect(occurrences(html, "Tento produkt momentálne nie je dostupný na objednanie.")).toBe(1);
		expect(html).not.toContain("<a ");
		expect(html).not.toContain("<button");
	});
});

describe("a product that can be ordered", () => {
	it("keeps its stepper and its buy button, and offers no quote", () => {
		for (const locale of LOCALES) {
			const messages = load(locale);
			const html = render(locale, { disabled: false, quoteHref: QUOTE_HREF });
			expect(html, locale).toContain("<button");
			expect(html, locale).toContain('name="quantity"');
			expect(html, locale).toContain(escaped(messages.common.addToCart));
			expect(html, locale).not.toContain("<a ");
			expect(html, locale).not.toContain(escaped(messages.product.requestQuote));
			expect(html, locale).not.toContain(escaped(messages.cart.addUnavailable));
		}
	});

	it("keeps the switched-off button for a choice not yet made and for no stock", () => {
		const choose = render("sk-SK", { disabled: true, disabledReason: "no-selection" });
		expect(choose).toContain("<button");
		expect(choose).toContain(load("sk-SK").product.selectOptions);
		expect(choose).not.toContain("<a ");

		const empty = render("sk-SK", { disabled: true, disabledReason: "out-of-stock" });
		expect(empty).toContain("<button");
		expect(empty).toContain(load("sk-SK").common.outOfStock);
		expect(empty).not.toContain("<a ");
	});
});
