import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";
import { CATEGORY_PAGE_LIFE } from "@/lib/cache-manifest";
import { __forgetAllKept } from "@/lib/cache/kept-read";

/**
 * A category's `<title>` names the category once and the shop once.
 *
 * It was `${name} | ${seoTitle || parent title}`. Wherever Saleor's SEO title is the name
 * itself — which is how the catalogue was imported — that printed the category twice and the
 * brand not at all: `/sk/autochladnicky` → "Autochladničky | Autochladničky".
 *
 * Saleor is replaced at the transport (`executePublicGraphQL`); the slug lookup, the
 * exact-locale boundary and the metadata function are real.
 */

let category: Record<string, unknown>;
/** Saleor answers `category: null`: nothing by that slug, in either of its two lookups. */
let missing = false;
/** Per market, what Saleor holds for the category instead of the stocked and translated default. */
let presenceOverrides: Record<string, Record<string, unknown> | null>;
/** The first presence request fails the way a read that spent its deadline waiting for a Saleor slot does. */
let presenceFault = false;

const translated = (name: string) => ({
	name,
	slug: null,
	description: "{}",
	seoTitle: name,
	seoDescription: name,
});

/** What Saleor holds for a market when the category is translated there and holds products: the first one. */
const stocked = (alias: string) => ({
	name: "Autochladničky",
	slug: "autochladnicky",
	translation: alias === "sk" ? null : translated(`Chladnička ${alias}`),
	products: { edges: [{ node: { id: `product-${alias}` } }] },
});

/**
 * One alias per market the document names, carrying what that document selects: the texts for the first
 * presence request, the first product for the second. Stocked unless a test says otherwise.
 */
const presenceAnswer = (source: string) => {
	const asksStock = source.startsWith("query CategoryMarketStock");
	return Object.fromEntries(
		[...source.matchAll(/(\w+): category\(slug: \$slug\)/g)].map(([, alias]) => {
			const held = alias! in presenceOverrides ? presenceOverrides[alias!] : stocked(alias!);
			if (held === null) return [alias, null];
			return [
				alias,
				asksStock
					? { products: held.products }
					: { name: held.name, slug: held.slug, translation: held.translation },
			];
		}),
	);
};

const { reads, lives, inFlight } = vi.hoisted(() => ({
	reads: [] as { operation: string; options: Record<string, unknown> }[],
	lives: [] as unknown[],
	inFlight: { now: 0, peak: 0 },
}));

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (document: { toString(): string }, options: Record<string, unknown>) => {
		const operation = /query\s+(\w+)/.exec(document.toString())?.[1] ?? "?";
		reads.push({ operation, options });
		inFlight.now += 1;
		inFlight.peak = Math.max(inFlight.peak, inFlight.now);
		await new Promise((resolve) => setTimeout(resolve, 5));
		inFlight.now -= 1;
		if (operation.startsWith("CategoryMarket")) {
			return presenceFault
				? {
						ok: false,
						error: {
							type: "network",
							message: `${operation}: deadline exceeded`,
							isRetryable: true,
							queueStarved: true,
						},
					}
				: { ok: true, data: presenceAnswer(document.toString()) };
		}
		return { ok: true, data: { category: missing ? null : category } };
	},
}));

// What the channel sells on the snow-chain shelf, by public code: the scan the tyre-size pages are decided by.
const { getShelfCodes } = vi.hoisted(() => ({ getShelfCodes: vi.fn() }));
vi.mock("@/lib/listing/shelf-codes", () => ({ getShelfCodes }));

// The not-found branch asks for the market's "not found" title; there is no request to take a locale from.
vi.mock("next-intl/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next-intl/server")>()),
	// With values, the key and what it was given: enough to see which sentence was asked for, and of what.
	getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
		values ? `${key} ${JSON.stringify(values)}` : key,
}));

// `applyCacheProfile` tags the entry; outside a Next render there is nothing to tag. The calls to
// `cacheLife` are kept, because how long an answer is remembered is part of what is asserted.
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: (profile: unknown) => {
		lives.push(profile);
	},
	cacheTag: () => {},
}));

