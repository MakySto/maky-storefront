import { cache } from "react";
import { cacheTag } from "next/cache";

import { executePublicGraphQL } from "@/lib/graphql";
import {
	catchUpstreamError,
	refuseToCacheUpstreamError,
	toOutcome,
	type AuthoritativeOutcome,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";
import { ProductDetailsDocument, type ProductDetailsQuery } from "@/gql/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { previousProductSlug } from "@/lib/product-redirects";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { isSourceLocale, resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";
import { productAnswerTags } from "@/lib/saleor/product-cache-tags";
import { PRODUCT_DEADLINE_MS } from "@/config/product-deadline";

/**
 * The product page's own product: ONE resolver, shared by everything that has to agree on it.
 *
 * It lived inside `[productSlug]/page.tsx` and moved here unchanged, because a second caller now
 * needs the SAME `"use cache"` entry the page reads: `/api/internal/product-outcome`, which the
 * proxy asks on behalf of a crawler before the response status is committed (see
 * `lib/bot-preflight.ts`). A `"use cache"` entry is keyed on the build, the function's id and its
 * arguments — not on the route that called it — and the built-in handler is process-wide, so the
 * handler's read and the page's read are one entry. That is what lets the status decision and the
 * rendered content come from one Saleor read instead of two.
 *
 * Any change to the arguments (slug, channel, locale) or to how they are derived is a change for
 * BOTH callers; if they ever diverge, the preflight stops sharing the page's entry and the page
 * reads Saleor a second time.
 */

type Product = NonNullable<ProductDetailsQuery["product"]>;

/**
 * The product in the market's language, plus the one thing the exact-locale boundary
 * overwrites and the page still needs: the BASE slug (`Product.slug`). Abroad `slug` is the
 * translated slug — the market's URL — while every other market, the revalidation event and
 * the cache key of the Slovak page know the product by its base slug.
 */
export type LocalizedProduct = Product & { baseSlug: string };

async function fetchProductOutcome(
	slug: string,
	channel: string,
	locale: string,
): Promise<ResourceOutcome<LocalizedProduct>> {
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	// One budget for the whole lookup, however many slug languages it tries.
	const signal = AbortSignal.timeout(PRODUCT_DEADLINE_MS);
	const result = await lookupBySlug(
		locale,
		(data: ProductDetailsQuery) => data.product,
		(slugLang) =>
			executePublicGraphQL(ProductDetailsDocument, {
				variables: {
					slug: decodeURIComponent(slug),
					channel,
					lang,
					slugLang,
				},
				// Slovakia keeps its 300 s fetch cache: its URL slug is the base slug, so the
				// event's path purge (`/sk-eur/<slug>`) already expires this fetch with the
				// entry. Abroad the URL is the translated slug, the event cannot name that path,
				// and a fetch cached here outlived every tag purge by up to 300 s — measured:
				// the entry re-ran and read the old answer back from the fetch cache. So abroad
				// the `"use cache"` entry is the only cache, and its tags (see
				// `product-cache-tags.ts`) are the whole invalidation story.
				revalidate: isSourceLocale(locale) ? 300 : 0,
				signal,
			}),
	);

	return toOutcome(result, (data) => {
		const localized = resolveExactLocaleProduct(data.product, locale);
		return localized && data.product ? { ...localized, baseSlug: data.product.slug } : null;
	});
}

/**
 * The cached half. Ends in `refuseToCacheUpstreamError`, which throws on a fault
 * so Next never stores it — an outage must not be remembered as an absence for
 * the length of a `cacheLife("minutes")` entry.
 *
 * Only ever the page's OWN product now. The other markets are answered by
 * `getProductMarketPresence`, in one request, by product id.
 */
async function getProductOutcomeCached(
	slug: string,
	channel: string,
	locale: string,
): Promise<AuthoritativeOutcome<LocalizedProduct>> {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.products, { channel, locale, slug });

	let outcome = await fetchProductOutcome(slug, channel, locale);

	// Migration shim: a product whose Saleor slug has not been updated to the
	// SKU-last form yet is still reachable at its canonical new URL. Only fires
	// on an AUTHORITATIVE miss — a fault throws below without ever getting here,
	// so a blip can no longer send us down this path — and only for the ten
	// explicitly mapped slugs, so it disappears on its own once Saleor has converged.
	if (outcome.status === "not-found") {
		const previous = previousProductSlug(slug);
		if (previous) outcome = await fetchProductOutcome(previous, channel, locale);
	}

	const answer = refuseToCacheUpstreamError(outcome);

	// Abroad the URL slug is the translated one, and the events that must reach this entry
	// name the base slug — see `product-cache-tags.ts`. No extra tags in Slovakia.
	const extraTags = productAnswerTags(
		{ channel, locale, slug },
		answer.status === "found" ? { status: "found", baseSlug: answer.resource.baseSlug } : answer,
	);
	for (const tag of extraTags) cacheTag(tag);

	return answer;
}

/**
 * `found` | `not-found` | `upstream-error`, shared by the page, its metadata and the crawler
 * preflight's internal endpoint.
 *
 * `cache()` so the page and its metadata share one answer per request explicitly — including a
 * fault, which is never stored across requests but must not be asked for twice, with retries,
 * inside one.
 *
 * `slug` is the URL segment exactly as the page receives it in `params.productSlug`.
 */
export const getProductOutcome = cache(
	async (slug: string, channel: string): Promise<ResourceOutcome<LocalizedProduct>> => {
		const locale = getLocaleFromChannel(channel);
		return catchUpstreamError(() => getProductOutcomeCached(slug, channel, locale));
	},
);
