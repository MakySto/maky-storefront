import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LOCALE_MAP, getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { LanguageCodeEnum } from "@/gql/graphql";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import {
	PRODUCT_TRANSLATION_REQUIRED_FIELDS,
	TRANSLATED_SLUG_PATTERN,
	resolveExactLocaleCategory,
	resolveExactLocaleCollection,
	resolveExactLocaleMenu,
	resolveExactLocaleProduct,
} from "./exact-locale";

/**
 * The exact-locale field contract, published for CFM (COMMERCE-2) and held to the code.
 *
 * `docs/contracts/commerce2/exact-locale-contract.json` is the ONE statement of which
 * language code each market reads and which fields a translation must carry; CFM vendors it
 * byte for byte. This file makes sure the document never says something the storefront does
 * not do: the market matrix is compared with `CHANNEL_MAP` + `LOCALE_MAP`, every required
 * field is deleted in turn and must make the resource disappear, and the read-back checker
 * CFM runs is the same resolver the pages run.
 *
 * The second half runs CFM's read-back through that resolver. The committed sample is
 * synthetic and always runs; the real read-back after APPLY runs with
 *
 *     MAKY_L10N_READBACK_PATH=<file> node_modules/.bin/vitest run src/lib/saleor/exact-locale.contract.test.ts
 */

const ROOT = join(__dirname, "../../..");
const CONTRACT = JSON.parse(
	readFileSync(join(ROOT, "docs/contracts/commerce2/exact-locale-contract.json"), "utf8"),
) as {
	schema: string;
	sourceLocale: string;
	markets: Record<string, { channel: string; locale: string; languageCode: string | null }>;
	editorialLanguageByMarket: Record<string, string>;
	targetLanguageCodes: string[];
	sourceRenderLanguages: string[];
	regionalLanguageCodes: Record<string, { markets: string[]; seededFrom: string }>;
	notTargets: Record<string, string>;
	resources: Record<
		string,
		{
			requiredTranslationFields: string[];
			optionalTranslationFields?: Record<string, string>;
			slug?: { pattern: string };
		}
	>;
	readback: { schema: string };
};

const SALEOR_LANGUAGE_CODES = new Set<string>(Object.values(LanguageCodeEnum));
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
			slug: `slug-${language}` as string | null,
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

const languageOf = (market: string) =>
	getLocaleConfigByLocale(CHANNEL_MAP[market]!.locale).graphqlLanguageCode as string;

describe("the published market matrix is the one the queries use", () => {
	it("is contract v2", () => {
		expect(CONTRACT.schema).toBe("maky.commerce2.exact-locale-contract/2");
		expect(CONTRACT.sourceLocale).toBe("sk-SK");
	});

	it("lists every market with its channel, locale and language code exactly as the code has them", () => {
		expect(Object.keys(CONTRACT.markets).sort()).toEqual(Object.keys(CHANNEL_MAP).sort());
		for (const [market, config] of Object.entries(CHANNEL_MAP)) {
			const published = CONTRACT.markets[market]!;
			expect(published.channel, market).toBe(config.saleorSlug);
			expect(published.locale, market).toBe(config.locale);
			expect(published.languageCode, market).toBe(market === "sk" ? null : languageOf(market));
		}
	});

	it("keeps the v1 key editorialLanguageByMarket, in agreement with the matrix", () => {
		for (const market of Object.keys(CHANNEL_MAP)) {
			const published = CONTRACT.editorialLanguageByMarket[market];
			if (market === "sk") expect(published).toMatch(/^SK/);
			else expect(published, market).toBe(languageOf(market));
		}
	});

	it("reads DE_AT in Austria, EN_CA in Canada and plain EN in the United States", () => {
		expect(languageOf("at")).toBe("DE_AT");
		expect(languageOf("de")).toBe("DE");
		expect(languageOf("ca")).toBe("EN_CA");
		expect(languageOf("us")).toBe("EN");
	});

	it("has eleven distinct target codes — one per foreign market — all real Saleor enum values", () => {
		const codes = FOREIGN.map(({ market }) => languageOf(market));
		expect(new Set(codes).size).toBe(11);
		expect([...CONTRACT.targetLanguageCodes].sort()).toEqual([...codes].sort());
		for (const code of CONTRACT.targetLanguageCodes) expect(SALEOR_LANGUAGE_CODES.has(code), code).toBe(true);
		expect(CONTRACT.targetLanguageCodes).not.toContain("EN_US");
		expect(CONTRACT.targetLanguageCodes).not.toContain("SK");
		expect(Object.keys(CONTRACT.notTargets).sort()).toEqual(["EN_US", "SK"]);
	});

	it("seeds each regional code from a source render language, and renders nine of those", () => {
		expect(Object.keys(CONTRACT.regionalLanguageCodes).sort()).toEqual(["DE_AT", "EN_CA"]);
		expect(CONTRACT.regionalLanguageCodes.DE_AT).toMatchObject({ markets: ["at"], seededFrom: "DE" });
		expect(CONTRACT.regionalLanguageCodes.EN_CA).toMatchObject({ markets: ["ca"], seededFrom: "EN" });
		expect(CONTRACT.sourceRenderLanguages).toHaveLength(9);
		expect([...CONTRACT.sourceRenderLanguages].sort()).toEqual(
			CONTRACT.targetLanguageCodes.filter((code) => !(code in CONTRACT.regionalLanguageCodes)).sort(),
		);
		for (const [code, regional] of Object.entries(CONTRACT.regionalLanguageCodes)) {
			expect(CONTRACT.sourceRenderLanguages, code).toContain(regional.seededFrom);
			for (const market of regional.markets) expect(languageOf(market), market).toBe(code);
		}
	});
});

