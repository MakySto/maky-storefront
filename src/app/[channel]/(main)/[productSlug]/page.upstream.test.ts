import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Saleor fault is never "this product does not exist", and never costs the page its metadata.
 *
 * The owner's table, one row per test:
 *   a) the product exists here, another market cannot be asked  -> the page keeps its title,
 *      robots and canonical; hreflang names no market it could not verify (the presence
 *      query is one request, so a fault there leaves the page naming only itself);
 *   b) this market's own lookup fails                           -> noindex, no canonical, no
 *      "not found" title;
 *   c) Saleor answers `product: null`                            -> the not-found branch.
 * Saleor is replaced at the transport; the lookup, the exact-locale boundary, the counterpart
 * list and the metadata are real.
 */

type Answer = Record<string, unknown> | null | "fail";
let answers: Record<string, Answer>;
let calls: { query: string; channel?: string; retry?: boolean; signal?: AbortSignal }[];

const FAILED = {
	ok: false,
	error: { type: "http", statusCode: 503, message: "HTTP 503", isRetryable: true },
};

vi.mock("@/lib/graphql", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/graphql")>()),
	executePublicGraphQL: async (
		doc: { toString(): string },
		options: { variables: { channel?: string; id?: string }; retry?: boolean; signal?: AbortSignal },
	) => {
		const query = doc.toString();
		const { channel } = options.variables;
		calls.push({ query: query.slice(0, 40), channel, retry: options.retry, signal: options.signal });
		// The presence query: one alias per live market, `product(id: $id, channel: "…")`.
		if (options.variables.id !== undefined) {
			const aliases = [...query.matchAll(/(\w+): product\(id: \$id, channel: "([^"]+)"\)/g)];
			if (aliases.some(([, , aliasChannel]) => answers[aliasChannel!] === "fail")) return FAILED;
			return {
				ok: true,
				data: Object.fromEntries(
					aliases.map(([, market, aliasChannel]) => [market, answers[aliasChannel!] ?? null]),
				),
			};
		}
		const answer = answers[channel!];
		if (answer === "fail") return FAILED;
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
	it("with every market answering, the cluster is the markets that have the product, so the rows below are not vacuous", async () => {
		const meta = await metadataFor();
		expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["sk-SK", "cs-CZ", "x-default"]);
	});

	it("a) another market failing leaves the page's title, robots and canonical alone, and names no unverified market", async () => {
		answers["de-eur"] = "fail";
		const meta = await metadataFor();

		expect(String(meta.title)).toContain("Nordrive Silenzio CX");
		expect(meta.robots).toBeUndefined();
		expect(meta.alternates?.canonical).toBe(`/sk/${BASE}`);
		expect(meta.alternates?.languages).toBeUndefined();
	});

	// The page's own product keeps its retries, inside a deadline of its own: without one a slow
	// Saleor held a crawler that is served the finished page for 43.8 s (2026-09-25).
	it("a) the other markets are asked once, with a deadline, while the page's own product keeps its retries within its own", async () => {
		answers["de-eur"] = "fail";
		await metadataFor();

		const own = calls.filter((call) => call.channel === "sk-eur");
		const others = calls.filter((call) => call.channel === undefined);
		expect(own.length).toBeGreaterThan(0);
		for (const call of own) {
			expect(call.retry).toBeUndefined();
			expect(call.signal).toBeInstanceOf(AbortSignal);
		}
		expect(others).toHaveLength(1);
		expect(others[0]!.query).toMatch(/^query ProductMarketPresence/);
		expect(others[0]!.retry).toBe(false);
		expect(others[0]!.signal).toBeInstanceOf(AbortSignal);
		expect(calls.filter((call) => call.channel !== undefined && call.channel !== "sk-eur")).toEqual([]);
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
