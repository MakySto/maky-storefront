import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The vehicle-page copy moved from literals into the `catalog` namespace (COMMERCE-2 M2).
 *
 * Two promises are pinned here. Slovakia renders EXACTLY the strings it rendered before —
 * the brief forbids changing live Slovak copy as a side effect of translating the other
 * eleven markets, so the expected Slovak text below is the old JSX, typed out, not read
 * from the message file the component also reads. And no other market renders a Slovak
 * sentence: the runtime merges missing keys from en-US, so a key forgotten in one file
 * would still look fine in a demo, and only a test that renders each market catches it.
 *
 * `createTranslator` is next-intl's own formatter, so ICU plurals are exercised for real.
 */

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../../i18n/messages");
type Messages = {
	configurator: { resultsTitle: string };
	common: { onOrder: string };
	cart: { addUnavailable: string };
};
const load = (locale: string): Messages =>
	JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8")) as Messages;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

import { type FitmentOffer, type FitmentOffers } from "@/lib/fitment/offers";
import { CatalogOfferList, formatOfferPrice } from "./offer-list";

const offer = (i: number, over: Partial<FitmentOffer> = {}): FitmentOffer => ({
	saleorProductId: `p${i}`,
	saleorVariantId: `v${i}`,
	externalReference: `ext${i}`,
	productKind: "roof-rack-set",
	name: `Set ${i}`,
	slug: `set-${i}`,
	thumbnailUrl: null,
	thumbnailAlt: null,
	categoryName: null,
	price: { amount: 72, currency: "EUR" },
	availability: "on-demand",
	completeSetIncludes: null,
	facets: null,
	isPurchasable: true,
	isDemo: false,
	...over,
});

const NO_REJECTIONS = {
	"not-published": 0,
	"variant-missing": 0,
	"identity-mismatch": 0,
	"wrong-kind": 0,
	"not-sellable": 0,
	"not-localized": 0,
	"lookup-failed": 0,
} as const;

const offers = (over: Partial<FitmentOffers> = {}): FitmentOffers => ({
	offers: [],
	compatibleCount: 0,
	purchasableCount: 0,
	rejected: { ...NO_REJECTIONS },
	lookupFailed: false,
	isDemo: false,
	...over,
});

