import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { categoriesFor } from "@/config/categories";
import { getLocaleFromChannel } from "@/config/locale";
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

async function readOfferedCategories(channel: string): Promise<string[]> {
	"use cache";
	cacheLife(CACHE_PROFILES.sitemap.cacheProfile);
	cacheTag(sitemapTag(channel));
	// Throws on a fault, and a thrown entry is not cached: the next request asks again.
	return fetchStockedCategorySlugs(channel, getLocaleFromChannel(channel), { deadlineMs: DEADLINE_MS });
}

export async function getMarketAssortment(channel: string): Promise<MarketAssortment> {
	try {
		const categories: ReadonlySet<string> = new Set(await readOfferedCategories(channel));
		lastKnown.set(channel, categories);
		return { state: "known", categories };
	} catch (error) {
		const remembered = lastKnown.get(channel);
		console.warn(
			`[assortment] ${channel}: categories could not be read, ${
				remembered ? "using the last answer" : "linking all"
			}:`,
			error instanceof Error ? error.message : error,
		);
		return remembered ? { state: "remembered", categories: remembered } : { state: "unknown" };
	}
}

/** Whether a catalogue category may be linked or promoted in this market. */
export function offersCategory(assortment: MarketAssortment, slug: string): boolean {
	return assortment.state === "unknown" || assortment.categories.has(slug);
}

/**
 * The market sells every category the homepage names — so a text that lists them all ("strešné
 * nosiče, boxy, nosiče bicyklov, strešné stany a autochladničky") is true here. Where it is not,
 * the page says what IS sold instead of promising the rest.
 */
export function offersFullRange(assortment: MarketAssortment): boolean {
	return categoriesFor("home").every((category) => offersCategory(assortment, category.slug));
}

/** For tests: forget every remembered answer. */
export function __forgetAssortments(): void {
	lastKnown.clear();
}
