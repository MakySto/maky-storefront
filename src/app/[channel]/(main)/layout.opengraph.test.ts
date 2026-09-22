import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";

/**
 * The market layout's Open Graph — what every page that does not declare its own inherits.
 *
 * It must name the market's locale, the site and the generic card, and it must NOT carry an
 * og:url: the layout does not know which page it wraps, and an og:url pointing at the market
 * homepage would label every page a copy of it.
 */

const openGraphFor = async (channel: string) => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	const { generateMetadata } = await import("./layout");
	return (await generateMetadata({ params: Promise.resolve({ channel }) })).openGraph;
};

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("the market layout's Open Graph", () => {
	it.each(Object.values(CHANNEL_MAP))("$saleorSlug", async ({ saleorSlug, locale }) => {
		expect(await openGraphFor(saleorSlug)).toEqual({
			type: "website",
			siteName: "MAKY.STORE",
			locale: locale.replace("-", "_"),
			images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "MAKY.STORE" }],
		});
	});
});
