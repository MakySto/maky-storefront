import { cacheLife, cacheTag } from "next/cache";
import { ListingProductTypesDocument } from "@/gql/graphql";
import { ACCESSORY_PRODUCT_TYPE_SLUG } from "@/config/categories";
import { executePublicGraphQL } from "@/lib/graphql";

/**
 * The two groups a category listing's recommended order is built from, as Saleor product
 * type ids: the products a shopper came for (`main`) and the accessories and spare parts
 * that go with them (`accessories`).
 *
 * `main` is every type except the accessory one, so the two lists partition the catalogue
 * as it was when they were read. A type created after that is in neither list; the listing
 * checks the counts add up before it trusts the split (`grouped-listing.ts`).
 */
export interface ProductTypeGroups {
	readonly main: readonly string[];
	readonly accessories: readonly string[];
}

export const PRODUCT_TYPES_CACHE_TAG = "product-types";

/**
 * The split, or `null` when Saleor offers none to make: no type with the accessory slug, no
 * other type beside it, or more types than one page holds (a partial list would silently
 * leave products out of both groups).
 *
 * Throws on a fault, so an outage is never cached as "no groups" for hours.
 */
export async function getProductTypeGroups(): Promise<ProductTypeGroups | null> {
	"use cache";
	// Product types change when the catalogue model changes, not with the stock.
	cacheLife("hours");
	cacheTag(PRODUCT_TYPES_CACHE_TAG);

	const result = await executePublicGraphQL(ListingProductTypesDocument, { revalidate: 3600 });
	if (!result.ok) {
		throw new Error(`[Listing] product types unavailable: ${result.error.message}`);
	}
	return splitProductTypes(result.data.productTypes);
}

type ProductTypeConnection =
	| {
			pageInfo: { hasNextPage: boolean };
			edges: ReadonlyArray<{ node: { id: string; slug: string } }>;
	  }
	| null
	| undefined;

/** Pure half of `getProductTypeGroups`, exported for its test. */
export function splitProductTypes(connection: ProductTypeConnection): ProductTypeGroups | null {
	if (!connection || connection.pageInfo.hasNextPage) return null;

	const main: string[] = [];
	const accessories: string[] = [];
	for (const { node } of connection.edges) {
		(node.slug === ACCESSORY_PRODUCT_TYPE_SLUG ? accessories : main).push(node.id);
	}
	return main.length > 0 && accessories.length > 0 ? { main, accessories } : null;
}
