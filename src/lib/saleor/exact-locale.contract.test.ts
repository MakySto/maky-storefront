import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LOCALE_MAP, getLocaleFromChannel } from "@/config/locale";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import {
	resolveExactLocaleCategory,
	resolveExactLocaleCollection,
	resolveExactLocaleMenu,
	resolveExactLocaleProduct,
} from "./exact-locale";

/**
 * The exact-locale field contract, published for CFM (COMMERCE-2 M3) and held to the code.
 *
 * `docs/contracts/commerce2/exact-locale-contract.json` is what CFM reads to know which fields
 * a translation must carry. This file makes sure the document never says something the
 * resolver does not do: every required field is deleted in turn and must make the resource
 * disappear; every optional one is deleted and must not — and must fall back only to
 * translated copy, never to the Slovak row.
 *
 * The second half runs CFM's read-back through the same resolver. The committed sample is
 * synthetic and always runs; the real read-back after hidden APPLY runs with
 *
 *     MAKY_L10N_READBACK_PATH=<file> node_modules/.bin/vitest run src/lib/saleor/exact-locale.contract.test.ts
 */

const ROOT = join(__dirname, "../../..");
const CONTRACT = JSON.parse(
	readFileSync(join(ROOT, "docs/contracts/commerce2/exact-locale-contract.json"), "utf8"),
) as {
	sourceLocale: string;
	editorialLanguageByMarket: Record<string, string>;
	resources: Record<
		string,
		{ requiredTranslationFields: string[]; optionalTranslationFields?: Record<string, string> }
	>;
};

const SK = '{"blocks":[{"type":"paragraph","data":{"text":"SK"}}]}';

function product(language: string) {
	return {
		id: "UHJvZHVjdDox",
		name: "Slovenský názov",
		slug: "slovensky-slug",
		description: SK,
		seoTitle: "Slovenský SEO titulok",
		seoDescription: "Slovenský SEO popis",
		translation: {
			name: `name ${language}`,
			slug: null as string | null,
			description: `{"blocks":[{"type":"paragraph","data":{"text":"${language}"}}]}`,
			seoTitle: `seoTitle ${language}` as string | null,
			seoDescription: `seoDescription ${language}`,
		} as Record<string, string | null> | null,
		category: {
			name: "Nordrive strešné nosiče",
			slug: "nordrive-stresne-nosice",
			translation: { name: `category ${language}`, slug: null } as {
				name: string | null;
				slug: string | null;
			} | null,
		},
		attributes: [
			{
				attribute: {
					name: "Nosnosť",
					slug: "nosnost",
					translation: { name: `attribute ${language}` } as { name: string | null } | null,
				},
				values: [{ name: "75", translation: { name: "75" } as { name: string | null } | null }],
			},
		],
		variants: [{ selectionAttributes: [], nonSelectionAttributes: [] }],
	};
}

function taxonomy(language: string) {
	return {
		name: "Strešné nosiče",
		slug: "stresne-nosice",
		description: SK,
		seoTitle: "SK",
		seoDescription: "SK",
		translation: {
			name: `name ${language}`,
			slug: null as string | null,
			description: `{"blocks":[]}`,
			seoTitle: `seoTitle ${language}`,
			seoDescription: `seoDescription ${language}`,
		} as Record<string, string | null>,
	};
}

/** Every foreign market, with the locale its storefront renders in. */
const FOREIGN = Object.entries(CHANNEL_MAP)
	.filter(([market]) => market !== "sk")
	.map(([market, config]) => ({ market, locale: config.locale }));

