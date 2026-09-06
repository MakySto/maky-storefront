import "server-only";

/**
 * "Show me only what fits my car" on a product listing.
 *
 * The path is CFM fitment → Saleor product ids → `filter: { ids }`, and it is the only
 * one available: the eight `vehicle-*` / `roof-type` / `bar-*` attribute slugs the PLP
 * filter whitelists DO NOT EXIST in this Saleor instance. Filtering on them returns
 * `totalCount: 0` rather than an error, so that route fails silently and looks like an
 * empty catalogue.
 *
 * Three properties this has to keep, and each was a way to lie to a shopper:
 *
 *   - **The candidate set is never truncated.** `first: 100` is Saleor's page-size cap,
 *     not a filter cap: measured live against api.maky.store, `filter: { ids }` with 250
 *     ids answers `totalCount: 250` and pages correctly. So every verified id goes in,
 *     Saleor does the ordering, counting and paging over the whole set, and no page is
 *     assembled by stitching separately-sorted batches together.
 *
 *   - **An empty candidate set never reaches Saleor.** `filter: { ids: [] }` does not
 *     return nothing — measured live, it returns the ENTIRE catalogue, all 9 606
 *     products. A listing headed "products for your vehicle" showing the whole shop is
 *     the worst outcome this feature has available to it, so `empty` is its own state
 *     and the query is not run at all.
 *
 *   - **It only ever narrows on request.** A saved car must not quietly empty a listing
 *     of snow chains, and the fitment programme covers exactly one product kind. The
 *     filter is off unless the URL says `?vehicle=1`.
 */

import { CONFIGURATOR_PRODUCT_KIND, type FitmentVerdict } from "./contract";
import { loadFitmentDataset } from "./provider";
import { resolveVehicleOutcome } from "./resolve";
import { isDemoDataset } from "./offers";
import { vehicleDisplayName } from "../garage/label";
import { readGarage } from "../garage/state";

/** The URL contract. One param, one value — an explicit, linkable, clearable state. */
export const VEHICLE_FILTER_PARAM = "vehicle";
export const VEHICLE_FILTER_VALUE = "1";

/**
 * A well-formed global id for `Product:-1`, which cannot exist — Saleor's primary keys
 * are positive. It is how "match nothing" is said out loud.
 *
 * It exists because the two obvious ways to express an empty result are both wrong here.
 * `filter: { ids: [] }` returns the whole catalogue (measured live). Skipping the query
 * would skip the category and collection existence checks with it, so
 * `/sk/categories/does-not-exist?vehicle=1` would answer 200 with an empty listing
 * instead of 404. Measured live: this id yields `totalCount: 0` and the category itself
 * still resolves.
 */
export const NO_PRODUCTS_SENTINEL_ID = "UHJvZHVjdDotMQ==";

export type VehicleListingFilter =
	/** No compatibility data on this deployment. The listing shows nothing about vehicles. */
	| { state: "unavailable" }
	/** A dataset, but no usable saved car. The listing is NOT narrowed. */
	| { state: "no-vehicle"; requested: boolean }
	/** A saved car, and the filter is available but not applied. */
	| { state: "offered"; vehicleLabel: string | null }
	/** Requested, but the dataset cannot answer for THIS car. The listing is NOT narrowed. */
	| { state: "unanswerable"; vehicleLabel: string | null; verdict: FitmentVerdict | null }
	/** Requested and answered: nothing in the programme is verified for this car. */
	| { state: "empty"; vehicleLabel: string | null; isDemo: boolean }
	/** Requested and answered. `productIds` is non-empty by construction. */
	| {
			state: "active";
			vehicleLabel: string | null;
			productIds: string[];
			isDemo: boolean;
	  };

export function isVehicleFilterRequested(value: string | string[] | undefined): boolean {
	const raw = Array.isArray(value) ? value[0] : value;
	return raw === VEHICLE_FILTER_VALUE;
}

/**
 * Build the listing's vehicle filter for this request.
 *
 * Resolved on EVERY listing request, not only when `?vehicle=1` is present: a filter a
 * shopper can only reach by hand-editing the URL is not a feature. `requested` decides
 * whether the ids are applied, never whether the question is asked.
 *
 * Only VERIFIED sets become ids. An unconfirmed, provisional or disputed row is not a
 * narrower listing, it is a claim we have not earned — `resolveVehicleOutcome` already
 * separates the three, and only the first is used here.
 *
 * Never throws: a listing is a page that sells things, and it must not go down because
 * the compatibility provider did.
 */
export async function resolveVehicleListingFilter(requested: boolean): Promise<VehicleListingFilter> {
	try {
		const { dataset } = await loadFitmentDataset();
		if (!dataset) return { state: "unavailable" };

		const garage = await readGarage(dataset);
		const active = garage.active && !garage.active.unresolved ? garage.active : null;
		if (!active) return { state: "no-vehicle", requested };

		const vehicleLabel = vehicleDisplayName(active);
		if (!requested) return { state: "offered", vehicleLabel };

		const isDemo = isDemoDataset(dataset);
		const outcome = resolveVehicleOutcome(dataset, active.selection, { kind: CONFIGURATOR_PRODUCT_KIND });
		if (outcome.unanswerable) {
			return { state: "unanswerable", vehicleLabel, verdict: outcome.unanswerableVerdict };
		}

		// De-duplicated: one product can be verified through several application rows.
		const productIds = [...new Set(outcome.verified.map((o) => o.ref.saleorProductId))];
		if (productIds.length === 0) return { state: "empty", vehicleLabel, isDemo };

		return { state: "active", vehicleLabel, productIds, isDemo };
	} catch (error) {
		console.error("[fitment] listing vehicle filter failed:", error);
		return { state: "unavailable" };
	}
}

/**
 * The ids to hand `buildFilterVariables`, or undefined to leave the listing alone.
 *
 * Only two states narrow anything. `unanswerable` and `no-vehicle` deliberately do NOT:
 * a shopper who asked for their car and got "we cannot tell you right now" must see the
 * unnarrowed listing with an explanation, never an empty one — an empty listing is a
 * claim that nothing fits, and that is the one thing we do not know.
 */
export function vehicleFilterIds(filter: VehicleListingFilter): string[] | undefined {
	if (filter.state === "active") return filter.productIds;
	if (filter.state === "empty") return [NO_PRODUCTS_SENTINEL_ID];
	return undefined;
}

/**
 * The href that turns the filter on or off, with the cursor dropped.
 *
 * Dropping `cursor`/`direction` is not tidiness. A cursor is a position in ONE ordered
 * result set; carrying it across a change of filter asks Saleor to continue from a row
 * that is no longer in the list, and the shopper lands on an arbitrary page or an empty
 * one. Sorting and price survive, because those are still the shopper's choices.
 */
export function vehicleFilterHref(
	basePath: string,
	searchParams: Record<string, string | string[] | undefined>,
	enable: boolean,
): string {
	const next = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		if (key === VEHICLE_FILTER_PARAM || key === "cursor" || key === "direction") continue;
		if (value === undefined) continue;
		for (const one of Array.isArray(value) ? value : [value]) next.append(key, one);
	}
	if (enable) next.set(VEHICLE_FILTER_PARAM, VEHICLE_FILTER_VALUE);
	const query = next.toString();
	return query ? `${basePath}?${query}` : basePath;
}
