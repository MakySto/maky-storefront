import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { PurchaseTrust } from "./purchase-trust";

/**
 * The strip under the buy button, rendered with the market's own message catalogue.
 *
 * It said "Záruka 2 roky" on every page, and the five PRO-USER fridges carry three (owner, 2026-10-05),
 * so the page can now hand it the product's own figure. What is tested is that the figure reaches every
 * market's words and that the statutory line stays exactly as it was wherever no figure is given.
 */

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

const render = async (element: Promise<ReactNode> | ReactNode): Promise<string> =>
	renderToStaticMarkup(createElement(Fragment, null, await element));

const SK_CHANNEL = CHANNEL_MAP.sk.saleorSlug;

/** The market's translator for the `product` namespace, with keys as plain strings. */
const translatorFor = (locale: string) =>
	createTranslator({
		locale,
		messages: load(locale) as never,
		namespace: "product" as never,
	}) as unknown as (key: string, values?: Record<string, unknown>) => string;

/** The four items of the strip, in the order the page shows them. */
const items = (html: string): string[] => html.split("<li>").slice(1);

describe("the strip under the buy button", () => {
	it("says the statutory two years where the page hands it no warranty of the product's own", async () => {
		for (const warrantyYears of [undefined, null, 0]) {
			const html = await render(PurchaseTrust({ channel: SK_CHANNEL, warrantyYears }));
			expect(html, String(warrantyYears)).toContain("Záruka 2 roky");
			expect(html, String(warrantyYears)).toContain("Na tovar podľa zákona");
			expect(html, String(warrantyYears)).not.toContain("Na tento produkt");
		}
	});

	it("says the product's own years, and no longer says it is by law", async () => {
		const html = await render(PurchaseTrust({ channel: SK_CHANNEL, warrantyYears: 3 }));
		expect(html).toContain("Záruka 3 roky");
		expect(html).toContain("Na tento produkt");
		expect(html).not.toContain("Záruka 2 roky");
		expect(html).not.toContain("podľa zákona");
		// The count follows the Slovak plural.
		expect(await render(PurchaseTrust({ channel: SK_CHANNEL, warrantyYears: 5 }))).toContain(
			"Záruka 5 rokov",
		);
	});

	it("changes the warranty item only: payment, shipping and returns stay exactly as they were", async () => {
		const statutory = items(await render(PurchaseTrust({ channel: SK_CHANNEL })));
		const own = items(await render(PurchaseTrust({ channel: SK_CHANNEL, warrantyYears: 3 })));
		expect(statutory).toHaveLength(4);
		expect(own).toHaveLength(4);
		expect(own.slice(0, 3)).toEqual(statutory.slice(0, 3));
		expect(own[3]).not.toEqual(statutory[3]);
	});

	it("carries the product's years in every market's words", async () => {
		for (const { saleorSlug, locale } of Object.values(CHANNEL_MAP)) {
			const t = translatorFor(locale);
			for (const count of [3, 4, 5]) {
				const html = await render(PurchaseTrust({ channel: saleorSlug, warrantyYears: count }));
				const title = t("trustWarrantyYearsTitle", { years: t("content.years", { count }) });
				const text = t("trustWarrantyYearsText");
				const label = `${locale} ${count}`;
				// A missing key would make the translator answer the key's own path, the same on both sides.
				const messages = (load(locale).product ?? {}) as Record<string, unknown>;
				expect(typeof messages.trustWarrantyYearsTitle, label).toBe("string");
				expect(typeof messages.trustWarrantyYearsText, label).toBe("string");
				expect(title, label).toContain(String(count));
				expect(title, label).not.toMatch(/[{}]/);
				expect(html, label).toContain(title);
				expect(html, label).toContain(text);
				// The statutory words are not printed beside a figure that is not the statute's.
				expect(html, label).not.toContain(t("trustWarrantyText"));
				expect(html, label).not.toContain(t("trustWarrantyTitle"));
			}
		}
	});
});
