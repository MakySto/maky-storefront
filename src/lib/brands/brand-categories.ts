import { cacheLife, cacheTag } from "next/cache";

import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { BrandCategoriesDocument, type BrandCategoriesQuery } from "@/gql/graphql";
import { createKeptRead } from "@/lib/cache/kept-read";
import { settle, type CachedRead } from "@/lib/cache-fault";
import { executePublicGraphQL } from "@/lib/graphql";
import { resolveExactLocaleCategorySummary } from "@/lib/saleor/exact-locale";

/**
 * What one maker sells, by top-level category, in one market.
 *
 * The brand page used to say nothing about that: its title was "Thule | MAKY.STORE" and its description
 * one sentence of 42 characters, the same for every maker, so a search for "Thule strešné nosiče" had no
 * page that named both (measured 2026-11-15, all 21 brand pages). Saleor knows the answer: each
 * category counts the maker's products in its subtree, in the channel asked.
 */
export interface BrandCategory {
	readonly id: string;
	/** The category's base slug, the one `categoryUrlFor` takes. */
	readonly slug: string;
	/** In the market's language when Saleor holds a translation, else the base name. */
	readonly name: string;
	readonly productCount: number;
}

/**
 * A visitor waits this long at most for a market's counts, and only when the process holds none yet. The
 * read itself is given far longer and goes on after the visitor has left, so the next one finds it:
 * `pro-user`, the biggest maker, needs more than the 4 s this used to be (24 "deadline exceeded" in the log
 * of 2026-11-15, 18:57 UTC on) and every one of them was thrown away and asked again (`@/lib/cache/kept-read`).
 */
const WAIT_MS = 4_000;
const LOAD_DEADLINE_MS = 15_000;
const FRESH_MS = 10 * 60_000;
const PAUSE_MS = 15_000;

type Node = NonNullable<BrandCategoriesQuery["categories"]>["edges"][number]["node"];

/**
 * Pure half of `getBrandCategories`, exported for its test: the categories that hold something of the
 * maker, the fullest first. Ties keep Saleor's order, so the list does not shuffle between reads.
 *
 * Abroad a category counts only when Saleor holds its name in the market's language, the exact-locale
 * rule the category page itself applies: a category without it answers "not found" there, and neither a
 * title nor a link should name it.
 */
export function brandCategoriesFromNodes(nodes: readonly Node[], locale: string): BrandCategory[] {
	return nodes
		.flatMap((node) => {
			const localized = resolveExactLocaleCategorySummary(node, locale);
			return localized
				? [
						{
							id: node.id,
							// The base slug: `categoryUrlFor` turns it into the market's own address.
							slug: node.slug,
							name: localized.name.trim(),
							productCount: node.products?.totalCount ?? 0,
						},
					]
				: [];
		})
		.filter((category) => category.productCount > 0 && category.slug && category.name)
		.sort((a, b) => b.productCount - a.productCount);
}

/** The read itself. It throws on a fault; `settle` below turns that into a value before the cache keeps it. */
async function askSaleorForBrandCategories(
	channel: string,
	brandSlug: string,
	signal: AbortSignal,
): Promise<BrandCategory[]> {
	const locale = getLocaleFromChannel(channel);
	const result = await executePublicGraphQL(BrandCategoriesDocument, {
		variables: {
			channel,
			lang: getLocaleConfigByLocale(locale).graphqlLanguageCode,
			brand: [brandSlug],
		},
		revalidate: 0,
		retry: false,
		signal,
	});
	if (!result.ok)
		throw new Error(`[Brands] categories unavailable for ${brandSlug}: ${result.error.message}`);
	return brandCategoriesFromNodes(
		(result.data.categories?.edges ?? []).map((edge) => edge.node),
		locale,
	);
}

const keptCategories = createKeptRead<{ channel: string; brandSlug: string }, BrandCategory[]>({
	name: "brand-categories",
	freshMs: FRESH_MS,
	pauseMs: PAUSE_MS,
	loadDeadlineMs: LOAD_DEADLINE_MS,
	load: ({ channel, brandSlug }, signal) => askSaleorForBrandCategories(channel, brandSlug, signal),
});

/** For tests. */
export function __forgetBrandCategories(): void {
	keptCategories.forget();
}

async function readBrandCategories(channel: string, brandSlug: string): Promise<CachedRead<BrandCategory[]>> {
	"use cache";
	// The life of the makers' list itself (`catalog.ts`), and its tags: what refreshes the brands refreshes this.
	cacheLife("hours");
	cacheTag("brands", `brands:${channel}`);

	return settle(() => keptCategories.read(`${channel}\u0000${brandSlug}`, { channel, brandSlug }, WAIT_MS));
}

/**
 * The maker's categories in this market, or none when Saleor did not answer in time.
 *
 * Never throws: the categories only enrich a page that is complete without them. A fault is remembered
 * for seconds (`settle`), so the next request asks again, and the page meanwhile says what it said
 * before this existed.
 */
export async function getBrandCategories(channel: string, brandSlug: string): Promise<BrandCategory[]> {
	try {
		const read = await readBrandCategories(channel, brandSlug);
		if (!read.ok) console.warn(read.message);
		return read.ok ? read.value : [];
	} catch (error) {
		console.warn("[Brands] categories left out:", error instanceof Error ? error.message : error);
		return [];
	}
}

/** The longest a brand title may be before the shop's name is appended. */
const TITLE_BUDGET = 55;

/**
 * "Thule: Strešné nosiče, Strešné boxy": the maker and the categories it is fullest in, as many as fit a
 * search result's title. Always at least one category when there is one; the maker's name alone when
 * there is none.
 */
export function brandTitle(brandName: string, categories: readonly BrandCategory[]): string {
	let title = brandName;
	for (const [index, category] of categories.entries()) {
		const next = index === 0 ? `${brandName}: ${category.name}` : `${title}, ${category.name}`;
		if (index > 0 && next.length > TITLE_BUDGET) break;
		title = next;
	}
	return title;
}

/** "Strešné nosiče (9 666), Strešné boxy (41)": every category with its count, for the description. */
export function brandCategoryList(categories: readonly BrandCategory[], locale: string, limit = 4): string {
	const count = new Intl.NumberFormat(locale);
	return categories
		.slice(0, limit)
		.map((category) => `${category.name} (${count.format(category.productCount)})`)
		.join(", ");
}
