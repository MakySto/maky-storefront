import { ProductListByCategoryDocument, type ProductListByCategoryQuery } from "@/gql/graphql";
import { getLocaleConfigByLocale } from "@/config/locale";
import { createKeptRead } from "@/lib/cache/kept-read";
import { executePublicGraphQL } from "@/lib/graphql";
import { resolveExactLocaleCategory } from "@/lib/saleor/exact-locale";
import { toOutcome, type ResourceOutcome, type UpstreamError } from "@/lib/saleor/resource-outcome";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";

/**
 * The category itself, the read every category page and its metadata start from: the name, the texts and
 * how many products the category holds in the channel (one product with the count).
 *
 * It sat in a `"use cache"` entry of 60 s whose miss went to Saleor with the visitor waiting, and the count
 * is a `COUNT(*)` that costs a second or more on the 26 000 roof-rack sets. So every minute the next visit
 * paid for it, in every market, and a Saleor that was busy answered the next visitors late as well. Now the
 * entry above asks THIS, and this keeps the last answer and refreshes it behind the visitor
 * (`@/lib/cache/kept-read`); only a process that holds none yet makes a visitor wait.
 */
export type CategoryRead = NonNullable<ProductListByCategoryQuery["category"]>;
export type CategoryOutcome = ResourceOutcome<CategoryRead>;

/**
 * As long as the `"use cache"` entry above it lives (`CATEGORY_CACHE_LIFE`). A change Saleor announces does not wait
 * for it: the webhook takes the answer out of use (`expireCategoryAnswers`).
 */
const FRESH_MS = 5 * 60_000;
/** What one load may take in all, retries included: the transport's own, which the visitor waited for before. */
const LOAD_DEADLINE_MS = 20_000;
/** A visitor of a process that holds no answer waits for the load, as it did. */
const WAIT_MS = LOAD_DEADLINE_MS;
const PAUSE_MS = 10_000;

interface CategoryRequest {
	readonly slug: string;
	readonly channel: string;
	readonly locale: string;
}

/** A fault travels as a throw through the kept read, and comes out of `readCategoryOutcome` as the outcome it is. */
class CategoryFault extends Error {
	constructor(readonly outcome: UpstreamError) {
		super(`[category] ${outcome.message}`);
		this.name = "CategoryFault";
	}
}

/** An empty category and an absent one end on their own, when the products or the texts arrive: never kept. */
const keptFor = (outcome: CategoryOutcome): number =>
	outcome.status === "found" && (outcome.resource.products?.totalCount ?? 0) > 0 ? FRESH_MS : 0;

const keptCategory = createKeptRead<CategoryRequest, CategoryOutcome>({
	name: "category",
	freshMs: keptFor,
	pauseMs: PAUSE_MS,
	loadDeadlineMs: LOAD_DEADLINE_MS,
	load: async ({ slug, channel, locale }, signal) => {
		const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
		const result = await lookupBySlug(
			locale,
			(data: ProductListByCategoryQuery) => data.category,
			(slugLang) =>
				executePublicGraphQL(ProductListByCategoryDocument, {
					variables: { slug, channel, lang, slugLang, first: 1 },
					// NOT cached by the data cache: this answer has its own life, and a fetch under it that is cached
					// as well is a second, older answer (2026-10-08: a category whose products had arrived minutes
					// earlier answered `noindex` to Bing's first visit).
					cache: "no-store",
					signal,
				}),
		);
		const outcome = toOutcome(result, (data) => resolveExactLocaleCategory(data.category, locale));
		if (outcome.status === "upstream-error") throw new CategoryFault(outcome);
		return outcome;
	},
});

const keyOf = ({ slug, channel, locale }: CategoryRequest) => `${channel}\u0000${locale}\u0000${slug}`;

/**
 * The category's outcome: the held answer at once (fresh, or stale with a refresh behind it), else a load
 * the caller waits for. A fault comes back as the `upstream-error` outcome it is, and is never an answer.
 */
export async function readCategoryOutcome(
	slug: string,
	channel: string,
	locale: string,
): Promise<CategoryOutcome> {
	const request = { slug, channel, locale };
	try {
		return await keptCategory.read(keyOf(request), request, WAIT_MS);
	} catch (error) {
		// By name, not `instanceof`: the answer may have been loaded by another bundle's copy of this module.
		if (error instanceof Error && error.name === "CategoryFault" && "outcome" in error) {
			return (error as CategoryFault).outcome;
		}
		throw error;
	}
}

/** Loads the category into the process, waiting for all of it; resolves to whether an answer is held. */
export function prewarmCategoryOutcome(slug: string, channel: string, locale: string): Promise<boolean> {
	const request = { slug, channel, locale };
	return keptCategory.prewarm(keyOf(request), request);
}

/** For tests. */
export function __forgetCategoryOutcome(): void {
	keptCategory.forget();
}
