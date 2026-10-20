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

import { ProductListByCategoryDocument } from "@/gql/graphql";
import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import { resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";

/**
 * Parity: the one-request presence answer must say exactly what the category page's own lookup
 * would say about the same Saleor data, market by market.
 *
 * Neither side is mocked at the level of its answer. A small executor PROJECTS a Saleor-side
 * record through whichever document is sent — the real codegen `ProductListByCategory` for
 * today's path, the real presence document for the new one — honouring aliases, fragments,
 * `translation(languageCode:)` and `products(channel:)`. So a field the presence document forgets
 * to select is simply absent from its answer, exactly as it would be from Saleor's, and the
 * comparison fails. Both answers then go through the real `resolveExactLocaleCategory`.
 */

type Translation = {
	name?: string;
	slug?: string;
	description?: string;
	seoTitle?: string;
	seoDescription?: string;
};
type SaleorCategory = {
	name: string;
	slug: string;
	description: string | null;
	seoTitle: string | null;
	seoDescription: string | null;
	translations: Record<string, Translation>;
	/** Products per Saleor channel slug — categories are global, their products are not. */
	counts: Record<string, number>;
};

function execute(source: string, variables: Record<string, unknown>, catalogue: readonly SaleorCategory[]) {
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
			raw = (source.translations as Record<string, Translation> | undefined)?.[
				String(arg(field, "languageCode"))
			];
		else if (name === "products")
			raw = {
				totalCount: (source.counts as Record<string, number>)[String(arg(field, "channel"))] ?? 0,
				edges: [],
				pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
			};
		else raw = source[name] ?? null;
		return field.selectionSet ? project(raw ?? null, field.selectionSet) : raw ?? null;
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
		const slug = arg(selection, "slug");
		const slugLang = arg(selection, "slugLanguageCode") as string | null | undefined;
		const category = catalogue.find((c) =>
			slugLang ? c.translations[slugLang]?.slug === slug : c.slug === slug,
		);
		data[selection.alias?.value ?? selection.name.value] = category
			? project(category, selection.selectionSet!)
			: null;
	}
	return data;
}

let catalogue: SaleorCategory[];
let sent: { query: string; options: Record<string, unknown> }[];
let fault: null | "http" | "partial" | "missing-alias" | "starved";
const tags: string[] = [];
const lives: unknown[] = [];

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
		if (fault === "starved")
			return {
				ok: false,
				error: {
					type: "network",
					message: "CategoryMarketPresence: deadline exceeded",
					isRetryable: true,
					queueStarved: true,
				},
			};
		const data = execute(document.toString(), options.variables, catalogue);
		if (fault === "missing-alias") delete data.de;
		return { ok: true, data };
	},
}));
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: (profile: unknown) => void lives.push(profile),
	cacheTag: (...added: string[]) => tags.push(...added),
}));

const SLUG = "autochladnicky";
const MARKETS = ["sk", "cz", "de", "at", "hu", "ca"] as const;
const CHANNELS = ["sk-eur", "cz-czk", "de-eur", "at-eur", "hu-huf", "ca-cad"];
const LANGS = ["CS", "DE", "DE_AT", "HU", "EN_CA"];

/** Stocked in all six channels and translated in every language — the ordinary fridge category. */
function complete(): SaleorCategory {
	return {
		name: "Autochladničky",
		slug: SLUG,
		description: "{}",
		seoTitle: "Autochladničky",
		seoDescription: "Autochladničky do auta.",
		translations: Object.fromEntries(
			LANGS.map((lang) => [
				lang,
				{
					name: `Chladnička ${lang}`,
					slug: `chladnicka-${lang.toLowerCase().replace("_", "-")}`,
					description: "{}",
					seoTitle: `Chladnička ${lang}`,
					seoDescription: `Popis ${lang}`,
				},
			]),
		),
		counts: Object.fromEntries(CHANNELS.map((channel) => [channel, 7])),
	};
}

/** Today's path for one market: `lookupBySlug` by the base slug, then the exact-locale check and the count. */
async function todayDecision(market: (typeof MARKETS)[number]): Promise<boolean> {
	const { CHANNEL_MAP } = await import("@/lib/channel-map");
	const { getLocaleConfigByLocale } = await import("@/config/locale");
	const { isSourceLocale } = await import("@/lib/saleor/exact-locale");
	const { saleorSlug: channel, locale } = CHANNEL_MAP[market]!;
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const ask = (slugLang: string | null) =>
		(
			execute(
				ProductListByCategoryDocument.toString(),
				{ slug: SLUG, channel, lang, slugLang, first: 1 },
				catalogue,
			) as {
				category: Parameters<typeof resolveExactLocaleCategory>[0] & { products?: { totalCount: number } };
			}
		).category;
	let category = ask(null);
	if (!category && !isSourceLocale(locale)) category = ask(lang);
	const localized = resolveExactLocaleCategory(category, locale);
	// `categoryIsEmpty` in the page: no products in this channel.
	return localized !== null && !((localized.products?.totalCount ?? 0) === 0);
}

