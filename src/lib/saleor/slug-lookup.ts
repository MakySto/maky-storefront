import { getLocaleConfigByLocale } from "@/config/locale";
import type { LanguageCodeEnum } from "@/gql/graphql";
import type { GraphQLResult } from "@/lib/graphql";
import { isSourceLocale } from "@/lib/saleor/exact-locale";

/**
 * One slug lookup that survives an untranslated catalogue.
 *
 * `slugLanguageCode` matches ONLY a row in Saleor's translation table. It does
 * NOT fall back to `Product.slug` / `Category.slug`, so a query that sends it
 * unconditionally cannot find a resource that has no translation — which today
 * is every resource in the catalogue, Slovak included. Verified against live
 * Saleor on 2026-09-04:
 *
 *     product(slug: "…-639901", channel: "sk-eur")                       → product
 *     product(slug: "…-639901", channel: "sk-eur", slugLanguageCode: SK) → null
 *
 * So the URL slug has to be asked about twice, in this order:
 *
 *   1. as a base slug — which is what the source market always carries, and
 *      what a foreign market carries until its translation lands;
 *   2. only then as a translated slug.
 *
 * Base-first is what keeps the source market on a single round trip, and it is
 * also the only order that stays correct while the translation table fills up
 * one row at a time.
 *
 * Passing `slugLanguageCode: null` is equivalent to omitting the argument
 * (verified against the same live schema), so both questions fit one document
 * and no parallel query path is needed.
 */
export async function lookupBySlug<Data>(
	locale: string,
	entity: (data: Data) => unknown,
	run: (slugLang: LanguageCodeEnum | null) => Promise<GraphQLResult<Data>>,
): Promise<GraphQLResult<Data>> {
	const base = await run(null);

	// A fault is not an absence. It is neither a reason to ask the second
	// question nor something to paper over with a second answer.
	if (!base.ok || base.data == null) return base;
	if (entity(base.data) != null) return base;

	// The source market's URLs are base slugs by definition; there is no
	// translated row that could hold this slug, so there is nothing to ask.
	if (isSourceLocale(locale)) return base;

	const translated = await run(getLocaleConfigByLocale(locale).graphqlLanguageCode);

	// The two attempts ask different questions. If the second one faulted we do
	// not know its answer, and returning the first attempt's authoritative miss
	// would convert "we could not find out" into "this does not exist" — exactly
	// the conversion `resource-outcome.ts` exists to prevent.
	if (!translated.ok) return translated;

	return translated.data != null && entity(translated.data) != null ? translated : base;
}
