import { Suspense } from "react";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductListPaginatedDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { getPaginatedListVariables } from "@/lib/utils";
import { CategoryHero, transformToProductCard } from "@/ui/components/plp";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { buildSortVariables, buildFilterVariables } from "@/ui/components/plp/filter-utils";
import { resolveCategorySlugsToIds } from "@/ui/components/plp/filter-utils.server";
import { ProductsPageClient } from "./products-client";
import { brandConfig } from "@/config/brand";
import { buildCanonicalUrl } from "@/lib/seo/hreflang";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";

/**
 * The market's main listing had a static English metadata block — it served
 * `<title>Products</title>` on /sk/products, on a Slovak-first storefront, with
 * no brand suffix and no canonical.
 *
 * The suffix has to be appended by hand: `(main)/layout.tsx` sets
 * `title: { absolute: siteName }`, which terminates template inheritance, so a
 * `title.template` never reaches a page under [channel]. The canonical points at
 * the bare path, dropping ?sort= and the filter params, which otherwise make
 * every toolbar permutation a separate indexable URL competing with the clean
 * one — the same reasoning, and the same helper, as the category listing.
 *
 * The visible heading already used these two keys; only the metadata was English.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "plp" });

	return {
		title: `${t("allProducts")} | ${brandConfig.siteName}`,
		description: t("allProductsDescription"),
		alternates: {
			canonical: buildCanonicalUrl(REVERSE_MAP[channel] || channel, "/products"),
		},
	};
}

type PageProps = {
	params: Promise<{ channel: string }>;
	searchParams: Promise<{
		cursor?: string | string[];
		direction?: string | string[];
		sort?: string;
		price?: string;
		colors?: string;
		sizes?: string;
		categories?: string;
	}>;
};

/**
 * Products page with Cache Components.
 * Static shell (hero) renders immediately, product grid streams in.
 */
export default async function Page(props: PageProps) {
	const params = await props.params;
	const t = await getTranslations("plp");

	const breadcrumbs = [
		{ label: t("home"), href: marketHref(params.channel) },
		{ label: t("allProducts"), href: marketHref(params.channel, "/products") },
	];

	return (
		<>
			{/* Static shell - renders immediately */}
			<CategoryHero
				title={t("allProducts")}
				description={t("allProductsDescription")}
				breadcrumbs={breadcrumbs}
			/>
			{/* Dynamic content - streams in via Suspense */}
			<Suspense fallback={<ProductsGridSkeleton />}>
				<ProductsContent params={props.params} searchParams={props.searchParams} />
			</Suspense>
		</>
	);
}

/**
 * Dynamic products content - reads searchParams at request time.
 */
async function ProductsContent({
	params: paramsPromise,
	searchParams: searchParamsPromise,
}: {
	params: Promise<{ channel: string }>;
	searchParams: PageProps["searchParams"];
}) {
	const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);

	const paginationVariables = getPaginatedListVariables({ params: searchParams });
	const sortBy = buildSortVariables(searchParams.sort);
	const locale = getLocaleFromChannel(params.channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	// Parse category slugs from URL and resolve to IDs for server-side filtering
	const categorySlugs = searchParams.categories?.split(",").filter(Boolean) || [];
	const categoryMap = await resolveCategorySlugsToIds(categorySlugs, locale);
	const categoryIds = Array.from(categoryMap.values()).map((c) => c.id);

	const filter = buildFilterVariables({
		priceRange: searchParams.price,
		categoryIds,
	});

	const result = await executePublicGraphQL(ProductListPaginatedDocument, {
		variables: {
			...paginationVariables,
			channel: params.channel,
			lang,
			sortBy,
			filter,
		},
		revalidate: 300,
	});

	// /{market}/products always exists — it is the market's main listing. A
	// Saleor outage here used to render 404 content over a page that cannot be
	// missing; the right answer is an error, never an absence.
	if (!result.ok) {
		logUpstreamError("product-list", upstreamError(result), { channel: params.channel });
		throw new Error(`product listing failed for ${params.channel}: ${result.error.message}`);
	}

	if (!result.data.products) {
		throw new Error(`product listing returned no connection for ${params.channel}`);
	}

	const products = result.data.products;
	const localized = resolveExactLocaleProducts(
		products.edges.map((edge) => edge.node),
		locale,
	);
	const productCards = localized.products.map((product) =>
		transformToProductCard(product, params.channel, locale),
	);

	// Build resolved categories array for the client (for active filter display)
	// A category with no name for this locale still filters — it just gets no
	// chip, because the only name available would be Slovak. See
	// resolveCategorySlugsToIds.
	const resolvedCategories = categorySlugs
		.map((slug) => {
			const cat = categoryMap.get(slug);
			return cat && cat.name ? { slug, id: cat.id, name: cat.name } : null;
		})
		.filter(Boolean) as { slug: string; id: string; name: string }[];

	return (
		<ProductsPageClient
			products={productCards}
			totalCount={products.totalCount ?? 0}
			localeDropped={localized.dropped}
			pageInfo={products.pageInfo}
			resolvedCategories={resolvedCategories}
		/>
	);
}

/**
 * Products grid skeleton with delayed visibility.
 * Matches ProductGrid/ProductCard dimensions to prevent layout shift.
 */
function ProductsGridSkeleton() {
	return (
		<div className="animate-skeleton-delayed mx-auto max-w-7xl px-4 py-8 opacity-0 sm:px-6 lg:px-8">
			{/* Matches ProductGrid: grid-cols-2 lg:grid-cols-3 */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="animate-pulse">
						{/* Matches ProductCard: aspect-[3/4] rounded-xl */}
						<div className="bg-muted mb-4 aspect-[3/4] rounded-xl" />
						<div className="space-y-1.5">
							<div className="bg-muted h-4 w-3/4 rounded" />
							<div className="bg-muted h-4 w-1/2 rounded" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