beforeEach(() => {
	__forgetAllKept();
	getShelfCodes.mockReset();
	missing = false;
	presenceOverrides = {};
	presenceFault = false;
	reads.length = 0;
	lives.length = 0;
	inFlight.now = 0;
	inFlight.peak = 0;
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	category = {
		id: "Q2F0ZWdvcnk6MQ==",
		name: "Autochladničky",
		slug: "autochladnicky",
		seoTitle: "Autochladničky",
		seoDescription: "Autochladničky do auta.",
		description: null,
		backgroundImage: null,
		translation: null,
		products: {
			totalCount: 12,
			edges: [],
			pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
		},
	};
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const titleFor = async () => {
	const { generateMetadata } = await import("./page");
	const meta = await generateMetadata({
		params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
		searchParams: Promise.resolve({}),
	});
	return String(meta.title);
};

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const descriptionOf = async () => {
	const { generateMetadata } = await import("./page");
	const meta = await generateMetadata({
		params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
		searchParams: Promise.resolve({}),
	});
	return meta.description;
};

describe("category meta description", () => {
	const longText = "Dlhý text kategórie pre ľudí, ktorí chcú vedieť všetko. ".repeat(12).trim();
	const asEditorJs = (text: string) => JSON.stringify({ blocks: [{ type: "paragraph", data: { text } }] });

	it("keeps the SEO description it has", async () => {
		expect(await descriptionOf()).toBe("Autochladničky do auta.");
	});

	it("cuts the page text at a word, to what a search result shows, when there is no SEO description", async () => {
		category.seoDescription = "";
		category.description = asEditorJs(longText);
		const description = String(await descriptionOf());
		expect(description.length).toBeLessThanOrEqual(156);
		expect(description.endsWith("…")).toBe(true);
		expect(longText.startsWith(description.slice(0, -1))).toBe(true);
	});

	it("keeps a short page text whole", async () => {
		category.seoDescription = "";
		category.description = asEditorJs("Krátky text kategórie.");
		expect(await descriptionOf()).toBe("Krátky text kategórie.");
	});

	// 19 of the 28 Slovak categories answered with their bare name here (2026-11-15).
	it("is a sentence about the category and what it holds, never the bare name, when it has no text at all", async () => {
		category.seoDescription = "";
		category.description = null;
		expect(await descriptionOf()).toBe('categoryMetaDescription {"category":"Autochladničky","count":12}');
	});

	it("keeps the name for an empty category, which is not indexed and has nothing to count", async () => {
		category.seoDescription = "";
		(category.products as { totalCount: number }).totalCount = 0;
		expect(await descriptionOf()).toBe("Autochladničky");
	});
});

/**
 * Page two used to name page one as its canonical, which tells a crawler it is a copy and leaves the
 * products it links to the sitemap alone. Google: "Don't use the first page of a paginated sequence as
 * the canonical page."
 */
describe("a later page of the listing", () => {
	const metaFor = async (searchParams: Record<string, string | undefined>) => {
		const { generateMetadata } = await import("./page");
		return generateMetadata({
			params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
			searchParams: Promise.resolve(searchParams),
		});
	};

	beforeEach(() => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de");
		vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,cz,de");
	});

	it("is its own canonical, in the form the pagination link has", async () => {
		const meta = await metaFor({ cursor: "WyJhIiwgIjEyIl0=", direction: "next" });
		expect(meta.alternates?.canonical).toBe(
			"https://maky.store/sk/autochladnicky?cursor=WyJhIiwgIjEyIl0%3D&direction=next",
		);
		expect(meta.robots).toBeUndefined();
	});

	it("names no other market: page two elsewhere holds other products", async () => {
		const meta = await metaFor({ cursor: "WyJhIiwgIjEyIl0=", direction: "next" });
		expect(meta.alternates?.languages).toBeUndefined();
		expect(
			reads.map((read) => read.operation).filter((operation) => operation.startsWith("CategoryMarket")),
		).toEqual([]);
	});

	it("still points at the category when the list is re-ordered, narrowed or walked backwards", async () => {
		const variants: Record<string, string>[] = [
			{ sort: "price-asc" },
			{ cursor: "abc", direction: "next", sort: "price-asc" },
			{ cursor: "abc", direction: "next", brand: "thule" },
			{ cursor: "abc", direction: "next", tyreSize: "205-55-16" },
			{ cursor: "abc", direction: "prev" },
			{ cursor: "", direction: "next" },
		];
		for (const searchParams of variants) {
			const meta = await metaFor(searchParams);
			expect(meta.alternates?.canonical, JSON.stringify(searchParams)).toBe(
				"https://maky.store/sk/autochladnicky",
			);
			expect(Object.keys(meta.alternates?.languages ?? {}), JSON.stringify(searchParams)).toContain(
				"x-default",
			);
		}
	});
});

describe("the snow-chain shelf narrowed by a tyre size", () => {
	const metaFor = async (searchParams: Record<string, string | undefined>, channel = "sk-eur") => {
		const { generateMetadata } = await import("./page");
		return generateMetadata({
			params: Promise.resolve({ channel, slug: channel === "sk-eur" ? "snehove-retaze" : "snehove-retezy" }),
			searchParams: Promise.resolve(searchParams),
		});
	};
	const shelf = (...codes: string[]) => codes.map((code) => ({ code, productId: `gid-${code}`, slug: code }));

	beforeEach(() => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de");
		vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,cz,de");
		getShelfCodes.mockResolvedValue(shelf("N16075", "N17143"));
	});

	it("names the size's page as its canonical and as og:url, not the shelf", async () => {
		const meta = await metaFor({ tyres: "1", tyreSize: "205/60 R16" });
		expect(meta.alternates?.canonical).toBe("https://maky.store/sk/snehove-retaze/205-60-r16");
		expect(meta.openGraph?.url).toBe("https://maky.store/sk/snehove-retaze/205-60-r16");
		expect(meta.robots).toBeUndefined();
	});

	it("does so at the market's own address", async () => {
		category = {
			...category,
			translation: {
				name: "Sněhové řetězy",
				slug: "snehove-retezy",
				description: "{}",
				seoTitle: "Sněhové řetězy",
				seoDescription: "Sněhové řetězy a textilní návleky.",
			},
		};
		const meta = await metaFor({ tyres: "1", tyreSize: "205/60 R16" }, "cz-czk");
		expect(meta.alternates?.canonical).toBe("https://maky.store/cz/snehove-retezy/205-60-r16");
	});

	it("names no other market: the size page names its own", async () => {
		const meta = await metaFor({ tyres: "1", tyreSize: "205/60 R16" });
		expect(meta.alternates?.languages).toBeUndefined();
		expect(
			reads.map((read) => read.operation).filter((operation) => operation.startsWith("CategoryMarket")),
		).toEqual([]);
	});

	it("keeps the shelf as the canonical where the size has no indexed page", async () => {
		const variants: Record<string, string>[] = [
			{},
			{ tyres: "1" },
			{ tyres: "0", tyreSize: "205/60 R16" },
			{ tyres: "1", tyreSize: "205/60 R99" },
		];
		for (const searchParams of variants) {
			const meta = await metaFor(searchParams);
			expect(meta.alternates?.canonical, JSON.stringify(searchParams)).toBe(
				"https://maky.store/sk/snehove-retaze",
			);
			expect(Object.keys(meta.alternates?.languages ?? {}), JSON.stringify(searchParams)).toContain(
				"x-default",
			);
		}
		getShelfCodes.mockResolvedValue(shelf("N16075"));
		const one = await metaFor({ tyres: "1", tyreSize: "205/60 R16" });
		expect(one.alternates?.canonical).toBe("https://maky.store/sk/snehove-retaze");
		getShelfCodes.mockRejectedValue(new Error("saleor is down"));
		const fault = await metaFor({ tyres: "1", tyreSize: "205/60 R16" });
		expect(fault.alternates?.canonical).toBe("https://maky.store/sk/snehove-retaze");
	});

	it("does not ask what the shelf sells for another category", async () => {
		const { generateMetadata } = await import("./page");
		const meta = await generateMetadata({
			params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
			searchParams: Promise.resolve({ tyreSize: "205/60 R16" }),
		});
		expect(meta.alternates?.canonical).toBe("https://maky.store/sk/autochladnicky");
		expect(getShelfCodes).not.toHaveBeenCalled();
	});
});

