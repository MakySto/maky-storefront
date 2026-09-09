import { vi } from "vitest";

/**
 * A market that exists as a channel but has no approved legal copy — synthesised,
 * because after `us` and `ca` landed there is no longer a real one.
 *
 * ## Why this file exists at all
 *
 * Five assertions across four test files stand for "a market with no approved copy still
 * 404s on the legal pages, and its 404 is not indexable". That is the original bug: for
 * a while `/de/kontakt` answered HTTP 200 with an indexable Slovak `<head>` over a 404-ed
 * body, which is a compliance problem before it is an SEO one.
 *
 * Those assertions used to borrow whichever real market happened to be untranslated:
 * `de` → `pl` → `it`/`fr` → `es`/`ro` → `us`/`ca`. Each hand-off cost nothing because
 * another uncovered market was always left. English was the last one. `us` and `ca` were
 * the final two entries in `CHANNEL_MAP` without copy, so the relay had to stop.
 *
 * The three ways to "fix" it that do not work, and why:
 *
 * - **Empty the list.** Five tests then loop over nothing and pass vacuously. A green test
 *   that checks nothing is worse than no test, because it reads as coverage.
 * - **Point it at a market that has copy.** That inverts the assertion — it would then be
 *   demanding a 404 from a page we deliberately serve.
 * - **Add a fake market to `CHANNEL_MAP`.** That puts a channel that cannot be sold into
 *   production routing to satisfy a test. The gate under test reads `FRIENDLY_SLUGS`, so
 *   the fake would be reachable on the real site.
 *
 * So the fixture stops borrowing a market and synthesises one, in a mock that exists only
 * inside a test run. What it now tests is the *mechanism* — "a market absent from
 * `APPROVED_COPY` 404s" — rather than the accident of which language is late this month.
 * It cannot rot, because nothing will ever translate `zz`.
 *
 * ## What this does NOT replace
 *
 * A genuinely unknown channel is a different case and keeps its own assertions: it fails
 * at `REVERSE_MAP` rather than at `APPROVED_COPY`, and in the proxy it fails at the
 * invalid-first-segment gate rather than the missing-route gate. Both cases must stay.
 */
export const UNCOVERED_MARKET = "zz";

/** Its Saleor slug, shaped like the real ones so nothing rejects it early. */
export const UNCOVERED_CHANNEL = "zz-zzz";

/**
 * Install the synthetic market and return `@/lib/channel-map` re-derived around it.
 *
 * `FRIENDLY_SLUGS`, `SALEOR_SLUGS` and `REVERSE_MAP` are computed from `CHANNEL_MAP` when
 * that module loads, so adding a market means recomputing all three — spreading the actual
 * module and overriding `CHANNEL_MAP` alone would leave the derived sets disagreeing with
 * it, and the proxy gate reads `FRIENDLY_SLUGS`, not the map.
 *
 * Call this BEFORE importing whatever is under test, and import it dynamically: a static
 * `import` is hoisted above the mock and would capture the real module. `vi.resetModules()`
 * here makes sure the module graph is rebuilt rather than served from the run's cache.
 */
export function mockUncoveredMarket(): void {
	vi.resetModules();
	vi.doMock("@/lib/channel-map", async (importOriginal) => {
		const actual = await importOriginal<typeof import("@/lib/channel-map")>();
		const CHANNEL_MAP = {
			...actual.CHANNEL_MAP,
			[UNCOVERED_MARKET]: {
				saleorSlug: UNCOVERED_CHANNEL,
				currency: "EUR",
				locale: "sk-SK",
				country: "ZZ",
			},
		};
		return {
			...actual,
			CHANNEL_MAP,
			FRIENDLY_SLUGS: new Set(Object.keys(CHANNEL_MAP)),
			SALEOR_SLUGS: new Set(Object.values(CHANNEL_MAP).map((c) => c.saleorSlug)),
			REVERSE_MAP: Object.fromEntries(
				Object.entries(CHANNEL_MAP).map(([friendly, config]) => [config.saleorSlug, friendly]),
			),
		};
	});
}

/** Undo it. Both halves matter — an un-reset graph leaks the mock into the next file. */
export function restoreChannelMap(): void {
	vi.doUnmock("@/lib/channel-map");
	vi.resetModules();
}
