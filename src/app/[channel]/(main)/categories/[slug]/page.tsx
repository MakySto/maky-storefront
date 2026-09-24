import { Suspense } from "react";
import { categoryBaseSlug, categorySegment, categoryUrlFor } from "@/config/category-routes";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
	ProductListByCategoryDocument,
	ProductListByCategoryGroupedDocument,
	type ProductListByCategoryQuery,
	type ProductListByCategoryGroupedQuery,
} from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import {
	catchUpstreamError,
	logUpstreamError,
	refuseToCacheUpstreamError,
	toOutcome,
	upstreamError,
	type AuthoritativeOutcome,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { getPaginatedListVariables } from "@/lib/utils";
import { ProductsPerPage } from "@/app/config";
import { parseEditorJSToText } from "@/lib/editorjs";
import {
	CategoryHero,
	SubcategoryNav,
	priceBandFormatter,
	priceRangeOptions,
	transformToProductCard,
	type PriceFilter,
} from "@/ui/components/plp";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { buildCanonicalUrl, counterpartAlternates, type MarketCounterpart } from "@/lib/seo/hreflang";
import { marketOpenGraph } from "@/lib/seo/metadata";
import { liveMarkets } from "@/lib/market-state";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { buildSortVariables, buildFilterVariables } from "@/ui/components/plp/filter-utils";
import {
	isVehicleFilterRequested,
	resolveVehicleListingFilter,
	vehicleFilterIds,
} from "@/lib/fitment/plp-vehicle-filter";
import { VehicleListingFilter } from "@/ui/components/fitment/vehicle-listing-filter";
import { CatalogMakeIndex } from "@/ui/components/catalog/make-index";
import { CategoryPageClient } from "./client";
import { formatPageTitleOnce } from "@/config/brand";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleCategory, resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { MarketSwitchTargets } from "@/ui/components/header/market-switch-targets";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";
import { getCategoryNavigation } from "@/lib/listing/category-navigation";
import { getCategoryPriceBands } from "@/lib/listing/category-prices";
import { getProductTypeGroups } from "@/lib/listing/product-groups";
import { isGroupCursor, loadGroupedPage, parseGroupPosition } from "@/lib/listing/grouped-listing";

type Category = NonNullable<ProductListByCategoryQuery["category"]>;

async function getCategoryOutcomeCached(
	slug: string,
	channel: string,
	locale: string,
): Promise<AuthoritativeOutcome<Category>> {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.categories, { channel, locale, slug });
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	const result = await lookupBySlug(
		locale,
		(data: ProductListByCategoryQuery) => data.category,
		(slugLang) =>
			executePublicGraphQL(ProductListByCategoryDocument, {
				variables: { slug, channel, lang, slugLang, first: 1 },
				revalidate: 300,
			}),
	);

	// Throws on a fault, so the entry is never cached: an outage must not be
	// remembered as "this category does not exist" for up to an hour.
	return refuseToCacheUpstreamError(
		toOutcome(result, (data) => resolveExactLocaleCategory(data.category, locale)),
	);
}

/** `found` | `not-found` | `upstream-error`, shared by the page and its metadata. */
async function getCategoryOutcome(slug: string, channel: string): Promise<ResourceOutcome<Category>> {
	const locale = getLocaleFromChannel(channel);
	return catchUpstreamError(() => getCategoryOutcomeCached(slug, channel, locale));
}

type PageProps = {
	params: Promise<{ slug: string; channel: string }>;
	searchParams: Promise<{
		cursor?: string;
		direction?: string;
		sort?: string;
		price?: string;
		colors?: string;
		sizes?: string;
		vehicle?: string;
	}>;
};

/**
 * `params.slug` is the URL segment, which abroad is the localized one (`stresni-nosice`).
 * Saleor, the cache tag and the fitment shelf all know the category by its base slug — see
 * `config/category-routes.ts`. Every lookup goes through this, every link and canonical
 * through `categoryUrlFor`.
 */
