import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The market homepage's Open Graph: its own og:url, beside the fields every market page shares.
 *
 * The homepage sets `openGraph` to add og:url, and Next replaces the layout's `openGraph`
 * wholesale — so this is also the check that nothing the layout provided went missing.
 */

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: JSON.parse(
				readFileSync(path.join(process.cwd(), `src/i18n/messages/${options.locale}.json`), "utf8"),
			) as never,
			namespace: options.namespace as never,
		}),
}));

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("market homepage Open Graph", () => {
	it.each(Object.entries(CHANNEL_MAP).map(([market, config]) => ({ market, ...config })))(
		"$market: og:url is the canonical, and the shared fields are all there",
		async ({ market, saleorSlug, locale }) => {
			const { generateMetadata } = await import("./page");
			const meta = await generateMetadata({ params: Promise.resolve({ channel: saleorSlug }) });

			expect(meta.alternates?.canonical).toBe(`https://maky.store/${market}`);
			expect(meta.openGraph).toEqual({
				type: "website",
				siteName: "MAKY.STORE",
				locale: locale.replace("-", "_"),
				images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "MAKY.STORE" }],
				url: `https://maky.store/${market}`,
			});
		},
	);
});
