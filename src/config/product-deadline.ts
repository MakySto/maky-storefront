/**
 * The most a product page's own product may take to arrive, retries included.
 *
 * It had no bound but the transport's: 15 s per attempt, three retries with back-off — about a
 * minute, past nginx's 60 s. A crawler that is served the finished page (`htmlLimitedBots`)
 * waits for this answer before the first byte, and on 2026-09-25 one waited 43.8 s. A healthy
 * answer takes ~0.1 s; past this budget the page takes its "temporarily unavailable" path, which
 * is never cached and recovers on the next request. Generous on purpose: a visitor would rather
 * wait a few seconds for a slow Saleor than see that state.
 * Measured on a preview with every Saleor query slowed by 8 s: 8.4 s with a 6 s budget, against
 * about a minute without one.
 *
 * Its own module, with nothing else in it, because the proxy needs the number too (its crawler
 * preflight waits for the same read — `lib/bot-preflight.ts`) and must not pull the Saleor client
 * into its bundle to get it.
 */
export const PRODUCT_DEADLINE_MS = 8_000;
