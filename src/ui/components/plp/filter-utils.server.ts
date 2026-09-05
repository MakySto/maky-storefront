import "server-only";

import { CategoriesBySlugDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { getLocaleConfigByLocale } from "@/config/locale";
import { resolveExactLocaleCategorySummary } from "@/lib/saleor/exact-locale";

interface ResolvedCategory {
	id: string;
	/**
	 * The name to label a filter chip with, or null when this locale has none.
	 *
	 * Null does NOT mean "do not filter" — see below. It means "filter, but do
	 * not put Slovak on a German page".
	 */
	name: string | null;
}

/**
 * Resolve category slugs to IDs via Saleor. Cached for an hour.
 *
 * Keyed by the slug that was ASKED FOR, which is the base slug.
 * `CategoryFilterInput` offers `slugs` and no `slugLanguageCode` (the singular
 * `category(slug:, slugLanguageCode:)` is the only language-aware lookup Saleor
 * has), so the query can only ever match base slugs — while the Map used to be
 * keyed by `resolveExactLocaleCategorySummary`'s output, which substitutes the
 * TRANSLATED slug. In goes one slug, out comes another, and the caller's
 * `categoryMap.get(slug)` missed every time the two differed.
 *
 * The second half mattered more. `categoryIds` is built from the Map's VALUES,
 * so a category dropped here disappears from the filter as well as from its
 * chip — and this dropped every category whose locale had no translation.
 * `?categories=nosice-bicyklov` would then quietly return the UNFILTERED
 * listing: no error, no empty state, just the wrong products under a URL that
 * asked for a subset.
 *
 * So the id is always kept — an id is language-independent and the filter must
 * apply regardless — and only the display name is withheld when this locale has
 * none, which is what keeps source copy off a translated route.
 *
 * Both halves are latent on sk today, where base and translated slugs are
 * identical because no translation exists. They detonate together on the first
 * translated market.
 */
export async function resolveCategorySlugsToIds(
	slugs: string[],
	locale: string,
): Promise<Map<string, ResolvedCategory>> {
	const result = new Map<string, ResolvedCategory>();
	if (slugs.length === 0) return result;

	const queryResult = await executePublicGraphQL(CategoriesBySlugDocument, {
		variables: { slugs, first: slugs.length, lang: getLocaleConfigByLocale(locale).graphqlLanguageCode },
		revalidate: 3600,
	});

	if (queryResult.ok && queryResult.data.categories?.edges) {
		queryResult.data.categories.edges.forEach(({ node }) => {
			const localized = resolveExactLocaleCategorySummary(node, locale);
			result.set(node.slug, { id: node.id, name: localized?.name ?? null });
		});
	} else if (!queryResult.ok) {
		console.error("[filter-utils] Failed to resolve category slugs:", queryResult.error.message);
	}

	return result;
}
