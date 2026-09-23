import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Saleor fault is never "this product does not exist", and never costs the page its metadata.
 *
 * The owner's table, one row per test:
 *   a) the product exists here, another market cannot be asked  -> the page keeps its title,
 *      robots and canonical; hreflang just leaves that market out;
 *   b) this market's own lookup fails                           -> noindex, no canonical, no
 *      "not found" title;
 *   c) Saleor answers `product: null`                            -> the not-found branch.
 * Saleor is replaced at the transport; the lookup, the exact-locale boundary, the counterpart
 * list and the metadata are real.
 */

type Answer = Record<string, unknown> | null | "fail";
let answers: Record<string, Answer>;
let calls: { channel: string; slug: string; retry?: boolean; signal?: AbortSignal }[];

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (
		_doc: unknown,
		options: { variables: { channel: string; slug: string }; retry?: boolean; signal?: AbortSignal },
	) => {
		const { channel, slug } = options.variables;
		calls.push({ channel, slug, retry: options.retry, signal: options.signal });
		const answer = answers[channel];
		if (answer === "fail") {
			return { ok: false, error: { type: "http", statusCode: 503, message: "HTTP 503", isRetryable: true } };
		}
		return { ok: true, data: { product: answer ?? null } };
	},
}));
vi.mock("next/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/cache")>()),
	cacheLife: () => {},
	cacheTag: () => {},
}));
const load = (locale: string) =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as never;
vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale),
			namespace: options.namespace as never,
		}),
}));

const BASE = "stresny-nosic-nordrive-silenzio-cx-black-volvo-xc90";
const product = (translation: Record<string, string> | null) => ({
	id: "UHJvZHVjdDo3",
	name: "Strešný nosič Nordrive Silenzio CX",
	slug: BASE,
	seoTitle: null,
	seoDescription: "Strešný nosič na Volvo XC90.",
	description: null,
	translation,
	isAvailableForPurchase: true,
	attributes: [],
	category: null,
	pricing: null,
	media: [],
	thumbnail: null,
	variants: [],
});
const CZECH = {
	name: "Střešní nosič Nordrive Silenzio CX",
	slug: "stresni-nosic-nordrive-silenzio-cx-black-volvo-xc90",
	description: "{}",
	seoTitle: "Střešní nosič Nordrive Silenzio CX | MAKY.STORE",
	seoDescription: "Střešní nosič na Volvo XC90.",
};

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz,de");
	vi.stubEnv("MAKY_INDEXABLE_MARKETS", "sk,cz,de");
	calls = [];
	answers = { "sk-eur": product(null), "cz-czk": product(CZECH), "de-eur": product(null) };
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

const metadataFor = async () => {
	const { generateMetadata } = await import("./page");
	return generateMetadata({ params: Promise.resolve({ channel: "sk-eur", productSlug: BASE }) });
};

describe("PDP metadata when Saleor fails", () => {
	it("a) another market failing leaves the page's title, robots and canonical alone, and only that market out of hreflang", async () => {
		answers["de-eur"] = "fail";
		const meta = await metadataFor();

		expect(String(meta.title)).toContain("Nordrive Silenzio CX");
		expect(meta.robots).toBeUndefined();
		expect(meta.alternates?.canonical).toBe(`/sk/${BASE}`);
		expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["sk-SK", "cs-CZ", "x-default"]);
	});

	it("a) another market is asked once, with a deadline, while the page's own product keeps its retries", async () => {
		answers["de-eur"] = "fail";
		await metadataFor();

		const own = calls.filter((call) => call.channel === "sk-eur");
		const foreign = calls.filter((call) => call.channel !== "sk-eur");
		expect(own.length).toBeGreaterThan(0);
		for (const call of own) {
			expect(call.retry).toBeUndefined();
			expect(call.signal).toBeUndefined();
		}
		expect(foreign.length).toBeGreaterThan(0);
		for (const call of foreign) {
			expect(call.retry).toBe(false);
			expect(call.signal).toBeInstanceOf(AbortSignal);
		}
	});

	it("b) the page's own lookup failing gives noindex and no canonical — and no not-found title", async () => {
		answers["sk-eur"] = "fail";
		const meta = await metadataFor();

		expect(meta.robots).toMatchObject({ index: false, follow: false });
		expect(meta.alternates).toBeUndefined();
		expect(meta.title).toBeUndefined();
	});

	it("c) Saleor saying there is no such product keeps the not-found branch", async () => {
		answers["sk-eur"] = null;
		const meta = await metadataFor();

		expect(meta.title).toBe("Produkt nenájdený");
		expect(meta.robots).toMatchObject({ index: false, follow: false });
		expect(meta.alternates).toBeUndefined();
	});
});
