/**
 * A lookup table that is safe to index with a value taken from a request.
 *
 * A plain object literal inherits from `Object.prototype`, so for a key that is NOT in the
 * table `TABLE["__proto__"]`, `TABLE["constructor"]` and `TABLE["toString"]` all return
 * something — and something truthy. The market and language tables are indexed with a market
 * slug from a URL path or a country code from a header, both of which a visitor chooses, so
 * "not in the table" has to mean `undefined` rather than "an inherited member of Object".
 *
 * Nothing is known to be exploitable today: every caller happens to have a second check after
 * the lookup (`isMarketLive`, `?.saleorSlug`, `|| "cart"`) that rejects the inherited value.
 * That is correct by accident, and the accident is one refactor deep. A null prototype makes
 * it correct by construction and leaves those checks as the belt.
 *
 * It lives in its own module because `src/config/market-language.ts` deliberately imports
 * nothing — it exists to keep generated GraphQL documents out of the middleware bundle, which
 * runs before every single request.
 */
export function requestKeyed<T>(entries: Record<string, T>): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, entries);
}
