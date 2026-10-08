import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { ProductManufacturer } from "./product-manufacturer";

/**
 * The block under the description that names the maker of a product (`lib/manufacturers`), rendered with the
 * market's own message catalogue.
 *
 * A product offered to consumers in the EU has to name its manufacturer where it is offered. The block is drawn
 * for the brands the shop holds the details of (PRO-USER and Spinder) and for no other; the heading and the
 * country are in the market's language, the company's name and address are the company's own.
 */

const load = (locale: string): Record<string, any> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		any
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

/** The product's attributes as the page's query returns them, with the maker's brand among them. */
const attributes = (brandSlug: string | null, reference = "cfm:attribute:manufacturer") => [
	{ attribute: { externalReference: "cfm:attribute:warranty_years" }, values: [{ slug: "3" }] },
	{
		attribute: { externalReference: reference },
		values: brandSlug ? [{ slug: brandSlug }] : [],
	},
];

const html = (brandSlug: string | null, channel: string) =>
	render(ProductManufacturer({ attributes: attributes(brandSlug), channel }));

describe("the manufacturer block", () => {
	it("names Tradekar Benelux, its address and its e-mail on a PRO-USER product, in every market", async () => {
		expect(Object.keys(CHANNEL_MAP)).toHaveLength(12);
		for (const [market, row] of Object.entries(CHANNEL_MAP)) {
			const out = await html("pro-user", row.saleorSlug);
			expect(out, market).toContain("Tradekar Benelux B.V.");
			expect(out, market).toContain("Ohmweg 1");
			expect(out, market).toContain("4140 BM Culemborg");
			expect(out, market).toContain('href="mailto:service@tradekar.com"');
			expect(out, market).toContain("<address");
		}
	});

	it("is the same block for a Spinder product", async () => {
		const spinder = await html("spinder", CHANNEL_MAP.sk.saleorSlug);
		expect(spinder).toBe(await html("pro-user", CHANNEL_MAP.sk.saleorSlug));
	});

	it("has the heading and the country in the market's language", async () => {
		const expected: Record<string, [string, string]> = {
			sk: ["Výrobca", "Holandsko"],
			cz: ["Výrobce", "Nizozemsko"],
			de: ["Hersteller", "Niederlande"],
			at: ["Hersteller", "Niederlande"],
			pl: ["Producent", "Holandia"],
			hu: ["Gyártó", "Hollandia"],
			it: ["Produttore", "Paesi Bassi"],
			fr: ["Fabricant", "Pays-Bas"],
			es: ["Fabricante", "Países Bajos"],
			ro: ["Producător", "Țările de Jos"],
			us: ["Manufacturer", "Netherlands"],
			ca: ["Manufacturer", "Netherlands"],
		};
		for (const [market, [heading, country]] of Object.entries(expected)) {
			const out = await html("pro-user", CHANNEL_MAP[market]!.saleorSlug);
			expect(out, market).toContain(`>${heading}</h2>`);
			expect(out, market).toContain(`<br/>${country}<br/>`); // the country, on its own line
			// And it is the catalogue's own heading, not a copy kept in the test.
			expect(out, market).toContain(load(CHANNEL_MAP[market]!.locale).product.manufacturerHeading);
		}
	});

	it("is labelled by its heading", async () => {
		const out = await html("pro-user", CHANNEL_MAP.sk.saleorSlug);
		expect(out).toContain('aria-labelledby="product-manufacturer"');
		expect(out).toContain('id="product-manufacturer"');
	});

	it("is drawn for no other brand, and for a product with none", async () => {
		for (const brand of ["thule", "nordrive", "neznackove", null]) {
			expect(await html(brand, CHANNEL_MAP.sk.saleorSlug), String(brand)).toBe("");
		}
		expect(await render(ProductManufacturer({ attributes: [], channel: CHANNEL_MAP.sk.saleorSlug }))).toBe(
			"",
		);
	});

	it("reads the brand from the manufacturer attribute only", async () => {
		// A value that happens to be called pro-user on another attribute is not the product's brand.
		const other = attributes("pro-user", "cfm:attribute:series");
		const out = await render(ProductManufacturer({ attributes: other, channel: CHANNEL_MAP.sk.saleorSlug }));
		expect(out).toBe("");
	});

	it("takes a class from the page, for its place in it", async () => {
		const out = await render(
			ProductManufacturer({
				attributes: attributes("pro-user"),
				channel: CHANNEL_MAP.sk.saleorSlug,
				className: "mt-6",
			}),
		);
		expect(out).toMatch(/<section[^>]* class="[^"]*\bmt-6\b/);
	});
});