const baseSlugOf = (params: { slug: string; channel: string }) =>
	categoryBaseSlug(params.channel, params.slug);

/**
 * Live markets where this category is a real page: translated there, and stocked there.
 *
 * LIVE, not indexable: this feeds the market switcher as well as hreflang, and a preview
 * market is somewhere you can still be sent by hand. `counterpartAlternates()` narrows the
 * hreflang cluster to indexable markets on its own.
 */
async function categoryCounterparts(baseSlug: string): Promise<MarketCounterpart[]> {
	const counterparts: MarketCounterpart[] = [];
	for (const market of liveMarkets()) {
		const outcome = await getCategoryOutcome(baseSlug, CHANNEL_MAP[market]!.saleorSlug);
		if (outcome.status !== "found" || (outcome.resource.products?.totalCount ?? 0) === 0) continue;
		counterparts.push({ market, path: categoryUrlFor(market, baseSlug) });
	}
	return counterparts;
}

export const generateMetadata = async (props: PageProps): Promise<Metadata> => {
	const params = await props.params;
	const outcome = await getCategoryOutcome(baseSlugOf(params), params.channel);

	if (outcome.status === "upstream-error") {
		// Could not verify. `noindex`, no canonical, and no "not found" title —
		// that would be a claim we cannot support.
		return { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
	}

	if (outcome.status === "not-found") {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here
		// until the proxy gate lands.
		const t = await getTranslations({
			locale: getLocaleFromChannel(params.channel),
			namespace: "pages",
		});
		return {
			title: t("notFound"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const category = outcome.resource;

	const plainDescription = parseEditorJSToText(category.description);

	// The SEO title when Saleor has one, the name when it does not — and the brand once.
	// This used to be `${name} | ${seoTitle || parent title}`, which printed the category
	// twice wherever the SEO title was the name itself: "Autochladničky | Autochladničky",
	// with no brand at all. Built the way the other pages build theirs.
	const title = formatPageTitleOnce(category.seoTitle?.trim() || category.name);

	// A category that exists but holds nothing in THIS channel.
	//
	// `category(slug:)` takes no channel argument — categories are global in
	// Saleor, only their products are per channel — so every category resolves in
	// every market and renders an empty listing at HTTP 200 with a self-canonical.
	// Twelve of the thirty are currently in that state and four of them sit in the
	// main navigation, so 404 is the wrong answer: it would 404 a URL the site
	// links to from every page. `noindex` with no canonical is the right one, and
	// it reverts on its own the moment the channel gets stock — no deploy.
	if ((category.products?.totalCount ?? 0) === 0) {
		return {
			title,
			description: category.seoDescription || plainDescription || category.seoTitle || category.name,
			robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
			// No canonical, deliberately: a self-canonical nominates the URL, which
			// is the opposite of what noindex is here to say.
		};
	}

	const canonical = buildCanonicalUrl(
		REVERSE_MAP[params.channel] || params.channel,
		categoryUrlFor(params.channel, baseSlugOf(params)),
	);

	return {
		title,
		description: category.seoDescription || plainDescription || category.seoTitle || category.name,
		// Category listings had no canonical at all, while product pages have always
		// had one. The toolbar appends ?sort= and filter params, so without this every
		// sort order is a separate indexable URL competing with the clean one. Points
		// at the bare path, deliberately dropping the query. No hreflang: the slugs are
		// Slovak and the other markets' category pages are unverified — matching what
		// the PDP does rather than asserting pages that may not resolve.
		alternates: {
			// `categoryUrlFor`, not `/${category.slug}`. That form pointed all 22 categories outside
			// the catalogue — `nordrive-stresne-nosice` among them — at a root URL the proxy does not
			// route: on maky.store 2026-09-16 the canonical of `/sk/categories/nordrive-stresne-nosice`
			// was `/sk/nordrive-stresne-nosice`, which answers "Produkt nenájdený" with `noindex`. And
			// abroad `category.slug` is whatever Saleor's translation says, not the URL routed here.
			canonical,
			// The same category, in each live market where it resolves in that market's language
			// and holds products — the two conditions under which that page is indexable too.
			languages: counterpartAlternates(
				REVERSE_MAP[params.channel] || params.channel,
				await categoryCounterparts(baseSlugOf(params)),
			),
		},
		openGraph: marketOpenGraph(params.channel, canonical),
	};
};

export default function Page(props: PageProps) {
	return (
		<Suspense fallback={<PageSkeleton />}>
			<CategoryContent params={props.params} searchParams={props.searchParams} />
		</Suspense>
	);
}

async function CategoryContent({
	params: paramsPromise,
	searchParams,
}: {
	params: PageProps["params"];
	searchParams: PageProps["searchParams"];
}) {
	const params = await paramsPromise;
	const baseSlug = baseSlugOf(params);
	const [outcome, t, navigation] = await Promise.all([
		getCategoryOutcome(baseSlug, params.channel),
		getTranslations({ locale: getLocaleFromChannel(params.channel), namespace: "plp" }),
		// The parent and the row of sub-categories are a way around the listing, not the listing:
		// a fault leaves them out and the page renders as before.
		getCategoryNavigation(baseSlug, params.channel).catch((error: unknown) => {
			console.warn(
				`[Listing] category navigation left out for ${baseSlug}:`,
				error instanceof Error ? error.message : error,
			);
			return null;
		}),
	]);

	// A fault is not an absence. notFound() here would claim a live category is
	// gone every time Saleor hiccups.
	if (outcome.status === "upstream-error") {
		logUpstreamError("category", outcome, { slug: params.slug, channel: params.channel });
		throw new Error(`category lookup failed for ${params.slug}: ${outcome.message}`);
	}

	if (outcome.status === "not-found") {
		notFound();
	}

	const category = outcome.resource;
	const plainDescription = parseEditorJSToText(category.description);

	const breadcrumbs = [
		{ label: t("home"), href: marketHref(params.channel) },
		...(navigation?.parent ? [{ label: navigation.parent.name, href: navigation.parent.href }] : []),
		{ label: category.name, href: marketHref(params.channel, categoryUrlFor(params.channel, baseSlug)) },
	];

	return (
		<>
			{/* Own boundary: it asks the other live channels, and the listing must never wait. */}
			<Suspense fallback={null}>
				<CategorySwitchTargets baseSlug={baseSlug} />
			</Suspense>
			<CategoryHero
				title={category.name}
				description={plainDescription}
				backgroundImage={category.backgroundImage?.url}
				breadcrumbs={breadcrumbs}
			>
				{navigation?.chips && (
					<SubcategoryNav label={t("subcategories")} allLabel={t("allInCategory")} chips={navigation.chips} />
				)}
			</CategoryHero>
			<Suspense fallback={<ProductsGridSkeleton />}>
				<CategoryProducts params={paramsPromise} searchParams={searchParams} />
			</Suspense>
			{/* Below the listing, and in its own Suspense: reading the 9.7 MB catalogue
			    snapshot must never hold up the products this page exists to show. It
			    renders nothing at all for a category that has no vehicle pages, so the
			    boundary has no fallback — there is nothing to reserve space for. */}
			<Suspense fallback={null}>
				<CatalogMakeIndex channel={params.channel} slug={categorySegment(params.channel, baseSlug)} />
			</Suspense>
		</>
	);
}

/**
 * The same category at each live market's own localized root, for the header's market
 * switcher — which used to keep this market's segment (`/cz/stresni-nosice` →
 * `/de/stresni-nosice`, a path the German proxy does not route).
 */
async function CategorySwitchTargets({ baseSlug }: { baseSlug: string }) {
	const counterparts = await categoryCounterparts(baseSlug);
	return (
		<MarketSwitchTargets paths={Object.fromEntries(counterparts.map(({ market, path }) => [market, path]))} />
	);
}

type ListingProduct = NonNullable<
	NonNullable<ProductListByCategoryQuery["category"]>["products"]
>["edges"][number]["node"];

type GroupedCategory = NonNullable<ProductListByCategoryGroupedQuery["category"]>;

/** One page of a category listing, however it was ordered. */
interface CategoryListing {
	category: Pick<
		Category,
		"id" | "name" | "slug" | "description" | "seoDescription" | "seoTitle" | "translation"
	>;
	products: ListingProduct[];
	totalCount: number;
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor?: string | null;
		endCursor?: string | null;
	};
	/** Accessories on this page, when the page is in the grouped order and the category also has main products. */
	accessoryIds: string[];
}

async function CategoryProducts({
	params: paramsPromise,
	searchParams: searchParamsPromise,
}: {
	params: PageProps["params"];
	searchParams: PageProps["searchParams"];
}) {
	const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
	const baseSlug = baseSlugOf(params);

	const sortBy = buildSortVariables(searchParams.sort);
	const vehicleFilter = await resolveVehicleListingFilter(isVehicleFilterRequested(searchParams.vehicle), {
		categorySlug: baseSlug,
	});
	const filter = buildFilterVariables({
		priceRange: searchParams.price,
		vehicleProductIds: vehicleFilterIds(vehicleFilter),
	});
	const locale = getLocaleFromChannel(params.channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	const [groups, priceBands, t] = await Promise.all([
		// The recommended order is Saleor's default order, grouped. A shopper's own order — by
		// price, by date — applies to the whole listing at once and needs no groups.
		sortBy ? null : getProductTypeGroups().catch(() => null),
		getCategoryPriceBands(baseSlug, params.channel).catch((error: unknown) => {
			console.warn(
				`[Listing] price filter left out for ${baseSlug}:`,
				error instanceof Error ? error.message : error,
			);
			return null;
		}),
		getTranslations({ locale, namespace: "plp" }),
	]);

	const failed = (result: Parameters<typeof upstreamError>[0], scope: string): never => {
		// This runs in a NESTED Suspense, after CategoryHero has already streamed —
		// so the outer lookup has just proved the category exists. Calling notFound()
		// on a transport failure here painted 404 content underneath a hero for a
		// category that is demonstrably there. An error is an error.
		logUpstreamError(scope, upstreamError(result), { slug: baseSlug, channel: params.channel });
		throw new Error(`category product list failed for ${baseSlug}: ${result.error.message}`);
	};

	let listing: CategoryListing | null = null;

	if (groups) {
		const outcome = await loadGroupedPage(
			parseGroupPosition(searchParams),
			ProductsPerPage,
			async (request) => {
				const result = await lookupBySlug(
					locale,
					(data: ProductListByCategoryGroupedQuery) => data.category,
					(slugLang) =>
						executePublicGraphQL(ProductListByCategoryGroupedDocument, {
							variables: {
								slug: baseSlug,
								channel: params.channel,
								lang,
								slugLang,
								mainFirst: request.main.first,
								mainAfter: request.main.after ?? null,
								mainLast: request.main.last,
								mainBefore: request.main.before ?? null,
								mainFilter: { ...filter, productTypes: [...groups.main] },
								accessoriesFirst: request.accessories.first,
								accessoriesAfter: request.accessories.after ?? null,
								accessoriesLast: request.accessories.last,
								accessoriesBefore: request.accessories.before ?? null,
								accessoriesFilter: { ...filter, productTypes: [...groups.accessories] },
								allFilter: filter ?? null,
							},
							revalidate: 300,
						}),
				);
				if (!result.ok) return failed(result, "category-products");
				const category: GroupedCategory | null | undefined = result.data.category;
				if (!category?.main || !category.accessories) return null;
				return {
					category,
					main: category.main,
					accessories: category.accessories,
					all: category.all?.totalCount ?? 0,
				};
			},
		);

		if (outcome.status === "not-found") notFound();
		if (outcome.status === "incomplete") {
			// A product whose type is in neither group — a type created after the list was read.
			// Saleor's own order hides nothing, so that is what this page falls back to.
			console.warn(
				`[Listing] grouped order skipped for ${baseSlug}: main ${outcome.main} + accessories ${outcome.accessories} ≠ ${outcome.all}`,
			);
		} else {
			const { page, category } = outcome;
			const headed = page.totals.main > 0 && page.totals.accessories > 0;
			listing = {
				category,
				products: page.items.map((item) => item.node),
				totalCount: page.totals.main + page.totals.accessories,
				pageInfo: page.pageInfo,
				accessoryIds: headed
					? page.items.filter((item) => item.group === "accessories").map((item) => item.node.id)
					: [],
			};
		}
	}

	if (!listing) {
		// A cursor from the grouped order means nothing to Saleor's own: start from the top.
		const paginationVariables = getPaginatedListVariables({
			params: isGroupCursor(searchParams.cursor) ? {} : searchParams,
		});
		const result = await lookupBySlug(
			locale,
			(data: ProductListByCategoryQuery) => data.category,
			(slugLang) =>
				executePublicGraphQL(ProductListByCategoryDocument, {
					variables: {
						slug: baseSlug,
						channel: params.channel,
						lang,
						slugLang,
						...paginationVariables,
						sortBy,
						filter,
					},
					revalidate: 300,
				}),
		);
		if (!result.ok) return failed(result, "category-products");
		const category = result.data.category;
		if (!category?.products) notFound();
		listing = {
			category,
			products: category.products.edges.map((edge) => edge.node),
			totalCount: category.products.totalCount ?? 0,
			pageInfo: category.products.pageInfo,
			accessoryIds: [],
		};
	}

	if (!resolveExactLocaleCategory(listing.category, locale)) {
		notFound();
	}

	const localized = resolveExactLocaleProducts(listing.products, locale);
	const productCards = localized.products.map((product) =>
		transformToProductCard(product, params.channel, locale),
	);

	const priceFilter: PriceFilter | null =
		priceBands && priceBands.boundaries.length > 0
			? {
					currency: priceBands.currency,
					ranges: priceRangeOptions(priceBands.boundaries, priceBandFormatter(locale, priceBands.currency), {
						under: (max) => t("priceUnder", { max }),
						between: (min, max) => t("priceBetween", { min, max }),
						over: (min) => t("priceOver", { min }),
					}),
				}
			: null;

	return (
		<>
			<div className="mx-auto w-full max-w-7xl px-4 pt-6 empty:hidden sm:px-6 lg:px-8">
				<VehicleListingFilter
					channel={params.channel}
					filter={vehicleFilter}
					// categoryUrlFor(), not a hand-built `/categories/…`: a catalogue category now
					// lives at the root, and this path is what every vehicle-filter link is
					// built from. Hard-coding the retired shape would make each filter click a
					// 308 hop, and would reintroduce exactly the two-places-one-slug drift the
					// catalogue was created to end.
					basePath={categoryUrlFor(params.channel, baseSlug)}
					searchParams={searchParams}
				/>
			</div>
			<CategoryPageClient
				products={productCards}
				totalCount={listing.totalCount}
				localeDropped={localized.dropped}
				pageInfo={listing.pageInfo}
				priceFilter={priceFilter}
				accessoryIds={listing.accessoryIds}
				vehicleFilterEmpty={vehicleFilter.state === "empty"}
			/>
		</>
	);
}

function PageSkeleton() {
	return (
		<div className="animate-skeleton-delayed opacity-0">
			<div className="bg-surface-muted px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<div className="bg-surface-secondary h-8 w-48 animate-pulse rounded-sm" />
					<div className="bg-surface-secondary mt-3 h-4 w-96 max-w-full animate-pulse rounded-sm" />
				</div>
			</div>
			<ProductsGridSkeleton />
		</div>
	);
}

function ProductsGridSkeleton() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="animate-pulse">
						<div className="bg-surface-muted mb-4 aspect-[3/4] rounded-md" />
						<div className="space-y-1.5">
							<div className="bg-surface-muted h-4 w-3/4 rounded-sm" />
							<div className="bg-surface-muted h-4 w-1/2 rounded-sm" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
