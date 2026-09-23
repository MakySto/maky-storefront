import {
	Kind,
	parse,
	type FieldNode,
	type FragmentDefinitionNode,
	type OperationDefinitionNode,
	type SelectionSetNode,
	type ValueNode,
} from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDetailsDocument } from "@/gql/graphql";
import { resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";

/**
 * Parity: the one-request presence answer must say exactly what the page's own lookup would
 * say about the same Saleor data, market by market.
 *
 * Neither side is mocked at the level of its answer. A small executor PROJECTS a Saleor-side
 * record through whichever document is sent — the real codegen `ProductDetails` for today 's
 * path, the real presence document for the new one — honouring aliases, fragments,
 * `translation(languageCode:)` and `attributes(variantSelection:)`. So a field the presence
 * document forgets to select is simply absent from its answer, exactly as it would be from
 * Saleor 's, and the comparison fails. Both answers then go through the real
 * `resolveExactLocaleProduct`.
 */

type Translations = Record<string, Record<string, string>>;
type Named = {
	name: string;
	slug?: string;
	value?: string;
	externalReference?: string;
	inputType?: string;
	translations: Translations;
};
type Attribute = { attribute: Named; values: Named[] };
type SaleorProduct = Named & {
	id: string;
	slug: string;
	description: string;
	seoTitle: string;
	seoDescription: string;
	isAvailableForPurchase: boolean;
	category: (Named & { id: string }) | null;
	attributes: Attribute[];
	variants: {
		id: string;
		name: string;
		sku: string;
		selectionAttributes: Attribute[];
		nonSelectionAttributes: Attribute[];
	}[];
	channels: string[];
};

function execute(source: string, variables: Record<string, unknown>, catalogue: readonly SaleorProduct[]) {
	const doc = parse(source);
	const fragments = new Map(
		doc.definitions
			.filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION)
			.map((d) => [d.name.value, d]),
	);
	const value = (node: ValueNode): unknown =>
		node.kind === Kind.VARIABLE
			? variables[node.name.value]
			: node.kind === Kind.NULL
				? null
				: "value" in node
					? node.value
					: undefined;
	const arg = (field: FieldNode, name: string) => {
		const found = field.arguments?.find((a) => a.name.value === name);
		return found ? value(found.value) : undefined;
	};
	const resolve = (source: Record<string, unknown>, field: FieldNode): unknown => {
		const name = field.name.value;
		let raw: unknown;
		if (name === "translation")
			raw = (source.translations as Translations | undefined)?.[String(arg(field, "languageCode"))] ?? null;
		else if (name === "attributes" && arg(field, "variantSelection") === "VARIANT_SELECTION")
			raw = source.selectionAttributes;
		else if (name === "attributes" && arg(field, "variantSelection") === "NOT_VARIANT_SELECTION")
			raw = source.nonSelectionAttributes;
		else raw = source[name] ?? null;
		return field.selectionSet ? project(raw, field.selectionSet) : raw;
	};
	const project = (raw: unknown, set: SelectionSetNode): unknown => {
		if (raw == null) return null;
		if (Array.isArray(raw)) return raw.map((item) => project(item, set));
		const out: Record<string, unknown> = {};
		for (const selection of set.selections) {
			if (selection.kind === Kind.FRAGMENT_SPREAD)
				Object.assign(out, project(raw, fragments.get(selection.name.value)!.selectionSet));
			if (selection.kind === Kind.FIELD)
				out[selection.alias?.value ?? selection.name.value] = resolve(
					raw as Record<string, unknown>,
					selection,
				);
		}
		return out;
	};
	const operation = doc.definitions.find(
		(d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
	)!;
	const data: Record<string, unknown> = {};
	for (const selection of operation.selectionSet.selections as readonly FieldNode[]) {
		const channel = arg(selection, "channel");
		const id = arg(selection, "id");
		const slug = arg(selection, "slug");
		const slugLang = arg(selection, "slugLanguageCode") as string | null | undefined;
		const product = catalogue.find(
			(p) =>
				p.channels.includes(String(channel)) &&
				(id !== undefined
					? p.id === id
					: slugLang
						? p.translations[slugLang]?.slug === slug
						: p.slug === slug),
		);
		data[selection.alias?.value ?? selection.name.value] = product
			? project(product, selection.selectionSet!)
			: null;
	}
	return data;
}

let catalogue: SaleorProduct[];
let sent: { query: string; options: Record<string, unknown> }[];
let fault: null | "http" | "partial" | "missing-alias";
const tags: string[] = [];

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (
		document: { toString(): string },
		options: { variables: Record<string, unknown> },
	) => {
		sent.push({ query: document.toString(), options });
		if (fault === "http")
			return { ok: false, error: { type: "http", statusCode: 503, message: "HTTP 503", isRetryable: true } };
		// What `executePublicGraphQL` makes of a response carrying `errors` next to `data`.
		if (fault === "partial")
			return {
				ok: false,
				error: { type: "graphql", message: "injected partial failure", isRetryable: false },
			};
		const data = execute(document.toString(), options.variables, catalogue);
		if (fault === "missing-alias") delete data.de;
		return { ok: true, data };
	},
}));
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: (...added: string[]) => tags.push(...added),
}));

