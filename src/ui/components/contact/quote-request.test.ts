import { readFileSync } from "node:fs";
import path from "node:path";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { QuoteRequestNotice } from "./quote-request";

/**
 * The note above the contact copy is read from the URL fragment in the browser and nowhere else, so on the
 * server it renders nothing: `/kontakt` is one static page for every visitor, whatever product they came for.
 */

/** The provider as the tests use it: its children go in as the third argument, so the type does not ask for the prop. */
const Provider = NextIntlClientProvider as unknown as ComponentType<{
	locale: string;
	timeZone: string;
	messages: unknown;
}>;

const messages = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

const render = (locale: string): string =>
	renderToStaticMarkup(
		createElement(
			Provider,
			{ locale, timeZone: "Europe/Bratislava", messages: messages(locale) },
			createElement(QuoteRequestNotice),
		),
	);

describe("QuoteRequestNotice on the server", () => {
	it("renders nothing, in every market", () => {
		for (const locale of ["sk-SK", "cs-CZ", "de-DE", "de-AT", "en-US", "en-CA", "hu-HU", "fr-FR"]) {
			expect(render(locale), locale).toBe("");
		}
	});

	it("does not read the browser's address on the server", () => {
		// A server has no `window`; reading one would throw rather than answer "no fragment".
		expect(typeof window).toBe("undefined");
		expect(() => render("sk-SK")).not.toThrow();
	});

	it("is the slot of /kontakt above the approved copy, and the form is not offered by it", () => {
		const page = readFileSync(path.join(process.cwd(), "src/app/[channel]/(main)/kontakt/page.tsx"), "utf8");
		expect(page).toContain("Before: QuoteRequestNotice");
		expect(page).toContain("After: ContactSection");
	});
});
