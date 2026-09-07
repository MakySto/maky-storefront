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
 * Four properties this has to keep, and each was a way to lie to a shopper:
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
 *
 *   - **It only answers for a shelf the programme assessed.** Requiring `?vehicle=1` was
 *     not enough, because the control that sets it was offered on every listing. Measured
 *     on production 2026-09-07 with a saved ŠKODA Octavia Combi NX: roof boxes 101 → 0,
 *     bike carriers 188 → 0, ski carriers 26 → 0, roof tents 9 → 0, car fridges 7 → 0,
 *     each headed "Zobrazujeme iba produkty overené pre ŠKODA Octavia Combi NX" — and
 *     with no softening line, because a non-empty id list means the state is `active`,
 *     not `empty`. Those listings were intersected with roof RACK ids. `FitmentScope` in
 *     the contract already forbade exactly this: coverage of one kind "does NOT license
 *     the sentence 'nothing fits your Škoda', which would also deny every roof box".
 *     A listing whose kind the dataset does not cover is now `out-of-scope`: not
 *     narrowed, and not spoken about.
 */

import { CONFIGURATOR_PRODUCT_KIND, type FitmentDataset, type FitmentVerdict } from "./contract";
import { loadFitmentDataset } from "./provider";
import { resolveVehicleOutcome } from "./resolve";
import { isDemoDataset } from "./offers";
import { categoryFitmentKind } from "@/config/categories";
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

/**
 * Is this string shaped like a Saleor product global id?
 *
 * The listing query is not forgiving. A malformed entry in `filter: { ids }` makes Saleor
 * answer `{"ids": [{"message": "Invalid ID specified."}]}` for the WHOLE query, and
 * `/{market}/products` treats a failed listing as an error and throws — correctly, since
 * that page cannot be missing. So one bad id from the fitment provider would take the
 * market's main listing down, and the configurator's own path only survives it because a
 * failed batch there degrades to "we could not load the offer".
 *
 * Externally-supplied identifiers are validated before they reach a query that can fail a
 * page. Anything that is not a base64 `Product:<pk>` is dropped and logged rather than
 * forwarded.
 */
export function isSaleorProductId(id: string): boolean {
	try {
		const decoded = Buffer.from(id, "base64").toString("utf8");
		// Re-encoding must round-trip: `Buffer.from` accepts almost anything as base64
		// and silently discards what it cannot read.
		return /^Product:.+$/.test(decoded) && Buffer.from(decoded, "utf8").toString("base64") === id;
	} catch {
		return false;
	}
}

export type VehicleListingFilter =
	/** No compatibility data on this deployment. The listing shows nothing about vehicles. */
	| { state: "unavailable" }
	/** A dataset, but no usable saved car. The listing is NOT narrowed. */
	| { state: "no-vehicle"; requested: boolean }
	/** This listing holds a kind the programme never assessed. Say nothing, narrow nothing. */
	| { state: "out-of-scope" }
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
/**
 * Which shelf the shopper is standing in front of.
 *
 * `categorySlug` absent means the listing is not one category — `/{market}/products` and
 * collections. Those are left as they were: the whole catalogue really does contain the
 * verified sets, so narrowing it is a true statement.
 */
export type VehicleListingScope = { categorySlug?: string };

/**
 * Does the programme make any claim about the shelf this listing is showing?
 *
 * Both halves have to agree. The category says what is on the shelf; the dataset says
 * which kinds it speaks for. The filter may only narrow where they meet — which is why
 * this reads `coverage.scope.productKinds` rather than comparing against
 * `CONFIGURATOR_PRODUCT_KIND`: if CFM ever ships roof boxes, the boxes listing starts
 * working with no storefront change, and if it stops shipping racks, the rack listing
 * stops claiming.
 */
function coversThisListing(dataset: FitmentDataset, scope: VehicleListingScope): boolean {
	if (!scope.categorySlug) return true;
	const kind = categoryFitmentKind(scope.categorySlug);
	return kind !== null && dataset.coverage.scope.productKinds.includes(kind);
}

export async function resolveVehicleListingFilter(
	requested: boolean,
	scope: VehicleListingScope = {},
): Promise<VehicleListingFilter> {
	try {
		const { dataset } = await loadFitmentDataset();
		if (!dataset) return { state: "unavailable" };

		// Before the garage, before `requested`: on a shelf we never assessed there is no
		// question to ask, so there is nothing to offer and nothing to explain either.
		if (!coversThisListing(dataset, scope)) return { state: "out-of-scope" };

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

		// A demo dataset names nothing real — its ids belong to its own catalogue, which
		// is exactly what stops it borrowing a real product's photograph and price. So it
		// can never narrow a listing of real products to anything, and saying "nothing is
		// verified for this car" is both true and the only safe answer.
		if (isDemo) return { state: "empty", vehicleLabel, isDemo };

		// De-duplicated: one product can be verified through several application rows.
		const candidates = [...new Set(outcome.verified.map((o) => o.ref.saleorProductId))];
		const productIds = candidates.filter(isSaleorProductId);
		if (productIds.length < candidates.length) {
			console.error(
				`[fitment] dropped ${
					candidates.length - productIds.length
				} malformed Saleor product id(s) from the listing filter`,
			);
		}
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
