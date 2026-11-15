import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seam between the two halves of the feed. The shop makes the items (`readFeedPage`, TypeScript) and
 * the writer on the server turns them into XML (`scripts/ops/merchant-feed.mjs`, plain Node). Nothing
 * type-checks across that line, so this does: what the shop answers is what the writer accepts as an
 * item, and every field the shop states arrives in the file.
 */

const executePublicGraphQL = vi.fn();
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: (...args: unknown[]) => executePublicGraphQL(...args),
}));
vi.mock("@/lib/market-state", () => ({ isMarketIndexable: () => true }));

const { readFeedPage } = await import("./page");
const { isItem, renderItem } = await import("../../../scripts/ops/merchant-feed.mjs");

const set = {
	id: "P1",
	isAvailableForPurchase: true,
	name: "Strešný nosič Thule WingBar Evo <Škoda Octavia>",
	slug: "stresny-nosic-thule-wingbar-evo-skoda-octavia",
	description: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Sada na pozdĺžniky." } }] }),
	seoTitle: null,
	seoDescription: null,
	translation: null,
	thumbnail: null,
	media: [
		{ id: "m1", url: "https://media.maky.store/a.jpg?v=1&w=2", type: "IMAGE", sortOrder: 0, alt: "" },
		{ id: "m2", url: "https://media.maky.store/b.jpg", type: "IMAGE", sortOrder: 1, alt: "" },
	],
	category: { id: "C1", name: "Strešné nosiče", slug: "stresne-nosice", translation: null },
	attributes: [
		{
			attribute: {
				name: "Výrobca",
				slug: "manufacturer",
				externalReference: "cfm:attribute:manufacturer",
				translation: null,
			},
			values: [{ name: "Thule", slug: "thule", translation: null }],
		},
	],
	variants: [
		{
			id: "V1",
			name: "711300|710410|145123",
			componentEans: JSON.stringify([{ code: "711300", role: "bars", ean: "7313020079820", qty: 1 }]),
			quantityAvailable: 50,
			trackInventory: false,
			metafield: "sale_to_order",
			weight: { value: 6.2, unit: "KG" },
			selectionAttributes: [],
			nonSelectionAttributes: [],
			media: [],
			pricing: {
				price: { gross: { amount: 349.9, currency: "EUR" } },
				priceUndiscounted: { gross: { amount: 389, currency: "EUR" } },
			},
		},
	],
	pricing: { priceRange: { start: { gross: { amount: 349.9, currency: "EUR" } }, stop: null } },
};

beforeEach(() => {
	process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://maky.store";
	executePublicGraphQL.mockReset().mockResolvedValue({
		ok: true,
		data: { products: { edges: [{ node: set }], pageInfo: { hasNextPage: false, endCursor: null } } },
	});
});

describe("what the shop answers is what the writer writes", () => {
	it("a roof-rack set arrives in the file with every field the shop stated", async () => {
		const result = await readFeedPage("sk", null);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// As it travels: through JSON, as the route sends it.
		const [item] = JSON.parse(JSON.stringify(result.page.items)) as unknown[];
		expect(isItem(item)).toBe(true);

		const xml = renderItem(item, { now: new Date("2026-11-16T05:05:00Z") });
		expect(xml.split("\n")).toEqual([
			"<item>",
			"<g:id>V1</g:id>",
			"<g:title>Strešný nosič Thule WingBar Evo &lt;Škoda Octavia&gt;</g:title>",
			"<g:description>Sada na pozdĺžniky.</g:description>",
			"<g:link>https://maky.store/sk/stresny-nosic-thule-wingbar-evo-skoda-octavia</g:link>",
			"<g:image_link>https://media.maky.store/a.jpg?v=1&amp;w=2</g:image_link>",
			"<g:additional_image_link>https://media.maky.store/b.jpg</g:additional_image_link>",
			"<g:availability>backorder</g:availability>",
			"<g:availability_date>2026-11-30T00:00Z</g:availability_date>",
			"<g:price>389.00 EUR</g:price>",
			"<g:sale_price>349.90 EUR</g:sale_price>",
			"<g:brand>Thule</g:brand>",
			"<g:gtin>7313020079820</g:gtin>",
			"<g:is_bundle>yes</g:is_bundle>",
			"<g:condition>new</g:condition>",
			"<g:shipping_weight>6.2 kg</g:shipping_weight>",
			"<g:product_type>Strešné nosiče</g:product_type>",
			"</item>",
			"",
		]);
	});
});