describe("the Kargo category abroad, while Saleor still holds its first slug", () => {
	const SEGMENT = "kargo-dachtraeger-und-dachkoerbe-fuer-transporter";
	const published = globalThis as typeof globalThis & { [key: symbol]: unknown };
	let key: symbol;

	beforeEach(async () => {
		key = (await import("@/config/categories")).LIVE_CATEGORY_SLUGS_KEY;
		published[key] = new Set(["stresne-nosice-a-kose-na-dodavky"]);
		category = {
			...category,
			id: "Q2F0ZWdvcnk6MzQ=",
			name: "Strešné nosiče a koše na dodávky",
			slug: "stresne-nosice-a-kose-na-dodavky",
			translation: {
				name: "Dachträger und Dachkörbe für Transporter",
				slug: "dachtraeger-und-dachkoerbe-fuer-transporter",
				description: "{}",
				seoTitle: "Dachträger und Dachkörbe für Transporter",
				seoDescription: "Dachträger und Dachkörbe für Transporter.",
			},
		};
	});
	afterEach(() => {
		delete published[key];
	});

	it("is read by the slug Saleor holds and answers at its canonical root", async () => {
		const { generateMetadata } = await import("./page");
		const meta = await generateMetadata({
			params: Promise.resolve({ channel: "de-eur", slug: SEGMENT }),
			searchParams: Promise.resolve({}),
		});
		expect(meta.alternates?.canonical).toBe(`https://maky.store/de/${SEGMENT}`);
		const asked = reads.find((read) => read.operation === "ProductListByCategory");
		expect((asked?.options.variables as { slug: string }).slug).toBe("stresne-nosice-a-kose-na-dodavky");
	});
});

