import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { jsonLdBlocks } from "@/lib/seo/json-ld.testkit";
import { HomepageStructuredData } from "./structured-data";

/**
 * What the homepage block actually puts in the HTML — the serialized `<script>` tags, parsed
 * back, rather than the objects the builders return. A builder can be right and the page can
 * still emit it twice, or not at all, or as something that is not JSON.
 */

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function render(channel: string): Promise<string> {
	return renderToStaticMarkup(await HomepageStructuredData({ params: Promise.resolve({ channel }) }));
}

describe("the homepage structured data", () => {
	it.each(Object.values(CHANNEL_MAP).map((config) => config.saleorSlug))(
		"%s: exactly one OnlineStore and one WebSite, as valid JSON",
		async (channel) => {
			const blocks = jsonLdBlocks(await render(channel));
			expect(blocks.map((block) => block["@type"])).toEqual(["OnlineStore", "WebSite"]);
		},
	);

	it("the two blocks are joined by @id", async () => {
		const [store, site] = jsonLdBlocks(await render("de-eur"));
		expect(site!.publisher).toEqual({ "@id": store!["@id"] });
		expect(store!["@id"]).toBe("https://maky.store/#organization");
	});

	it("renders nothing for a channel that is not a market", async () => {
		expect(await render("xx-eur")).toBe("");
	});
});
