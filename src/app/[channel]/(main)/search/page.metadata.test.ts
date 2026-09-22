import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { routePolicyFor } from "@/lib/route-policy";

/**
 * Internal search pages stay out of the index, and say what they are in the market's language.
 *
 * Before this, `/sk/search?query=thule` answered 200 with no robots meta and the English title
 * "Search products" on every market. `route-policy.ts` already classified search as
 * non-indexable; nothing on the page read it.
 */

type Messages = { search: { metaTitle: string; metaDescription: string } };
const load = (locale: string): Messages =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Messages;

// The real catalogues through next-intl's own formatter, so `{siteName}` is interpolated for real.
vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));

beforeEach(() => {
	// The page's transitive imports reach the Saleor client, which refuses to load without these.
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const metadataFor = async (channel: string) => {
	const { generateMetadata } = await import("./page");
	return generateMetadata({ params: Promise.resolve({ channel }) });
};

const MARKETS = Object.entries(CHANNEL_MAP).map(([market, config]) => ({ market, ...config }));

describe("search results are never indexed", () => {
	it("route-policy is where that is decided", () => {
		expect(routePolicyFor("search")?.indexable).toBe(false);
	});

	it.each(MARKETS)("$market: noindex, follow", async ({ saleorSlug }) => {
		expect((await metadataFor(saleorSlug)).robots).toEqual({ index: false, follow: true });
	});
});

describe("search results are titled in the market's language", () => {
	it("Slovakia", async () => {
		const meta = await metadataFor("sk-eur");
		expect(meta.title).toBe("Vyhľadávanie produktov | MAKY.STORE");
		expect(meta.description).toBe("Výsledky vyhľadávania v ponuke MAKY.STORE.");
	});

	it.each(MARKETS)("$market: its own title and description, branded once", async ({ saleorSlug, locale }) => {
		const meta = await metadataFor(saleorSlug);
		const own = load(locale).search;

		expect(meta.title).toBe(`${own.metaTitle} | MAKY.STORE`);
		expect(meta.description).toBe(own.metaDescription.replace("{siteName}", "MAKY.STORE"));
		expect(String(meta.description)).not.toContain("{");
		if (!locale.startsWith("en-")) {
			expect(meta.title).not.toContain("Search");
			expect(String(meta.description)).not.toContain("Search");
		}
	});

	it("no two languages share a title by accident", async () => {
		// de-DE/de-AT and en-US/en-CA share a language; everyone else must differ.
		const titles = new Set<string>();
		for (const { saleorSlug } of MARKETS) titles.add(String((await metadataFor(saleorSlug)).title));
		expect(titles.size).toBe(MARKETS.length - 2);
	});
});