/** Visible text: tags dropped, React's `<!-- -->` separators dropped, entities decoded. */
async function text(value: FitmentOffers, locale: string, channel = "sk-eur"): Promise<string> {
	const html = renderToStaticMarkup(await CatalogOfferList({ offers: value, channel, locale }));
	return html
		.replace(/<!-- -->/g, "")
		.replace(/<[^>]+>/g, "|")
		.replace(/&#x27;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&");
}

const SEVEN = offers({
	offers: Array.from({ length: 7 }, (_, i) => offer(i, i === 6 ? { availability: "out-of-stock" } : {})),
	compatibleCount: 7,
	purchasableCount: 7,
});

// The old JSX, typed out. Not read from sk-SK.json on purpose.
const SK = {
	title: "Kompatibilné zostavy",
	count7: "7 zostáv",
	onOrder: "Na objednávku",
	outOfStock: "Momentálne nedostupné",
	price: "72.00 EUR",
	lookupFailed:
		"Ponuku sa teraz nepodarilo načítať. Skúste to prosím o chvíľu — nie je to informácia o tom, že na vaše vozidlo nič nepasuje.",
	unverified:
		"Pre toto vozidlo zatiaľ nemáme overenú zostavu. Nejaké záznamy existujú, ale zatiaľ nie sú overené.",
	askUs:
		"Pre toto vozidlo zatiaľ nemáme overenú zostavu. Neznamená to, že naň nič nepasuje — napíšte nám a overíme to.",
	demo: "Testovacia ukážka. Ide o simulované údaje, nie o skutočnú ponuku ani o overenú kompatibilitu.",
	partial: "Časť ponuky sa nepodarilo načítať, zoznam preto nemusí byť úplný.",
};

/**
 * Every Slovak sentence on its own. The leak check needs atoms, not the composed strings
 * above: a market that copied one Slovak sentence next to one of its own would not
 * contain the composition, and a first version of this test passed exactly that case.
 */
const SK_SENTENCES = [
	SK.title,
	SK.onOrder,
	SK.outOfStock,
	"Ponuku sa teraz nepodarilo načítať.",
	"Skúste to prosím o chvíľu",
	"nie je to informácia o tom, že na vaše vozidlo nič nepasuje.",
	"Pre toto vozidlo zatiaľ nemáme overenú zostavu.",
	"Nejaké záznamy existujú, ale zatiaľ nie sú overené.",
	"Neznamená to, že naň nič nepasuje — napíšte nám a overíme to.",
	"Testovacia ukážka.",
	"Ide o simulované údaje, nie o skutočnú ponuku ani o overenú kompatibilitu.",
	SK.partial,
	SK.price,
	"zostáv",
];

describe("Slovakia renders exactly the copy it rendered before", () => {
	it("an offer list: heading, count, price, availability", async () => {
		const rendered = await text(SEVEN, "sk-SK");
		expect(rendered).toContain(`|${SK.title}|`);
		expect(rendered).toContain(`|${SK.count7}|`);
		expect(rendered).toContain(`|${SK.price}|`);
		expect(rendered).toContain(`|${SK.onOrder}|`);
		expect(rendered).toContain(`|${SK.outOfStock}|`);
	});

	it("the count keeps its old, uninflected form for every number", async () => {
		// "2 zostáv" is what the live page prints. Inflecting it is a copy change, not a
		// localization one, and it is not this change's to make.
		for (const n of [1, 2, 5]) {
			const value = offers({ offers: Array.from({ length: n }, (_, i) => offer(i)), compatibleCount: n });
			expect(await text(value, "sk-SK")).toContain(`|${n} zostáv|`);
		}
	});

	it("nothing verified, but records exist", async () => {
		expect(await text(offers({ compatibleCount: 3 }), "sk-SK")).toContain(`|${SK.unverified}|`);
	});

	it("nothing verified, no records", async () => {
		expect(await text(offers(), "sk-SK")).toContain(`|${SK.askUs}|`);
	});

	it("the catalogue did not answer", async () => {
		expect(await text(offers({ lookupFailed: true }), "sk-SK")).toContain(`|${SK.lookupFailed}|`);
	});

	it("demo and partial notices", async () => {
		const rendered = await text({ ...SEVEN, isDemo: true, lookupFailed: true }, "sk-SK");
		expect(rendered).toContain(`|${SK.demo}|`);
		expect(rendered).toContain(`|${SK.partial}|`);
	});
});

const FOREIGN = [
	"cs-CZ",
	"de-DE",
	"de-AT",
	"pl-PL",
	"hu-HU",
	"it-IT",
	"fr-FR",
	"es-ES",
	"ro-RO",
	"en-US",
	"en-CA",
];

describe("no other market renders a Slovak sentence", () => {
	for (const locale of FOREIGN) {
		it(locale, async () => {
			const rendered = [
				await text({ ...SEVEN, isDemo: true, lookupFailed: true }, locale),
				await text(offers({ compatibleCount: 3 }), locale),
				await text(offers(), locale),
				await text(offers({ lookupFailed: true }), locale),
			].join("\n");

			const own = load(locale);
			for (const sentence of SK_SENTENCES) {
				// "Na objednávku" is also correct Czech, and cs-CZ says so in its own file; a
				// string that IS the market's translation is not a leak. Prices are formatted
				// per market, so the SK price string cannot appear either.
				if (sentence === own.common.onOrder) continue;
				expect(rendered).not.toContain(sentence);
			}
			// The heading is the configurator's, already translated in every file.
			expect(rendered).toContain(`|${load(locale).configurator.resultsTitle}|`);
		});
	}

	it("inflects the count where the language does", async () => {
		const three = offers({ offers: Array.from({ length: 3 }, (_, i) => offer(i)), compatibleCount: 3 });
		expect(await text(three, "cs-CZ")).toContain("|3 sestavy|");
		expect(await text(SEVEN, "cs-CZ")).toContain("|7 sestav|");
		expect(await text(three, "pl-PL")).toContain("|3 zestawy|");
		expect(await text(SEVEN, "de-DE")).toContain("|7 Sets|");
	});
});

describe("catalog-only availability", () => {
	for (const locale of ["sk-SK", ...FOREIGN]) {
		it(`${locale} shows the localized unavailable notice, never the on-order promise`, async () => {
			const rendered = await text(
				offers({
					offers: [offer(0, { isPurchasable: false, availability: "on-demand" })],
					compatibleCount: 1,
					purchasableCount: 0,
				}),
				locale,
			);
			const own = load(locale);

			expect(rendered).toContain(`|${own.cart.addUnavailable}|`);
			expect(rendered).not.toContain(`|${own.common.onOrder}|`);
		});
	}
});

describe("formatOfferPrice", () => {
	it("keeps the Slovak string byte for byte", () => {
		expect(formatOfferPrice(72, "EUR", "sk-SK")).toBe("72.00 EUR");
		expect(formatOfferPrice(1234.5, "EUR", "sk-SK")).toBe("1234.50 EUR");
	});

	it("uses the market's own format elsewhere", () => {
		expect(formatOfferPrice(72, "CZK", "cs-CZ")).toBe(
			new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(72),
		);
		expect(formatOfferPrice(12990, "HUF", "hu-HU")).not.toContain(".00");
		expect(formatOfferPrice(189.99, "USD", "en-US")).toBe("$189.99");
	});
});
