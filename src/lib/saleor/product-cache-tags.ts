import { CACHE_PROFILES, buildTag } from "@/lib/cache-manifest";
import { isSourceLocale } from "@/lib/saleor/exact-locale";

/** What a cached PDP lookup concluded, reduced to what decides its extra tags. */
export type ProductAnswer = { status: "found"; baseSlug: string } | { status: "not-found" };

/**
 * The tags a cached product answer carries besides `product:{channel}:{locale}:{url slug}`.
 *
 * Abroad the URL slug is the TRANSLATED slug, while every revalidation event — Saleor's own
 * and CFM's — names the product by its BASE slug. Without these, a translated-slug URL
 * could only ever be refreshed by expiry:
 *
 * - found: also tagged with the base slug, so the event that names the product reaches the
 *   entry behind `/de/<translated-slug>` (and behind an old base-slug URL still rendering
 *   it) as well as the one behind `/de/<base-slug>`;
 * - not-found abroad: also tagged with the channel's miss tag, because a miss has no base
 *   slug to be named by — the translation that would have matched did not exist yet. Any
 *   product or category event in that channel expires every such miss.
 *
 * Slovakia gets neither: its URL slug IS the base slug, so the event already names it, and
 * the Slovak cache behaves exactly as it did.
 */
export function productAnswerTags(
	identity: { channel: string; locale: string; slug: string },
	answer: ProductAnswer,
): string[] {
	if (isSourceLocale(identity.locale)) return [];
	if (answer.status === "found") {
		return answer.baseSlug && answer.baseSlug !== identity.slug
			? [buildTag(CACHE_PROFILES.products, { ...identity, slug: answer.baseSlug })]
			: [];
	}
	return [buildTag(CACHE_PROFILES.productMisses, identity)];
}

/** The per-channel miss tag a product or category event must expire — none for Slovakia. */
export function productMissTagFor(channel: string, locale: string): string | null {
	return isSourceLocale(locale) ? null : buildTag(CACHE_PROFILES.productMisses, { channel, locale });
}
