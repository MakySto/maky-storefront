import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { categoriesFor } from "@/config/categories";
import { getLocaleFromChannel } from "@/config/locale";
import { faulted, settle, valueOrThrow, type CachedRead } from "@/lib/cache-fault";
import { CACHE_PROFILES } from "@/lib/cache-manifest";
import { fetchStockedCategorySlugs, sitemapTag } from "@/lib/seo/catalogue-walk";

/**
 * Which of the storefront's catalogue categories a market actually offers.
 *
 * Measured on production 2026-09-25: every foreign channel holds the 9 157 Nordrive roof-rack
 * sets and nothing else, while the menus, the homepage tiles, the hero and the search field of
 * all eleven foreign markets promised roof boxes, bike and ski carriers, roof tents and car
 * fridges — five links per market to "Seite nicht gefunden". The sitemap already knew better:
 * it lists only the categories that are a stocked, translated page in the market. This module
 * asks Saleor that SAME question (`fetchStockedCategorySlugs`, one definition) so the pages
 * promote exactly what the sitemap advertises.
 *
 * ## Three states, because an outage is not an empty shop
 *
 *   known       Saleor answered: these categories are offered, the others are not.
 *   remembered  Saleor did not answer; the last answer this process received is used instead.
 *   unknown     no answer and nothing remembered (a fresh process during an outage) — every
 *               category stays linked, as before this module existed. A fault must never turn a
 *               market's navigation into a shop with nothing in it.
 *
 * ## Why it costs nothing per page
 *
 * One cached read per channel — the category walk the sitemap already makes — under the
 * `sitemap:{channel}` tag, which `/api/revalidate` expires on EVERY catalogue event for the
 * channel. The first product CFM publishes into an empty category makes the category appear on
 * the next render, without a deploy; an unpublished last product makes it go. Between events the
 * answer is kept for the `hours` profile, and a read never waits longer than `DEADLINE_MS`.
 */

export type MarketAssortment =
	| { readonly state: "known" | "remembered"; readonly categories: ReadonlySet<string> }
	| { readonly state: "unknown" };

/** The header waits for this at most. Past it, the last known answer stands in. */
const DEADLINE_MS = 1_500;

/** The last answer per channel, for when Saleor cannot be asked. Process-local on purpose. */
const lastKnown = new Map<string, ReadonlySet<string>>();

/**
 * After a failed read the channel is not asked again for this long. The fault is remembered by the
 * cache for 5 seconds only (below), and the read behind it is the category walk the sitemap makes —
 * a Saleor that is struggling answered it with a COUNT per category, a client deadline does not stop
 * that there, and a cold process (nothing remembered, so every category linked) asked again on every
 * 5-second expiry in every market. The answer in the meantime is the fault itself, which
 * `getMarketAssortment` already turns into the last answer, or into "link everything".
 */
const FAULT_PAUSE_MS = 45_000;

/** The channels whose last read failed, with when and why. */
const lastFault = new Map<string, { readonly at: number; readonly message: string }>();

/** When each channel's fault was last logged: one line per pause is enough to see it. */
const lastWarned = new Map<string, number>();

/**
 * A fault comes out of the cache as a value that is remembered for seconds (`@/lib/cache-fault`): a throw
 * out of a `"use cache"` function fails the prerender it happens in, and the header of EVERY page
 * asks for this. `getMarketAssortment` below still takes it as the fault it is.
 */
async function readOfferedCategories(channel: string): Promise<CachedRead<string[]>> {
	"use cache";
	cacheLife(CACHE_PROFILES.sitemap.cacheProfile);
	cacheTag(sitemapTag(channel));

	const fault = lastFault.get(channel);
	if (fault && Date.now() - fault.at < FAULT_PAUSE_MS) return faulted(fault.message);

	const read = await settle(() =>
		fetchStockedCategorySlugs(channel, getLocaleFromChannel(channel), { deadlineMs: DEADLINE_MS }),
	);
	if (read.ok) lastFault.delete(channel);
	else lastFault.set(channel, { at: Date.now(), message: read.message });
	return read;
}

export async function getMarketAssortment(channel: string): Promise<MarketAssortment> {
	try {
		const categories: ReadonlySet<string> = new Set(valueOrThrow(await readOfferedCategories(channel)));
		lastKnown.set(channel, categories);
		return { state: "known", categories };
	} catch (error) {
		const remembered = lastKnown.get(channel);
		// This runs on every render of every page, and one fault used to be ~47 log lines.
		// Not `Date.now()`: read here, outside the cached read, it fails the prerender this render is part
		// of ("unstable value `Date.now()` while prerendering"), and this branch runs exactly when the read
		// failed. The throw then replaces the fallback below and the page answers 500 (/at/, 2026-11-05
		// 22:18 UTC, the first minutes of a cold process behind a slow Saleor).
		const now = Math.round(performance.timeOrigin + performance.now());
		if (now - (lastWarned.get(channel) ?? 0) >= FAULT_PAUSE_MS) {
			lastWarned.set(channel, now);
			console.warn(
				`[assortment] ${channel}: categories could not be read, ${
					remembered ? "using the last answer" : "linking all"
				}:`,
				error instanceof Error ? error.message : error,
			);
		}
		return remembered ? { state: "remembered", categories: remembered } : { state: "unknown" };
	}
}

/** Whether a catalogue category may be linked or promoted in this market. */
export function offersCategory(assortment: MarketAssortment, slug: string): boolean {
	return assortment.state === "unknown" || assortment.categories.has(slug);
}

/**
 * The market sells every category those texts name (a category flagged `inRangeText: false`, such as the
 * snow chains, is linked where stocked but is not in the lines, so its absence changes nothing) — so a text that lists them all ("strešné
 * nosiče, boxy, nosiče bicyklov, strešné stany a autochladničky") is true here. Where it is not,
 * the page says what IS sold instead of promising the rest.
 */
export function offersFullRange(assortment: MarketAssortment): boolean {
	return categoriesFor("home")
		.filter((category) => category.inRangeText !== false)
		.every((category) => offersCategory(assortment, category.slug));
}

/** For tests: forget every remembered answer. */
export function __forgetAssortments(): void {
	lastKnown.clear();
	lastFault.clear();
	lastWarned.clear();
}
