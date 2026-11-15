import { CHANNEL_MAP } from "@/lib/channel-map";
import { liveMarkets } from "@/lib/market-state";
import { getLocaleFromChannel } from "@/config/locale";
import { prewarmCategoryNavigation } from "./category-navigation";
import { prewarmCategoryOutcome } from "./category-outcome";
import { prewarmCategoryPriceBands } from "./category-prices";

/**
 * The categories whose first read after a start is the slow one, and which are big enough for that to be
 * a certainty and not a guess: the roof-rack sets, 25 000 products in the Slovak channel, where Saleor
 * needs 1.5 to 1.9 s for the price bands and for the row of sub-categories (measured 2026-11-15). Any
 * other category is read by the first visit that needs it, in well under a second, and kept from then on.
 *
 * Keyed by Saleor's base slug, the slug the page asks with.
 */
const BIG_CATEGORIES: readonly string[] = ["stresne-nosice"];

const GAP_MS = 500;

/**
 * Reads the category itself, its price bands and its row of sub-categories of the big categories into the process, one market
 * after the other, so that the first visitors after a restart find them kept instead of waiting 2 s for
 * them or going without (`@/lib/cache/kept-read`). It is what the first visit would have done, only
 * earlier and with all the time Saleor needs. Never rejects: a read that fails is left to the visit.
 */
export async function prewarmBigCategories({
	gapMs = GAP_MS,
}: { readonly gapMs?: number } = {}): Promise<void> {
	const started = Date.now();
	const channels = [
		...new Set(
			liveMarkets()
				.map((market) => CHANNEL_MAP[market]?.saleorSlug)
				.filter((channel): channel is string => Boolean(channel)),
		),
	];
	let held = 0;
	let asked = 0;
	for (const channel of channels) {
		for (const slug of BIG_CATEGORIES) {
			asked += 1;
			try {
				// Together, they are three different questions of different Saleor resolvers.
				const [outcome, bands, navigation] = await Promise.all([
					prewarmCategoryOutcome(slug, channel, getLocaleFromChannel(channel)),
					prewarmCategoryPriceBands(slug, channel, true),
					prewarmCategoryNavigation(slug, channel),
				]);
				if (outcome && bands && navigation) held += 1;
			} catch {
				// Neither rejects; nothing here may stop the start.
			}
			if (gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
		}
	}
	console.log(
		`[categories] warm-up: ${held} of ${asked} big categories kept in ${Math.round(
			(Date.now() - started) / 1000,
		)} s`,
	);
}