describe("category page title", () => {
	it("an SEO title equal to the name: the name once, the brand once", async () => {
		const title = await titleFor();
		expect(title).toBe("Autochladničky | MAKY.STORE");
		expect(occurrences(title, "Autochladničky")).toBe(1);
	});

	it("a distinct SEO title wins over the name", async () => {
		category.seoTitle = "Autochladničky do auta 12 V";
		expect(await titleFor()).toBe("Autochladničky do auta 12 V | MAKY.STORE");
	});

	it("no SEO title: the name", async () => {
		category.seoTitle = null;
		expect(await titleFor()).toBe("Autochladničky | MAKY.STORE");
		category.seoTitle = "   ";
		expect(await titleFor()).toBe("Autochladničky | MAKY.STORE");
	});

	it("an SEO title that already carries the brand is not branded again", async () => {
		category.seoTitle = "Autochladničky | MAKY.STORE";
		const title = await titleFor();
		expect(title).toBe("Autochladničky | MAKY.STORE");
		expect(occurrences(title, "MAKY.STORE")).toBe(1);
	});

	it("og:url is the canonical, beside the market's shared Open Graph fields", async () => {
		const { generateMetadata } = await import("./page");
		const meta = await generateMetadata({
			params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
			searchParams: Promise.resolve({}),
		});
		expect(meta.alternates?.canonical).toBe("https://maky.store/sk/autochladnicky");
		expect(meta.openGraph).toMatchObject({
			type: "website",
			siteName: "MAKY.STORE",
			locale: "sk_SK",
			url: meta.alternates?.canonical,
			images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
		});
	});

	it("the empty-in-this-channel branch follows the same rule", async () => {
		category.products = { ...(category.products as object), totalCount: 0 };
		const { generateMetadata } = await import("./page");
		const meta = await generateMetadata({
			params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
			searchParams: Promise.resolve({}),
		});
		expect(meta.title).toBe("Autochladničky | MAKY.STORE");
		expect(meta.robots).toMatchObject({ index: false, follow: true });
	});
});

const metadataFor = async () => {
	const { generateMetadata } = await import("./page");
	return generateMetadata({
		params: Promise.resolve({ channel: "sk-eur", slug: "autochladnicky" }),
		searchParams: Promise.resolve({}),
	});
};

