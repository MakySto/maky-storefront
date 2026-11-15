import "server-only";

import { saleorSlugFor } from "@/config/category-routes";
import { TYRE_SHELF_SLUG } from "@/config/tyre-shelves";
import { CategoryProductOffersDocument, type CategoryProductOffersQuery } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { publicProductCode } from "@/lib/product-code";
import { publishableProductImage } from "@/lib/product-image";
import { tyreFamilyPageOf, type TyreFamilyPage } from "./size-pages";

/**
 * The snow-chain shelf by model: one card per family, with how many of its sizes the channel sells and the lowest
 * price among them.
 *
 * The shelf lists 145 products, and nearly all of them are one of thirteen models in another size, so its first page
 * was twelve cards of one model. This is the overview above them. The family a product belongs to comes from the
 * sealed family file by the product's public code; the count, the price and the photograph are the channel's own, read
 * from Saleor and renewed every five minutes like the listing beside it.
 *
 * A family the channel sells nothing of has no card. A product without a price (not purchasable in the channel) is
 * not counted: a card that says "from" must be able to say from what.
 */

export interface TyreFamilyCard {
	readonly page: TyreFamilyPage;
	/** How many of the family's products the channel sells. */
	readonly count: number;
	/** The lowest price among them. */
	readonly price: number;
	readonly currency: string;
	/** The photograph of the cheapest product that has one, or `null`. */
	readonly image: string | null;
}

type Node = NonNullable<
	NonNullable<CategoryProductOffersQuery["category"]>["products"]
>["edges"][number]["node"];

const PAGE = 100;
/** The shelf holds 145. Far above that this is not the shelf it was written for, and the overview is left out. */
const READ_ALL_LIMIT = 600;

/** Pure half of `readTyreFamilyCards`, exported for its test. Chains first, then socks; the cheapest first. */
export function familyCardsFromNodes(nodes: readonly Node[]): TyreFamilyCard[] {
	const cards = new Map<string, TyreFamilyCard>();
	for (const node of nodes) {
		const variants = node.variants ?? [];
		// Exactly one variant, as the listing card requires before it names a code.
		if (variants.length !== 1) continue;
		const page = tyreFamilyPageOf(publicProductCode(variants[0]));
		const gross = node.pricing?.priceRange?.start?.gross;
		if (!page || !gross) continue;
		const image = publishableProductImage(node.thumbnail?.url) ?? null;
		const known = cards.get(page.key);
		if (!known) {
			cards.set(page.key, { page, count: 1, price: gross.amount, currency: gross.currency, image });
			continue;
		}
		const cheaper = gross.amount < known.price;
		cards.set(page.key, {
			...known,
			count: known.count + 1,
			price: cheaper ? gross.amount : known.price,
			currency: cheaper ? gross.currency : known.currency,
			image: (cheaper ? image : null) ?? known.image ?? image,
		});
	}
	return [...cards.values()].sort(
		(a, b) =>
			Number(a.page.product === "sock") - Number(b.page.product === "sock") ||
			a.price - b.price ||
			a.page.key.localeCompare(b.page.key),
	);
}

/**
 * The family cards of a channel. Throws when the shop cannot be asked; `null` when the shelf is not the one this was
 * written for. The caller decides what a fault costs (the shelf simply shows no overview).
 */
export async function readTyreFamilyCards(channel: string): Promise<TyreFamilyCard[] | null> {
	const slug = saleorSlugFor(TYRE_SHELF_SLUG);
	const read = async (after: string | null) => {
		const result = await executePublicGraphQL(CategoryProductOffersDocument, {
			variables: { slug, channel, first: PAGE, after },
			revalidate: 300,
		});
		if (!result.ok) throw new Error(`[tyre-pages] family offers unavailable: ${result.error.message}`);
		return result.data.category?.products ?? null;
	};

	let page = await read(null);
	if (!page || (page.totalCount ?? 0) > READ_ALL_LIMIT) return null;
	const nodes: Node[] = page.edges.map(({ node }) => node);
	while (page.pageInfo.hasNextPage) {
		const next = await read(page.pageInfo.endCursor ?? null);
		if (!next) break;
		nodes.push(...next.edges.map(({ node }) => node));
		page = next;
	}
	return familyCardsFromNodes(nodes);
}
