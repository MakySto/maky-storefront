import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async () => ({ ok: true, data: { category } }),
}));

// `applyCacheProfile` tags the entry; outside a Next render there is nothing to tag.
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: () => {},
}));

beforeEach(() => {
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
