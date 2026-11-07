/**
 * "Show me only what fits my tyres" on a snow-chain listing: the URL contract.
 *
 * The same shape as the vehicle filter's (`lib/fitment/plp-vehicle-filter.ts`), so a shopper who has met one knows
 * the other, and so the state is a link that can be sent on:
 *
 *   `?tyres=1`   "for my tyres", asked for
 *   `?tyres=0`   "all chains", asked for: wins over every default
 *   (absent)     the default: for my tyres when a size is remembered and that has an answer, the whole shelf otherwise
 *   `&tyreSize=205%2F55+R16`  the size the link is about (optional; the remembered size answers without it)
 *
 * No I/O and nothing server-only, so the selector sheet (client) and the listing (server) read one definition.
 */
export const TYRE_FILTER_PARAM = "tyres";
export const TYRE_FILTER_VALUE = "1";
export const TYRE_FILTER_OFF_VALUE = "0";
/**
 * The size the link is about, so that a link sent to someone else shows THEIR screen the same list instead of whatever
 * size they happen to have remembered. Absent: the remembered size answers, as before.
 */
export const TYRE_SIZE_PARAM = "tyreSize";

/** The raw `?tyreSize=` text, or `undefined`. Matched to the lists by the reader (`plp-tyre-filter`), never trusted here. */
export function tyreSizeParamOf(value: string | string[] | undefined): string | undefined {
	const raw = Array.isArray(value) ? value[0] : value;
	return typeof raw === "string" && raw.trim() !== "" && raw.length <= 40 ? raw : undefined;
}

/** What the URL asked for, before anything is known about the size or the shelf. */
export type TyreFilterRequest = "tyres" | "all" | "default";

export function tyreFilterRequestOf(value: string | string[] | undefined): TyreFilterRequest {
	const raw = Array.isArray(value) ? value[0] : value;
	if (raw === TYRE_FILTER_VALUE) return "tyres";
	if (raw === TYRE_FILTER_OFF_VALUE) return "all";
	return "default";
}

/**
 * The href that selects a mode, with the cursor dropped.
 *
 * `enable` true is "for my tyres"; false is "all chains", spelled `?tyres=0` and NOT as "remove the parameter",
 * which on the shelf means the default and would turn the filter back on under a link that says it turns it off.
 * A cursor is a position in ONE ordered result set; carried across a change of filter it asks Saleor to continue from
 * a row that is no longer in the list, so it goes, and `direction` with it. Sorting, price and maker stay.
 */
export function tyreFilterHref(
	basePath: string,
	searchParams: Record<string, string | string[] | undefined>,
	enable: boolean,
	/** The size to put in the link, so that it shows the same list to whoever opens it. */
	size?: string | null,
): string {
	const next = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		if (key === TYRE_FILTER_PARAM || key === TYRE_SIZE_PARAM || key === "cursor" || key === "direction")
			continue;
		if (value === undefined) continue;
		for (const one of Array.isArray(value) ? value : [value]) next.append(key, one);
	}
	next.set(TYRE_FILTER_PARAM, enable ? TYRE_FILTER_VALUE : TYRE_FILTER_OFF_VALUE);
	if (size) next.set(TYRE_SIZE_PARAM, size);
	const query = next.toString();
	return query ? `${basePath}?${query}` : basePath;
}

/**
 * The query string after the shopper changed their tyre size while staying on a page, or `null` when nothing in it
 * belonged to the old size.
 *
 * A cursor was a position in the old size's result set, and an explicit "all chains" (`?tyres=0`) was said about the
 * old size, and so is the size the link carried: someone who has just entered a new size wants to see what fits it,
 * so those parameters go and the default answers. Everything else (sort, price, maker) is still the shopper's choice and stays.
 */
export function searchAfterTyreChange(search: string): string | null {
	const params = new URLSearchParams(search);
	const stale = ["cursor", "direction", TYRE_FILTER_PARAM, TYRE_SIZE_PARAM].filter((name) =>
		params.has(name),
	);
	if (stale.length === 0) return null;
	for (const name of stale) params.delete(name);
	const query = params.toString();
	return query ? `?${query}` : "";
}
