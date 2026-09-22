import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { jsonLdBlocks } from "@/lib/seo/json-ld.testkit";

/**
 * The market homepage carries the shop's Organization and WebSite markup exactly once.
 *
 * Executed, not grepped: the page component is called, its element tree walked, and every
 * structured-data element in it rendered to the HTML a crawler receives. The rest of the
 * page (hero, category grid, featured products) is client- or Saleor-backed and emits no
 * JSON-LD; it is not rendered here, only searched for a second copy of the block.
 */

beforeEach(() => {
	// The page's transitive imports reach the Saleor client, which refuses to load without
	// these. They say nothing about structured data.
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://api.example.test/graphql/");
	vi.stubEnv("NEXT_PUBLIC_DEFAULT_CHANNEL", "sk-eur");
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

/** Every element in a tree, including ones passed through props such as `vehicleAction`. */
function elementsIn(node: unknown): ReactElement[] {
	if (Array.isArray(node)) return (node as unknown[]).flatMap((child) => elementsIn(child));
	if (!isValidElement(node)) return [];
	const props = node.props as Record<string, unknown>;
	return [node, ...Object.values(props).flatMap((value) => elementsIn(value))];
}

describe("the market homepage", () => {
	it.each(Object.values(CHANNEL_MAP).map((config) => config.saleorSlug))(
		"%s: renders exactly one OnlineStore and one WebSite block",
		async (channel) => {
			const { default: Page } = await import("./page");
			const { HomepageStructuredData } = await import("@/ui/components/homepage/structured-data");

			const tree = Page({ params: Promise.resolve({ channel }) });
			const blocks = elementsIn(tree).filter((element) => element.type === HomepageStructuredData);
			expect(blocks).toHaveLength(1);

			const html = renderToStaticMarkup(
				await HomepageStructuredData(blocks[0]!.props as Parameters<typeof HomepageStructuredData>[0]),
			);
			const types = jsonLdBlocks(html).map((block) => block["@type"]);
			expect(types.filter((type) => type === "OnlineStore")).toHaveLength(1);
			expect(types.filter((type) => type === "WebSite")).toHaveLength(1);
			expect(types).toHaveLength(2);
		},
	);
});