/**
 * What a crawler is told must not outlive the state it describes.
 *
 * 2026-10-08: Bing read six fridge categories in two minutes and got `noindex` and no canonical
 * from the ones whose products had arrived shortly before, with the full listing under that head.
 * The listing is read on its own, when the page is rendered; the head came from this entry, and
 * the entry sat on a second cache, the data cache, which hands back a stale read however old it is.
 * Reproduced on Next 16.3.6: a first visit 100 s after the products arrived still got the head
 * from before them.
 */
describe("how long a category answer is remembered", () => {
	it("the read behind the entry is not cached a second time", async () => {
		await metadataFor();
		const outcomeReads = reads.filter((read) => read.operation === "ProductListByCategory");
		expect(outcomeReads.length).toBeGreaterThan(0);
		for (const read of outcomeReads) {
			expect(read.options.cache).toBe("no-store");
			expect(read.options.revalidate).toBeUndefined();
		}
	});

	it("a stocked category keeps the life of its profile", async () => {
		await metadataFor();
		expect(lives.length).toBeGreaterThan(0);
		expect(lives.every((profile) => profile === CATEGORY_PAGE_LIFE)).toBe(true);
	});

	it("an empty category is remembered for seconds, as a fault is", async () => {
		category.products = { ...(category.products as object), totalCount: 0 };
		const meta = await metadataFor();
		expect(meta.robots).toMatchObject({ index: false });
		expect(lives).toContainEqual(FAULT_CACHE_LIFE);
	});

	it("a category with no name in the market is remembered for seconds, as a fault is", async () => {
		missing = true;
		const meta = await metadataFor();
		expect(meta.robots).toMatchObject({ index: false, follow: false });
		expect(lives).toContainEqual(FAULT_CACHE_LIFE);
	});
});

/**
 * The other markets of a category — its hreflang cluster and the market switcher — are ONE request.
 *
 * PR 46 made the head read every live market at once, which was twelve `ProductListByCategory`
 * reads (a product card in each) per category slug, and remembered an empty market for seconds.
 * The other markets' only job here is to say whether the category is a real page there, and one
 * request with an alias per market says it.
 */
describe("the other markets of a category", () => {
	const hreflangFor = async () => (await metadataFor()).alternates?.languages;

	beforeEach(async () => {
		// What the process keeps of the markets' answer between visits is the module's own state.
		(await import("@/lib/saleor/category-presence")).__forgetCategoryPresence();
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de,at,pl,hu");
		vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,cz,de,at,pl,hu");
	});

	it("are asked in two small requests, one after the other; the head reads only its own market", async () => {
		await metadataFor();
		const operations = reads.map((read) => read.operation);
		expect(operations.filter((operation) => operation === "CategoryMarketTranslations")).toHaveLength(1);
		expect(operations.filter((operation) => operation === "CategoryMarketStock")).toHaveLength(1);
		expect(operations.filter((operation) => operation === "ProductListByCategory")).toHaveLength(1);
		expect(operations).toHaveLength(3);
		expect(inFlight.peak).toBe(1);
	});

	it("are named in the hreflang cluster where the category is translated and stocked", async () => {
		expect(Object.keys((await hreflangFor()) ?? {})).toEqual([
			"sk-SK",
			"cs-CZ",
			"de-DE",
			"de-AT",
			"pl-PL",
			"hu-HU",
			"x-default",
		]);
	});

	it("leave out a market where the category is empty or has no translation", async () => {
		presenceOverrides.pl = { ...stocked("pl"), products: { edges: [] } };
		presenceOverrides.hu = { ...stocked("hu"), translation: null };
		expect(Object.keys((await hreflangFor()) ?? {})).toEqual([
			"sk-SK",
			"cs-CZ",
			"de-DE",
			"de-AT",
			"x-default",
		]);
	});

	it("say nothing when the question could not be answered, and the head is still the head", async () => {
		presenceFault = true;
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		const meta = await metadataFor();
		expect(meta.alternates?.languages).toBeUndefined();
		expect(meta.alternates?.canonical).toBe("https://maky.store/sk/autochladnicky");
		expect(meta.robots).toBeUndefined();
		expect(meta.title).toBe("Autochladničky | MAKY.STORE");
		const lines = logged.mock.calls.map((call) => String(call[0]));
		expect(lines.filter((line) => line.includes('"scope":"category-presence"'))).toHaveLength(1);
		logged.mockRestore();
	});
});
