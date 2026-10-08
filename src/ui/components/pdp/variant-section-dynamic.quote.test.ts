import { readFileSync } from "node:fs";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { AddToCart } from "./add-to-cart";
import { PurchaseTrust } from "./purchase-trust";
import { StickyBar } from "./sticky-bar";
import { VariantSectionDynamic } from "./variant-section-dynamic";

/**
 * What the product page hands the purchase block, for a product the shop shows but cannot sell in the market.
 *
 * The page used to pass the sentence "not available to order" down as the availability line, and the block
 * said it again twice (owner, 2026-10-08, a car fridge in the United States). Now the page hands the block
 * where to ask for a quote, and no availability line, and leaves out the two things that only make sense
 * beside a buy button: the sticky bar and the strip of purchase assurances. A product that can be ordered is
 * handed none of this.
 */

const load = (locale: string): Record<string, unknown> =>
	JSON.parse(readFileSync(path.join(process.cwd(), `src/i18n/messages/${locale}.json`), "utf8")) as Record<
		string,
		unknown
	>;

vi.mock("next-intl/server", () => ({
	getTranslations: async (options: { locale: string; namespace?: string }) =>
		createTranslator({
			locale: options.locale,
			messages: load(options.locale) as never,
			namespace: options.namespace as never,
		}),
}));
// Neither is part of what is asked here, and both reach for the request (cookies) or the server (actions).
vi.mock("@/ui/components/plp/actions", () => ({ addVariantToCart: vi.fn() }));
vi.mock("@/ui/components/fitment/pdp-compatibility", () => ({ PdpCompatibility: () => null }));

type Product = Parameters<typeof VariantSectionDynamic>[0]["product"];

const NAME = "PRO-USER CoolZ 83 l";
const REFERENCE = `${NAME} (TK20410)`;

const gross = { gross: { amount: 549, currency: "USD" } };

/** A product as the page's query returns it, with only what the section reads. */
const productOf = (options: { purchasable: boolean; variantName?: string }): Product =>
	({
		id: "UHJvZHVjdDox",
		name: NAME,
		slug: "pro-user-coolz-83-l",
		isAvailableForPurchase: options.purchasable,
		category: { name: "Car fridges" },
		attributes: [],
		pricing: { priceRange: { start: gross, stop: gross } },
		variants: [
			{
				id: "UHJvZHVjdFZhcmlhbnQ6MQ==",
				name: options.variantName ?? "TK20410",
				// The internal identifier: it must never reach a link a visitor can read.
				sku: `${options.variantName ?? "TK20410"}|CFMP-B-NOR-57acce2f8ef56b-000000`,
				quantityAvailable: 50,
				trackInventory: true,
				metafield: null,
				selectionAttributes: [],
				nonSelectionAttributes: [],
				pricing: { price: gross, priceUndiscounted: gross },
			},
		],
	}) as unknown as Product;

function* walk(node: ReactNode): Generator<ReactElement> {
	if (Array.isArray(node)) {
		for (const child of node) yield* walk(child as ReactNode);
		return;
	}
	if (!isValidElement(node)) return;
	yield node;
	yield* walk((node.props as { children?: ReactNode }).children);
}

const section = async (channel: string, product: Product): Promise<ReactNode> =>
	VariantSectionDynamic({ product, channel, searchParams: Promise.resolve({}) });

const elementsOf = (tree: ReactNode, type: unknown): ReactElement[] =>
	[...walk(tree)].filter((element) => element.type === type);

type PurchaseProps = {
	quoteHref?: string;
	disabled?: boolean;
	disabledReason?: string;
	availability?: ReactNode;
};
const purchaseProps = (tree: ReactNode): PurchaseProps => {
	const [block, ...rest] = elementsOf(tree, AddToCart);
	expect(rest, "one purchase block").toHaveLength(0);
	return (block as ReactElement<PurchaseProps>).props;
};

describe("a product that cannot be ordered in the market", () => {
	it("is handed a quote link to its market's contact page, with its name and public code", async () => {
		for (const [market, row] of Object.entries(CHANNEL_MAP)) {
			const tree = await section(row.saleorSlug, productOf({ purchasable: false }));
			const props = purchaseProps(tree);
			expect(props.quoteHref, market).toBe(`/${market}/kontakt#quote=${encodeURIComponent(REFERENCE)}`);
			expect(props.disabled, market).toBe(true);
			expect(props.disabledReason, market).toBe("unavailable");
		}
	});

	it("is handed no availability line, so that the sentence is said once, by the block", async () => {
		const props = purchaseProps(await section(CHANNEL_MAP.us.saleorSlug, productOf({ purchasable: false })));
		expect(props.availability).toBeUndefined();
	});

	it("leaves out the sticky bar and the purchase assurances, which belong beside a buy button", async () => {
		const tree = await section(CHANNEL_MAP.us.saleorSlug, productOf({ purchasable: false }));
		expect(elementsOf(tree, StickyBar)).toHaveLength(0);
		expect(elementsOf(tree, PurchaseTrust)).toHaveLength(0);
	});

	it("never puts the internal identifier into the link", async () => {
		const props = purchaseProps(await section(CHANNEL_MAP.us.saleorSlug, productOf({ purchasable: false })));
		expect(props.quoteHref).not.toMatch(/CFMP/i);
		expect(decodeURIComponent(props.quoteHref ?? "")).not.toContain("|");
	});

	it("names the product alone where the variant's name is not a code", async () => {
		// "Black" is a label, not a code: `publicProductCode` shows nothing for it, and so does the link.
		const props = purchaseProps(
			await section(CHANNEL_MAP.us.saleorSlug, productOf({ purchasable: false, variantName: "Black" })),
		);
		expect(props.quoteHref).toBe(`/us/kontakt#quote=${encodeURIComponent(NAME)}`);
	});
});

describe("a product that can be ordered", () => {
	it("is handed no quote link, and keeps its availability line, sticky bar and assurances", async () => {
		const tree = await section(CHANNEL_MAP.us.saleorSlug, productOf({ purchasable: true }));
		const props = purchaseProps(tree);
		expect(props.quoteHref).toBeUndefined();
		expect(props.disabled).toBe(false);
		expect(props.disabledReason).toBeUndefined();
		expect(props.availability).toBeDefined();
		expect(elementsOf(tree, StickyBar)).toHaveLength(1);
		expect(elementsOf(tree, PurchaseTrust)).toHaveLength(1);
	});
});