const ID = "UHJvZHVjdDo5NjU3";
const BASE = "stresny-nosic-nordrive-silenzio-cx-black-volvo-xc90";
const MARKETS = ["sk", "cz", "de", "at", "hu", "ca"] as const;
const CHANNELS = ["sk-eur", "cz-czk", "de-eur", "at-eur", "hu-huf", "ca-cad"];
const LANGS = ["CS", "DE", "DE_AT", "HU", "EN_CA"];

const translated = (base: string): Translations =>
	Object.fromEntries(LANGS.map((lang) => [lang, { name: `${base} ${lang}` }]));
const named = (name: string, slug: string): Named => ({ name, slug, translations: translated(name) });
const attribute = (slug: string): Attribute => ({
	attribute: {
		...named(`Attr ${slug}`, slug),
		externalReference: `cfm:attribute:${slug}`,
		inputType: "DROPDOWN",
	},
	values: [{ ...named(`Value ${slug}`, `${slug}-v`), value: "v" }],
});

/** Published in all six channels and complete in every language — the ordinary Nordrive case. */
function complete(): SaleorProduct {
	return {
		id: ID,
		name: "Strešný nosič Nordrive Silenzio CX",
		slug: BASE,
		description: "{}",
		seoTitle: "Strešný nosič Nordrive Silenzio CX",
		seoDescription: "Strešný nosič na Volvo XC90.",
		isAvailableForPurchase: true,
		translations: Object.fromEntries(
			LANGS.map((lang) => [
				lang,
				{
					name: `Nosič ${lang}`,
					slug: `nosic-${lang.toLowerCase().replace("_", "-")}-cfmp-9657`,
					description: "{}",
					seoTitle: `Nosič ${lang}`,
					seoDescription: `Popis ${lang}`,
				},
			]),
		),
		category: { id: "Q2F0ZWdvcnk6MQ==", ...named("Nordrive strešné nosiče", "nordrive-stresne-nosice") },
		attributes: [attribute("max-load")],
		variants: [
			{
				id: "UHJvZHVjdFZhcmlhbnQ6MQ==",
				name: "Default",
				sku: "CFMP-9657",
				selectionAttributes: [attribute("color")],
				nonSelectionAttributes: [attribute("material")],
			},
		],
		channels: [...CHANNELS],
	};
}

/** Today's path for one market: `lookupBySlug` by the base slug, then the exact-locale check. */
async function todayDecision(market: (typeof MARKETS)[number]) {
	const { CHANNEL_MAP } = await import("@/lib/channel-map");
	const { getLocaleConfigByLocale } = await import("@/config/locale");
	const { isSourceLocale } = await import("@/lib/saleor/exact-locale");
	const { saleorSlug: channel, locale } = CHANNEL_MAP[market]!;
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const ask = (slugLang: string | null) =>
		execute(ProductDetailsDocument.toString(), { slug: BASE, channel, lang, slugLang }, catalogue)
			.product as never;
	let product = ask(null);
	if (!product && !isSourceLocale(locale)) product = ask(lang);
	const localized = resolveExactLocaleProduct(
		product as Parameters<typeof resolveExactLocaleProduct>[0],
		locale,
	);
	return localized?.slug ? { status: "found", slug: localized.slug } : { status: "not-found" };
}

