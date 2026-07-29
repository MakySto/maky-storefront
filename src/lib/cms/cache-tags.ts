/**
 * Cache tags for CMS-backed data.
 *
 * Namespaced `cms:` so they cannot collide with the Saleor tags in
 * `src/lib/cache-manifest.ts`. The two systems are invalidated by different
 * endpoints holding different secrets and must stay separable.
 *
 * Tags are always DERIVED here from an entity and a slug. The revalidation
 * endpoint never accepts a tag or a path from the webhook body — a caller that
 * could name its own tag could purge anything it liked.
 */

/** Slugs come from an authenticated webhook, but a tag is still a cache key. */
function normalizeSlug(slug: string): string | null {
	const trimmed = slug.trim();
	if (trimmed.length === 0 || trimmed.length > 200) return null;
	// Payload slugs are `[a-z0-9-]`; anything else is not a slug we issued a tag for.
	return /^[A-Za-z0-9._~-]+$/.test(trimmed) ? trimmed : null;
}

/** Tag for one CMS page, e.g. `cms:page:o-nas`. */
export function cmsPageTag(slug: string): string | null {
	const normalized = normalizeSlug(slug);
	return normalized ? `cms:page:${normalized}` : null;
}

/** Tag for one Payload global, e.g. `cms:global:site-settings`. */
export function cmsGlobalTag(globalSlug: string): string | null {
	const normalized = normalizeSlug(globalSlug);
	return normalized ? `cms:global:${normalized}` : null;
}

/**
 * Coarse tag for a whole collection, e.g. `cms:collection:pages`.
 *
 * Attached alongside the per-slug tag so that an entity type the storefront does
 * not yet read per-slug still has something to invalidate.
 */
export function cmsCollectionTag(collectionSlug: string): string | null {
	const normalized = normalizeSlug(collectionSlug);
	return normalized ? `cms:collection:${normalized}` : null;
}