describe("the published contract says what the resolver does", () => {
	it("names every market's editorial language exactly as the queries ask for it", () => {
		for (const [market, config] of Object.entries(CHANNEL_MAP)) {
			const published = CONTRACT.editorialLanguageByMarket[market];
			if (market === "sk") {
				expect(published).toMatch(/^SK/);
				continue;
			}
			expect(published, market).toBe(LOCALE_MAP[config.locale]!.graphqlLanguageCode);
		}
		expect(CONTRACT.sourceLocale).toBe("sk-SK");
	});

	for (const { market, locale } of FOREIGN) {
		it(`${market}: a complete product passes, in its own language only`, () => {
			const resolved = resolveExactLocaleProduct(product(market), locale);
			expect(resolved?.name).toBe(`name ${market}`);
			expect(resolved?.category?.name).toBe(`category ${market}`);
			expect(JSON.stringify(resolved)).not.toContain("Slovensk");
		});
	}

	it("refuses the product when any REQUIRED product field is missing, and only those", () => {
		const { requiredTranslationFields, optionalTranslationFields } = CONTRACT.resources.product!;
		const enforced: string[] = [];
		for (const field of ["name", "slug", "description", "seoTitle", "seoDescription"]) {
			const candidate = product("cz");
			candidate.translation![field] = null;
			if (resolveExactLocaleProduct(candidate, "cs-CZ") === null) enforced.push(field);
		}
		expect(enforced.sort()).toEqual([...requiredTranslationFields].sort());
		expect(Object.keys(optionalTranslationFields ?? {}).sort()).toEqual(["seoTitle", "slug"]);
	});

	it("falls back to the TRANSLATED name for a missing seoTitle, never the Slovak one", () => {
		const candidate = product("de");
		candidate.translation!.seoTitle = null;
		expect(resolveExactLocaleProduct(candidate, "de-AT")?.seoTitle).toBe("name de");
	});

	it("keeps the base slug when no translated slug exists, and uses one when it does", () => {
		expect(resolveExactLocaleProduct(product("pl"), "pl-PL")?.slug).toBe("slovensky-slug");
		const translated = product("pl");
		translated.translation!.slug = "polski-slug";
		expect(resolveExactLocaleProduct(translated, "pl-PL")?.slug).toBe("polski-slug");
	});

	it("refuses a fully translated product whose CATEGORY has no translation (the CFM taxonomy pack)", () => {
		for (const { market, locale } of FOREIGN) {
			const candidate = product(market);
			candidate.category.translation = null;
			expect(resolveExactLocaleProduct(candidate, locale), market).toBeNull();

			const blank = product(market);
			blank.category.translation = { name: " ", slug: null };
			expect(resolveExactLocaleProduct(blank, locale), market).toBeNull();
		}
	});

	it("refuses the product when an attribute or one of its values has no translated name", () => {
		const noAttribute = product("hu");
		noAttribute.attributes[0]!.attribute.translation = null;
		expect(resolveExactLocaleProduct(noAttribute, "hu-HU")).toBeNull();

		const noValue = product("hu");
		noValue.attributes[0]!.values[0]!.translation = null;
		expect(resolveExactLocaleProduct(noValue, "hu-HU")).toBeNull();
	});

	it("serves the Slovak base row untouched in Slovakia", () => {
		const candidate = product("sk");
		candidate.translation = null;
		expect(resolveExactLocaleProduct(candidate, "sk-SK")?.name).toBe("Slovenský názov");
	});

	for (const [resource, resolve] of [
		["category", resolveExactLocaleCategory],
		["collection", resolveExactLocaleCollection],
	] as const) {
		it(`${resource}: refuses the page when any REQUIRED field is missing, and only those`, () => {
			const enforced: string[] = [];
			for (const field of ["name", "slug", "description", "seoTitle", "seoDescription"]) {
				const candidate = taxonomy("cz");
				candidate.translation[field] = null;
				if (resolve(candidate, "cs-CZ") === null) enforced.push(field);
			}
			expect(enforced.sort()).toEqual([...CONTRACT.resources[resource]!.requiredTranslationFields].sort());
		});
	}

	it("menu item: hidden without its own translated name or its linked category's", () => {
		const item = {
			name: "Strešné nosiče",
			translation: { name: "Střešní nosiče" } as { name: string | null } | null,
			category: { name: "Strešné nosiče", slug: "stresne-nosice", translation: { name: "Střešní nosiče" } },
			collection: null,
			page: null,
			children: [],
		};
		expect(resolveExactLocaleMenu([item], "cs-CZ")).toHaveLength(1);
		expect(resolveExactLocaleMenu([{ ...item, translation: null }], "cs-CZ")).toHaveLength(0);
		expect(
			resolveExactLocaleMenu(
				[{ ...item, category: { ...item.category, translation: { name: "" } } }],
				"cs-CZ",
			),
		).toHaveLength(0);
		expect(CONTRACT.resources.menuItem!.requiredTranslationFields).toEqual(["name"]);
	});
});