async function presence() {
	const { getCategoryMarketPresence } = await import("./category-presence");
	return getCategoryMarketPresence(SLUG);
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("MAKY_LIVE_MARKETS", MARKETS.join(","));
	catalogue = [complete()];
	sent = [];
	fault = null;
	tags.length = 0;
	lives.length = 0;
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

const czech = () => catalogue[0]!.translations.CS!;
const CASES: [string, () => void, readonly string[]][] = [
	["translated and stocked in every market", () => {}, []],
	["missing seoDescription", () => void (czech().seoDescription = ""), ["cz"]],
	["whitespace-only seoTitle", () => void (czech().seoTitle = "   "), ["cz"]],
	["missing description", () => void delete czech().description, ["cz"]],
	["missing translated name", () => void delete czech().name, ["cz"]],
	["no translation row at all", () => void delete catalogue[0]!.translations.HU, ["hu"]],
	["no translated slug — the base slug is the fallback URL, as today", () => void delete czech().slug, []],
	["empty in one channel", () => void (catalogue[0]!.counts["de-eur"] = 0), ["de"]],
	["empty in the source market", () => void (catalogue[0]!.counts["sk-eur"] = 0), ["sk"]],
	["no product count for a channel at all", () => void delete catalogue[0]!.counts["at-eur"], ["at"]],
	["a base row with no name: not a page anywhere", () => void (catalogue[0]!.name = " "), [...MARKETS]],
	["no such category", () => void (catalogue = []), [...MARKETS]],
];

describe("presence parity with the page's own lookup", () => {
	for (const [name, mutate, absentIn] of CASES) {
		it(name, async () => {
			mutate();
			const outcome = await presence();
			expect(outcome.status).toBe("found");
			if (outcome.status !== "found") return;

			for (const market of MARKETS) {
				expect(outcome.resource.includes(market), market).toBe(await todayDecision(market));
			}
			// Not vacuous: the case really removes exactly the markets it names.
			expect(MARKETS.filter((market) => !outcome.resource.includes(market))).toEqual(absentIn);
		});
	}

	it("answers in live-market order", async () => {
		const outcome = await presence();
		expect(outcome).toEqual({ status: "found", resource: [...MARKETS] });
	});
});

describe("one request, by slug", () => {
	it("sends ONE query with one alias per live market, asked by base slug, once, under a deadline", async () => {
		await presence();
		expect(sent).toHaveLength(1);
		const { query, options } = sent[0]!;
		expect(query).toMatch(/^query CategoryMarketPresence\(\$slug: String!\)/);
		for (const [index, market] of MARKETS.entries()) {
			expect(query).toContain(`${market}: category(slug: $slug)`);
			expect(query).toContain(`products(channel: "${CHANNELS[index]}") { totalCount }`);
		}
		// Asked by the base slug: no translated-slug retry, no product card, no listing.
		expect(query).not.toContain("slugLanguageCode");
		expect(query).not.toContain("edges");
		expect(options).toMatchObject({ variables: { slug: SLUG }, retry: false, cache: "no-store" });
		expect(options.revalidate).toBeUndefined();
		expect(options.signal).toBeInstanceOf(AbortSignal);
	});

	it("asks the source market for no translation and a foreign market for the four fields the boundary reads", async () => {
		const { categoryPresenceDocument } = await import("./category-presence");
		const query = categoryPresenceDocument(["sk", "cz"]);
		const [sk, cz] = query.split(/(?=cz: category)/);
		expect(sk).not.toContain("translation");
		expect(cz).toContain("translation(languageCode: CS) { name slug description seoTitle seoDescription }");
	});

	it("the number of live markets changes the aliases, never the number of requests", async () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de,at,pl,hu,it,fr,es,ro,us,ca");
		await presence();
		expect(sent).toHaveLength(1);
		expect(sent[0]!.query.match(/: category\(slug: \$slug\)/g)).toHaveLength(12);
	});

	it("tags the entry with every live channel's category tag, so the existing events reach it", async () => {
		await presence();
		const { CHANNEL_MAP } = await import("@/lib/channel-map");
		for (const [index, market] of MARKETS.entries()) {
			expect(tags).toContain(`category:${CHANNELS[index]}:${CHANNEL_MAP[market]!.locale}:${SLUG}`);
		}
	});

	it("keeps the profile's life — an empty or untranslated market does not shorten it", async () => {
		catalogue[0]!.counts["de-eur"] = 0;
		delete catalogue[0]!.translations.HU;
		const outcome = await presence();
		expect(outcome).toEqual({ status: "found", resource: ["sk", "cz", "at", "ca"] });
		expect(lives).toEqual(["minutes"]);
	});
});

describe("a fault is the whole answer, and never a throw", () => {
	for (const kind of ["http", "partial", "missing-alias", "starved"] as const) {
		it(`${kind}: upstream-error, remembered for seconds, logged once`, async () => {
			fault = kind;
			const outcome = await presence();
			expect(outcome.status).toBe("upstream-error");
			expect(lives).toContainEqual(FAULT_CACHE_LIFE);
			const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
			const lines = logged.filter(
				(line) => line.includes("[upstream-error]") && line.includes("category-presence"),
			);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain(`"slug":"${SLUG}"`);
			// The line says whether the deadline went on the queue or on Saleor.
			expect(lines[0]!.includes('"queueStarved":true')).toBe(kind === "starved");
		});
	}
});