describe("the published product contract says what the resolver does", () => {
	for (const { market, locale } of FOREIGN) {
		it(`${market}: a complete product passes, in its own language only`, () => {
			const resolved = resolveExactLocaleProduct(product(market), locale);
			expect(resolved?.name).toBe(`name ${market}`);
			expect(resolved?.slug).toBe(`slug-${market}`);
			expect(resolved?.seoTitle).toBe(`seoTitle ${market}`);
			expect(resolved?.category?.name).toBe(`category ${market}`);
			expect(JSON.stringify(resolved)).not.toContain("Slovensk");
		});
	}

	it("requires exactly name, description, seoTitle, seoDescription and slug — nothing is optional", () => {
		const { requiredTranslationFields, optionalTranslationFields } = CONTRACT.resources.product!;
		expect([...requiredTranslationFields].sort()).toEqual([...PRODUCT_TRANSLATION_REQUIRED_FIELDS].sort());
		expect(optionalTranslationFields ?? {}).toEqual({});

		for (const { market, locale } of FOREIGN) {
			const enforced: string[] = [];
			for (const field of ["name", "slug", "description", "seoTitle", "seoDescription"]) {
				for (const missing of [null, "", "   "]) {
					const candidate = product(market);
					candidate.translation![field] = missing;
					if (resolveExactLocaleProduct(candidate, locale) === null) enforced.push(`${field}:${missing}`);
				}
			}
			expect(enforced.length, market).toBe(15);
		}
	});

	it("never fills a missing seoTitle or slug — from the translated name, the base row or anywhere", () => {
		// v1 fell back to the translated name and the base slug. Product:9164 had exactly that
		// shape in DE on 2026-09-18 (post-bulk, pre-slug): name, description and seoDescription
		// written, slug null, seoTitle "". Under v2 it does not exist in Germany yet.
		const post_bulk_pre_slug = product("de");
		post_bulk_pre_slug.translation!.slug = null;
		post_bulk_pre_slug.translation!.seoTitle = "";
		expect(resolveExactLocaleProduct(post_bulk_pre_slug, "de-DE")).toBeNull();
	});

	it("takes the slug only in the published URL-segment form", () => {
		const pattern = CONTRACT.resources.product!.slug!.pattern;
		expect(pattern).toBe(TRANSLATED_SLUG_PATTERN.source);

		const accepted = [
			"dachtrager-nordrive-helio-black-alfa-romeo-156-crosswagon-20042007-offene-dachreling-cfmp-b-nor-9fbd74569243be-000000",
			"roof-rack-test-set",
			"a1",
		];
		const refused = [
			"Dachtraeger",
			"dach träger",
			"dach/traeger",
			"dach--traeger",
			"-dach",
			"dach-",
			"dachträger",
			"a?b",
		];
		for (const slug of accepted) {
			const candidate = product("de");
			candidate.translation!.slug = slug;
			expect(resolveExactLocaleProduct(candidate, "de-DE")?.slug, slug).toBe(slug);
		}
		for (const slug of refused) {
			const candidate = product("de");
			candidate.translation!.slug = slug;
			expect(resolveExactLocaleProduct(candidate, "de-DE"), slug).toBeNull();
		}
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

	it("serves the Slovak base row untouched in Slovakia, and never a translation row there", () => {
		const bare = product("sk");
		bare.translation = null;
		expect(resolveExactLocaleProduct(bare, "sk-SK")?.name).toBe("Slovenský názov");

		const withRow = product("sk");
		const resolved = resolveExactLocaleProduct(withRow, "sk-SK");
		expect(resolved?.name).toBe("Slovenský názov");
		expect(resolved?.slug).toBe("slovensky-slug");
		expect(resolved?.seoTitle).toBe("Slovenský SEO titulok");
	});

	for (const [resource, resolve] of [
		["category", resolveExactLocaleCategory],
		["collection", resolveExactLocaleCollection],
	] as const) {
		it(`${resource}: refuses the page when any REQUIRED field is missing, and only those (unchanged in v2)`, () => {
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
	if (readback.schema !== CONTRACT.readback.schema) problems.push(`unexpected schema ${readback.schema}`);

	for (const [index, entry] of readback.entries.entries()) {
		const at = `#${index} ${entry.channel}`;
		const market = REVERSE_MAP[entry.channel];
		if (!market) {
			problems.push(`${at}: not a channel this storefront serves`);
			continue;
		}
		const locale = getLocaleFromChannel(entry.channel);
		const expectedLanguage = LOCALE_MAP[locale]!.graphqlLanguageCode;
		if (market !== "sk" && !CONTRACT.targetLanguageCodes.includes(entry.languageCode)) {
			problems.push(`${at}: ${entry.languageCode} is not a COMMERCE-2 target code`);
		} else if (market !== "sk" && entry.languageCode !== expectedLanguage) {
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
	const entry = (channel: string, kind: "product" | "category") =>
		sample.entries.findIndex((candidate) => candidate.channel === channel && candidate[kind]);

	it("passes the committed sample: AT in DE_AT, CA in EN_CA, US in EN, categories, prices per channel", () => {
		expect(readbackProblems(sample)).toEqual([]);
		const codes = sample.entries.map((candidate) => `${candidate.channel}:${candidate.languageCode}`);
		expect(codes).toEqual(expect.arrayContaining(["at-eur:DE_AT", "de-eur:DE", "us-usd:EN", "ca-cad:EN_CA"]));
	});

	it("keeps AT and DE on their own prices and their own rows, although DE_AT was seeded from DE", () => {
		const at = sample.entries[entry("at-eur", "product")]!.product!;
		const de = sample.entries[entry("de-eur", "product")]!.product!;
		expect(at.variants?.[0]?.pricing?.price?.gross).toEqual({ amount: 262.99, currency: "EUR" });
		expect(de.variants?.[0]?.pricing?.price?.gross).toEqual({ amount: 259.99, currency: "EUR" });

		// A regional edit (the AT seoTitle) is rendered as written, and it is Austria's alone.
		expect(at.translation?.seoTitle).not.toBe(de.translation?.seoTitle);
		expect(resolveExactLocaleProduct(at, "de-AT")?.seoTitle).toBe(at.translation?.seoTitle);
		expect(resolveExactLocaleProduct(de, "de-DE")?.seoTitle).toBe(de.translation?.seoTitle);
	});

	it("catches the failures CFM must not ship", () => {
		const broken = structuredClone(sample);
		const atProduct = entry("at-eur", "product");
		const deProduct = entry("de-eur", "product");
		const usProduct = entry("us-usd", "product");
		const caProduct = entry("ca-cad", "product");
		const czCategory = entry("cz-czk", "category");
		const atCategory = entry("at-eur", "category");

		broken.entries[atProduct]!.product!.category!.translation = null;
		broken.entries[deProduct]!.languageCode = "DE_AT";
		broken.entries[usProduct]!.product!.variants![0]!.pricing!.price!.gross!.currency = "EUR";
		broken.entries[caProduct]!.languageCode = "EN";
		broken.entries[czCategory]!.category!.translation!.seoTitle = null;
		broken.entries[atCategory]!.languageCode = "DE";

		expect(readbackProblems(broken)).toEqual([
			`#${atProduct} at-eur: product stresny-nosic-testovaci-set refused by the exact-locale boundary`,
			`#${deProduct} de-eur: read in DE_AT, but de-DE asks for DE`,
			`#${usProduct} us-usd: variant UHJvZHVjdFZhcmlhbnQ6OTk5OTk5 priced in EUR, channel is USD`,
			`#${caProduct} ca-cad: read in EN, but en-CA asks for EN_CA`,
			`#${czCategory} cz-czk: category stresne-nosice refused by the exact-locale boundary`,
			`#${atCategory} at-eur: read in DE, but de-AT asks for DE_AT`,
		]);
	});

	it("refuses a code outside the matrix, and a product missing its seoTitle or slug", () => {
		const broken = structuredClone(sample);
		const usProduct = entry("us-usd", "product");
		const deProduct = entry("de-eur", "product");
		const caProduct = entry("ca-cad", "product");
		broken.entries[usProduct]!.languageCode = "EN_US";
		broken.entries[deProduct]!.product!.translation!.slug = null;
		broken.entries[caProduct]!.product!.translation!.seoTitle = "";

		expect(readbackProblems(broken)).toEqual([
			`#${deProduct} de-eur: product stresny-nosic-testovaci-set refused by the exact-locale boundary`,
			`#${usProduct} us-usd: EN_US is not a COMMERCE-2 target code`,
			`#${caProduct} ca-cad: product stresny-nosic-testovaci-set refused by the exact-locale boundary`,
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
