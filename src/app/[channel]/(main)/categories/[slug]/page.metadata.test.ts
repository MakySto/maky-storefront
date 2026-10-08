import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAULT_CACHE_LIFE } from "@/lib/cache-fault";

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

const { reads, lives, inFlight } = vi.hoisted(() => ({
	reads: [] as { operation: string; options: Record<string, unknown> }[],
	lives: [] as unknown[],
	inFlight: { now: 0, peak: 0 },
}));

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (document: { toString(): string }, options: Record<string, unknown>) => {
		reads.push({ operation: /query\s+(\w+)/.exec(document.toString())?.[1] ?? "?", options });
		inFlight.now += 1;
		inFlight.peak = Math.max(inFlight.peak, inFlight.now);
		await new Promise((resolve) => setTimeout(resolve, 5));
		inFlight.now -= 1;
		return { ok: true, data: { category: missing ? null : category } };
	},
}));

// The not-found branch asks for the market's "not found" title; there is no request to take a locale from.
vi.mock("next-intl/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next-intl/server")>()),
	getTranslations: async () => (key: string) => key,
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
	missing = false;
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
		expect(lives.every((profile) => profile === "minutes")).toBe(true);
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

	it("the markets that carry the same category are read together, not one after the other", async () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de,at,pl,hu");
		await metadataFor();
		expect(inFlight.peak).toBeGreaterThan(1);
	});
});
