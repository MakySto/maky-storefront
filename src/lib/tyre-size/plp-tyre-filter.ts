import "server-only";

import { saleorSlugFor } from "@/config/category-routes";
import { isTyreShelf } from "@/config/tyre-shelves";
import { NO_PRODUCTS_SENTINEL_ID } from "@/lib/fitment/plp-vehicle-filter";
import { getShelfCodes } from "@/lib/listing/shelf-codes";
import type { TyreFilterRequest } from "./listing-param";
import { readRememberedTyreSize } from "./remembered";
import { tyreSizeEntries } from "./size-lookup";

/**
 * "Show me only what fits my tyres" on the snow-chain listing.
 *
 * The same idea as the car filter on a roof-rack shelf (`lib/fitment/plp-vehicle-filter`), for a different fact: the
 * shopper gave the shop a tyre size once (`lib/tyre-size/memory`), the sealed list says which codes fit it
 * (`size-lookup`), and the codes are turned into the Saleor products the shop actually lists (`listing/shelf-codes`),
 * which `filter: { ids }` then narrows the listing to. Saleor does the ordering, the counting and the paging over the
 * whole set; no page is stitched together here.
 *
 * Properties this keeps, each of them a way to lie to a shopper:
 *
 *   - **An empty candidate set never reaches Saleor.** `filter: { ids: [] }` returns the whole catalogue, not nothing
 *     (measured live, see the car filter). `empty` is its own state, spelled out loud with the sentinel id.
 *   - **It narrows by itself only where that is a true statement, and says so.** On the shelf a shopper with a
 *     remembered size sees what fits it by default, but only when that yields something: a size nothing on the shelf
 *     lists leaves the shelf whole and says why, never a dead end the shopper did not ask for. `?tyres=0` is the
 *     shopper's explicit "all chains" and nothing overrides it; `?tyres=1` asked for the narrowed list and, when it is
 *     empty, gets its own panel.
 *   - **It only answers for the shelf the sizes belong to** (`config/tyre-shelves`). Anywhere else there is no
 *     question to ask and nothing to say.
 *   - **It does not guess when the shop cannot be asked.** If the shop's list of products cannot be read the listing is
 *     NOT narrowed and the filter says nothing: an empty or short list is a claim that nothing else fits, and that is
 *     the one thing not known then. The cards still carry their own verdicts (`card-fit`).
 *   - **It names what is on sale and nothing else.** The ids come from what Saleor lists in this channel, so a hidden,
 *     unpublished or unavailable product is not in the narrowed list, and "not on sale" needs no state of its own.
 *
 * Never throws: a listing is a page that sells things, and it must not go down because the narrowing could not be done.
 */
export type TyreListingFilter =
	/** Not the shelf the tyre sizes belong to. The listing shows nothing about tyres. */
	| { state: "out-of-scope" }
	/**
	 * The shop's products could not be read (`size`: the remembered size, when it was read first). The listing is NOT
	 * narrowed and nothing is said about narrowing; the cards still carry their own verdicts for `size`.
	 */
	| { state: "unavailable"; size: string | null }
	/** No size remembered. The listing is NOT narrowed; `requested` says the shopper asked for the narrowed list. */
	| { state: "no-size"; requested: boolean }
	/**
	 * A size, and the listing is NOT narrowed. `all`: the shopper chose all chains. `none-fit`: nothing the shop lists
	 * fits this size, so the shelf stays whole instead of ending in a panel nobody asked for.
	 */
	| { state: "offered"; size: string; reason: "all" | "none-fit" }
	/** Asked for and answered: nothing the shop lists fits this size. */
	| { state: "empty"; size: string }
	/** Narrowed to the products whose list holds this size. `productIds` is non-empty by construction. */
	| { state: "active"; size: string; productIds: string[] };

export type TyreListingScope = { categorySlug?: string; channel: string };

export async function resolveTyreListingFilter(
	request: TyreFilterRequest,
	scope: TyreListingScope,
): Promise<TyreListingFilter> {
	try {
		const baseSlug = scope.categorySlug;
		if (!baseSlug || !isTyreShelf(baseSlug)) return { state: "out-of-scope" };

		const size = await readRememberedTyreSize();
		if (!size) return { state: "no-size", requested: request === "tyres" };

		// `?tyres=0` is the shopper's own word and nothing below may override it.
		if (request === "all") return { state: "offered", size, reason: "all" };
		// A DEFAULT answer that is not a list must not be a dead end the shopper never asked for: it leaves the shelf
		// whole and says so. The same answer to an explicit `?tyres=1` keeps its own panel.
		const byDefault = request === "default";

		const codes = await getShelfCodes(saleorSlugFor(baseSlug), scope.channel);
		if (!codes) return { state: "unavailable", size };

		const fitting = new Set(tyreSizeEntries(size).map((entry) => entry.code));
		// De-duplicated: the same product is on the map once, but a code is not promised to be unique.
		const productIds = [...new Set(codes.filter(({ code }) => fitting.has(code)).map((c) => c.productId))];
		if (productIds.length === 0) {
			return byDefault ? { state: "offered", size, reason: "none-fit" } : { state: "empty", size };
		}
		return { state: "active", size, productIds };
	} catch (error) {
		console.error("[tyres] listing filter failed:", error);
		return { state: "unavailable", size: await readRememberedTyreSize().catch(() => null) };
	}
}

/**
 * The ids to hand `buildFilterVariables`, or undefined to leave the listing alone.
 *
 * Only two states narrow anything. `unavailable` and `no-size` deliberately do NOT: a shopper who asked for their size
 * and got "we cannot tell you right now" must see the unnarrowed listing, never an empty one.
 */
export function tyreFilterIds(filter: TyreListingFilter): string[] | undefined {
	if (filter.state === "active") return filter.productIds;
	if (filter.state === "empty") return [NO_PRODUCTS_SENTINEL_ID];
	return undefined;
}

/** The size the shopper gave, when this filter knows it — what the cards' verdicts are about. */
export function tyreFilterSize(filter: TyreListingFilter): string | null {
	return "size" in filter ? filter.size : null;
}
