import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
// `LinkWithChannel` reads the market from the route; there is no route in a unit test.
vi.mock("next/navigation", () => ({ useParams: () => ({ channel: "de-eur" }) }));

import { type ProductListItemFragment } from "@/gql/graphql";
import { ProductElement } from "./product-element";

/**
 * The homepage's product tile: never the grey "no image" GIF, and never a hole where the
 * picture should be — the same localized "no image" state as the listing card, in the
 * market's own language.
 */

const PLACEHOLDER =
	"https://cdn.maky.store/thumbnails/products/c32bc543a46f5bf4eff3becb79dffc196d598106ae2608c85b48516_14c60dff_thumbnail_4.gif";

const product = (thumbnailUrl: string | null) =>
	({
		id: "UHJvZHVjdDox",
		name: "Dachbox 400 l",
		slug: "dachbox-400-l",
		category: { id: "c", name: "Dachboxen", slug: "stresne-boxy" },
		pricing: { priceRange: { start: { gross: { amount: 299, currency: "EUR" } }, stop: null } },
		thumbnail: thumbnailUrl ? { url: thumbnailUrl, alt: "Dachbox" } : null,
	}) as unknown as ProductListItemFragment;

const render = async (thumbnailUrl: string | null) =>
	renderToStaticMarkup(
		await ProductElement({ product: product(thumbnailUrl), loading: "lazy", locale: "de-DE" }),
	);

describe("ProductElement", () => {
	it("the placeholder renders the localized no-image state, not the GIF", async () => {
		const html = await render(PLACEHOLDER);
		expect(html).toContain("Kein Bild verfügbar");
		expect(html).not.toContain("c32bc543a46f5bf4");
		expect(html).not.toContain("<img");
	});

	it("no thumbnail at all renders the same state", async () => {
		expect(await render(null)).toContain("Kein Bild verfügbar");
	});

	it("a real photo is rendered as before", async () => {
		const html = await render("https://cdn.maky.store/products/dachbox-400.jpg");
		expect(html).toContain("<img");
		expect(html).not.toContain("Kein Bild verfügbar");
	});
});