async function presence() {
	const { getProductMarketPresence } = await import("./product-presence");
	return getProductMarketPresence(ID, BASE);
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("MAKY_LIVE_MARKETS", MARKETS.join(","));
	catalogue = [complete()];
	sent = [];
	fault = null;
	tags.length = 0;
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

const czech = () => catalogue[0]!.translations.CS!;
const CASES: [string, () => void, readonly string[]][] = [
	["complete in every language", () => {}, []],
	["missing seoDescription", () => void (czech().seoDescription = ""), ["cz"]],
	["whitespace-only seoTitle", () => void (czech().seoTitle = "   "), ["cz"]],
	["missing category translation", () => void delete catalogue[0]!.category!.translations.CS, ["cz"]],
	[
		"missing attribute translation",
		() => void (catalogue[0]!.attributes[0]!.attribute.translations.CS!.name = ""),
		["cz"],
	],
	[
		"missing attribute VALUE translation",
		() => void delete catalogue[0]!.attributes[0]!.values[0]!.translations.CS,
		["cz"],
	],
	[
		"missing variant selection-attribute value translation",
		() => void delete catalogue[0]!.variants[0]!.selectionAttributes[0]!.values[0]!.translations.DE_AT,
		["at"],
	],
	[
		"missing variant non-selection-attribute translation",
		() => void delete catalogue[0]!.variants[0]!.nonSelectionAttributes[0]!.attribute.translations.EN_CA,
		["ca"],
	],
	["invalid translated slug", () => void (czech().slug = "Stresni Nosic Nordrive"), ["cz"]],
	["no translation row at all", () => void delete catalogue[0]!.translations.HU, ["hu"]],
	[
		"not published in the channel",
		() => void (catalogue[0]!.channels = CHANNELS.filter((c) => c !== "de-eur")),
		["de"],
	],
	[
		"not purchasable (unsellable) — still exists, as today",
		() => void (catalogue[0]!.isAvailableForPurchase = false),
		[],
	],
];

describe("presence parity with the page's own lookup", () => {
	for (const [name, mutate, absentIn] of CASES) {
		it(name, async () => {
			mutate();
			const outcome = await presence();
			expect(outcome.status).toBe("found");
			if (outcome.status !== "found") return;

			for (const market of MARKETS) {
				expect(outcome.resource[market], market).toEqual(await todayDecision(market));
			}
			// Not vacuous: the case really removes exactly the markets it names.
			const missing = MARKETS.filter((market) => outcome.resource[market]!.status === "not-found");
			expect(missing).toEqual(absentIn);
		});
	}

	it("returns each market at its own slug: base in Slovakia, the market language slug abroad", async () => {
		const outcome = await presence();
		expect(outcome).toMatchObject({
			status: "found",
			resource: {
				sk: { status: "found", slug: BASE },
				cz: { status: "found", slug: "nosic-cs-cfmp-9657" },
				at: { status: "found", slug: "nosic-de-at-cfmp-9657" },
				ca: { status: "found", slug: "nosic-en-ca-cfmp-9657" },
			},
		});
	});
});

describe("one request, by product id", () => {
	it("sends ONE query with one alias per live market, asked by id, once, under a deadline", async () => {
		await presence();
		expect(sent).toHaveLength(1);
		const { query, options } = sent[0]!;
		expect(query).toMatch(/^query ProductMarketPresence\(\$id: ID!\)/);
		for (const [index, market] of MARKETS.entries()) {
			expect(query).toContain(`${market}: product(id: $id, channel: "${CHANNELS[index]}")`);
		}
		expect(query).not.toContain("slugLanguageCode");
		expect(options).toMatchObject({ variables: { id: ID }, retry: false, revalidate: 0 });
		expect(options.signal).toBeInstanceOf(AbortSignal);
	});

	it("treats an alias that answers with ANOTHER product as absent, not as this product", async () => {
		const { readPresence } = await import("./product-presence");
		const other = { id: "UHJvZHVjdDox", name: "Iný", slug: "iny-produkt" };
		const outcome = readPresence({ ok: true, data: { sk: other } }, ID, ["sk"]);
		expect(outcome).toEqual({ status: "found", resource: { sk: { status: "not-found" } } });
	});

	it("tags the entry so the existing product, translation and category events reach it", async () => {
		catalogue[0]!.channels = CHANNELS.filter((c) => c !== "de-eur");
		await presence();
		for (const [index, market] of MARKETS.entries()) {
			const { CHANNEL_MAP } = await import("@/lib/channel-map");
			expect(tags).toContain(`product:${CHANNELS[index]}:${CHANNEL_MAP[market]!.locale}:${BASE}`);
		}
		expect(tags).toContain("product-miss:de-eur:de-DE");
		expect(tags.filter((tag) => tag.startsWith("product-miss:"))).toEqual(["product-miss:de-eur:de-DE"]);
		expect(tags).toContain("category:cz-czk:cs-CZ:nordrive-stresne-nosice");
		expect(tags).not.toContain("category:de-eur:de-DE:nordrive-stresne-nosice");
	});
});

describe("a fault is the whole map, and never a throw", () => {
	for (const kind of ["http", "partial", "missing-alias"] as const) {
		it(`${kind}: upstream-error, logged once`, async () => {
			fault = kind;
			const outcome = await presence();
			expect(outcome.status).toBe("upstream-error");
			const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
			expect(
				logged.filter((line) => line.includes("[upstream-error]") && line.includes("product-presence")),
			).toHaveLength(1);
		});
	}
});
