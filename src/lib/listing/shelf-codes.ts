import { cacheLife, cacheTag } from "next/cache";
import { CategoryProductCodesDocument, type CategoryProductCodesQuery } from "@/gql/graphql";
import { getLocaleFromChannel } from "@/config/locale";
import { settle, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { executePublicGraphQL } from "@/lib/graphql";
import { publicProductCode } from "@/lib/product-code";

/**
 * Which Saleor product carries which public code, for the products a shelf lists in a channel.
 *
 * A shelf whose products are chosen by a fact the shopper gave (the snow-chain shelf, by tyre size) needs the other
 * way round from the card: the sealed list says which CODES fit a size, and Saleor's `filter: { ids }` wants product
 * ids. This is the map between them, read from the shop itself, so it names exactly the products the shop lists in
 * this channel: a hidden, unpublished or unavailable product is not returned by Saleor and is not here, so a
 * narrowed list can never promise a product the shop is not selling.
 *
 * The code is the one the card and the product page print (`publicProductCode` of the product's one variant), never
 * the SKU. A product with several variants, or whose variant name is not a code, is not on the map: it is not one of
 * the size-controlled products, and a listing that did not find it simply leaves it out of a NARROWED list.
 *
 * Read whole in at most `READ_ALL_LIMIT` products (the shelf holds about 150): above that the map is not offered and
 * the listing is not narrowed. Like the price bands and the facets it describes the category, not the page, so one
 * cached answer serves every visit and is renewed with the category (same tag).
 */

export interface ShelfCode {
	readonly code: string;
	readonly productId: string;
	/** The product's page, for a link to "the size you need" from another size of the same model. */
	readonly slug: string;
}

const READ_ALL_LIMIT = 600;
const PAGE = 100;
/** The map decides whether a list is narrowed; it never holds the listing up for long. */
const DEADLINE_MS = 2_000;

type Node = NonNullable<
	NonNullable<CategoryProductCodesQuery["category"]>["products"]
>["edges"][number]["node"];

/** Pure half of `getShelfCodes`, exported for its test. */
export function shelfCodesFromNodes(nodes: readonly Node[]): ShelfCode[] {
	const codes: ShelfCode[] = [];
	for (const node of nodes) {
		const variants = node.variants ?? [];
		// Exactly one variant, as the listing card requires before it names a code (`transformToProductCard`).
		if (variants.length !== 1) continue;
		const code = publicProductCode(variants[0]);
		if (code) codes.push({ code, productId: node.id, slug: node.slug });
	}
	return codes;
}

/**
 * Throws on a fault to the caller: an outage must not become "nothing fits" for minutes. Inside the cache it is a
 * value that is remembered for seconds only (`@/lib/cache-fault`).
 */
export async function getShelfCodes(baseSlug: string, channel: string): Promise<ShelfCode[] | null> {
	return valueOrThrow(await readShelfCodes(baseSlug, channel));
}

async function readShelfCodes(baseSlug: string, channel: string): Promise<CachedRead<ShelfCode[] | null>> {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	cacheLife(CACHE_PROFILES.categories.cacheProfile);
	cacheTag(buildTag(CACHE_PROFILES.categories, { channel, locale, slug: baseSlug }));

	return settle(() => computeShelfCodes(baseSlug, channel));
}

async function computeShelfCodes(baseSlug: string, channel: string): Promise<ShelfCode[] | null> {
	const read = async (after: string | null) => {
		const result = await executePublicGraphQL(CategoryProductCodesDocument, {
			variables: { slug: baseSlug, channel, first: PAGE, after },
			revalidate: 0,
			retry: false,
			signal: AbortSignal.timeout(DEADLINE_MS),
		});
		if (!result.ok)
			throw new Error(`[Listing] product codes unavailable for ${baseSlug}: ${result.error.message}`);
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
	return shelfCodesFromNodes(nodes);
}
