import { saleorSlugFor } from "@/config/category-routes";
import { invalidateKept } from "@/lib/cache/kept-read";

/** The kept reads whose key is `channel`, then (the locale, for the category itself), then the slug. */
const BY_CHANNEL = new Set(["category", "price-bands", "category-facets", "category-navigation"]);
/** The kept read whose key starts with the slug and spans every market. */
const BY_SLUG = "category-presence";

/**
 * Takes what the process keeps of one category in one channel out of use, because Saleor announced a
 * change to it (`/api/revalidate`): the category itself, its price bands, its filters, its row of
 * sub-categories and, across markets, where it is stocked. The `"use cache"` entries above them are
 * expired by the tag; without this the kept answers underneath would hand the old ones straight back.
 *
 * - `drop` for a change to the category (its name, texts, translations, which products it holds): the
 *   next visit waits for the new answer, exactly as before answers were kept.
 * - `stale` for a product event: the answer is served once more while a new one is read behind it.
 *
 * Both spellings of the slug are matched: Saleor's base slug and the one it holds while a category is being
 * renamed (`saleorSlugFor`).
 */
export function expireCategoryAnswers(channel: string, baseSlug: string, mode: "drop" | "stale"): number {
	const slugs = new Set([baseSlug, saleorSlugFor(baseSlug)]);
	return invalidateKept((name, key) => {
		const parts = key.split("\u0000");
		if (BY_CHANNEL.has(name)) return parts[0] === channel && slugs.has(parts[parts.length - 1] ?? "");
		if (name === BY_SLUG) return slugs.has(parts[0] ?? "");
		return false;
	}, mode);
}