// ---------------------------------------------------------------------------------------------
// CFM read-back → resolver
// ---------------------------------------------------------------------------------------------

type ReadbackEntry = {
	channel: string;
	languageCode: string;
	product?: Parameters<typeof resolveExactLocaleProduct>[0] & {
		variants?: { id?: string; pricing?: { price?: { gross?: { amount: number; currency: string } } } }[];
	};
	category?: Parameters<typeof resolveExactLocaleCategory>[0];
};

type Readback = { schema: string; entries: ReadbackEntry[] };

/** Everything wrong with one read-back, as readable lines; empty means it passes. */
function readbackProblems(readback: Readback): string[] {
	const problems: string[] = [];
	if (readback.schema !== "maky.commerce2.l10n-readback/1")
		problems.push(`unexpected schema ${readback.schema}`);

	for (const [index, entry] of readback.entries.entries()) {
		const at = `#${index} ${entry.channel}`;
		const market = REVERSE_MAP[entry.channel];
		if (!market) {
			problems.push(`${at}: not a channel this storefront serves`);
			continue;
		}
		const locale = getLocaleFromChannel(entry.channel);
		const expectedLanguage = LOCALE_MAP[locale]!.graphqlLanguageCode;
		if (market !== "sk" && entry.languageCode !== expectedLanguage) {
			problems.push(`${at}: read in ${entry.languageCode}, but ${locale} asks for ${expectedLanguage}`);
		}

		if (entry.product) {
			const resolved = resolveExactLocaleProduct(entry.product, locale);
			if (!resolved)
				problems.push(`${at}: product ${entry.product.slug} refused by the exact-locale boundary`);
			for (const variant of entry.product.variants ?? []) {
				const currency = variant.pricing?.price?.gross?.currency;
				if (currency !== CHANNEL_MAP[market]!.currency) {
					problems.push(
						`${at}: variant ${variant.id} priced in ${currency}, channel is ${CHANNEL_MAP[market]!.currency}`,
					);
				}
			}
		}
		if (entry.category && !resolveExactLocaleCategory(entry.category, locale)) {
			problems.push(`${at}: category ${entry.category.slug} refused by the exact-locale boundary`);
		}
	}
	return problems;
}

describe("a CFM read-back, through the storefront's own resolver", () => {
	const sample = JSON.parse(
		readFileSync(join(ROOT, "docs/contracts/commerce2/l10n-readback.sample.json"), "utf8"),
	) as Readback;

	it("passes the committed sample: products, a category, prices per channel", () => {
		expect(readbackProblems(sample)).toEqual([]);
	});

	it("keeps AT and DE on their own prices although both read the one DE translation", () => {
		const price = (channel: string) =>
			sample.entries.find((entry) => entry.channel === channel)?.product?.variants?.[0]?.pricing?.price
				?.gross;
		expect(price("at-eur")).toEqual({ amount: 262.99, currency: "EUR" });
		expect(price("de-eur")).toEqual({ amount: 259.99, currency: "EUR" });
	});

	it("catches the failures CFM must not ship", () => {
		const broken = structuredClone(sample);
		broken.entries[0]!.product!.category!.translation = null;
		broken.entries[1]!.languageCode = "DE_AT";
		broken.entries[2]!.product!.variants![0]!.pricing!.price!.gross!.currency = "EUR";
		broken.entries[3]!.category!.translation!.seoTitle = null;

		expect(readbackProblems(broken)).toEqual([
			"#0 at-eur: product stresny-nosic-testovaci-set refused by the exact-locale boundary",
			"#1 de-eur: read in DE_AT, but de-DE asks for DE",
			"#2 us-usd: variant UHJvZHVjdFZhcmlhbnQ6OTk5OTk5 priced in EUR, channel is USD",
			"#3 cz-czk: category stresne-nosice refused by the exact-locale boundary",
		]);
	});

	const READBACK = process.env.MAKY_L10N_READBACK_PATH?.trim();
	describe.skipIf(!READBACK || !existsSync(READBACK))("the real read-back (MAKY_L10N_READBACK_PATH)", () => {
		it("every entry passes", () => {
			const readback = JSON.parse(readFileSync(READBACK!, "utf8")) as Readback;
			expect(readback.entries.length).toBeGreaterThan(0);
			expect(readbackProblems(readback)).toEqual([]);
		});
	});
});
