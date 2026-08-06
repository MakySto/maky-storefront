import { Suspense } from "react";
import { notFound } from "next/navigation";
import { type ResolvingMetadata, type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductListByCategoryDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { getPaginatedListVariables } from "@/lib/utils";
import { parseEditorJSToText } from "@/lib/editorjs";
import { CategoryHero, transformToProductCard } from "@/ui/components/plp";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { buildCanonicalUrl } from "@/lib/seo/hreflang";
import { buildSortVariables, buildFilterVariables } from "@/ui/components/plp/filter-utils";
import { CategoryPageClient } from "./client";

async function getCategoryData(slug: string, channel: string) {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.categories, slug);

	const result = await executePublicGraphQL(ProductListByCategoryDocument, {
		variables: { slug, channel, first: 1 },
		revalidate: 300,
	});

	if (!result.ok) {
		console.error(`[getCategoryData] Failed to fetch category ${slug}:`, result.error.message);
		return null;
	}

	return result.data.category;
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
	}>;
};

export const generateMetadata = async (props: PageProps, parent: ResolvingMetadata): Promise<Metadata> => {
	const params = await props.params;
	const category = await getCategoryData(params.slug, params.channel);

	if (!category) {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here.
		const t = await getTranslations("pages");
		return {
			title: t("notFound"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const plainDescription = parseEditorJSToText(category.description);

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
			title: `${category.name} | ${category.seoTitle || (await parent).title?.absolute}`,
			description: category.seoDescription || plainDescription || category.seoTitle || category.name,
			robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
			// No canonical, deliberately: a self-canonical nominates the URL, which
			// is the opposite of what noindex is here to say.
		};
	}

	return {
		title: `${category.name} | ${category.seoTitle || (await parent).title?.absolute}`,
		description: category.seoDescription || plainDescription || category.seoTitle || category.name,
		// Category listings had no canonical at all, while product pages have always
		// had one. The toolbar appends ?sort= and filter params, so without this every
		// sort order is a separate indexable URL competing with the clean one. Points
		// at the bare path, deliberately dropping the query. No hreflang: the slugs are
		// Slovak and the other markets' category pages are unverified — matching what
		// the PDP does rather than asserting pages that may not resolve.
		alternates: {
			canonical: buildCanonicalUrl(
				REVERSE_MAP[params.channel] || params.channel,
				`/categories/${params.slug}`,
			),
		},
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
	const [category, t] = await Promise.all([
		getCategoryData(params.slug, params.channel),
		getTranslations("plp"),
	]);

	if (!category) {
		notFound();
	}

	const plainDescription = parseEditorJSToText(category.description);

	const breadcrumbs = [
		{ label: t("home"), href: marketHref(params.channel) },
		{ label: category.name, href: marketHref(params.channel, `/categories/${params.slug}`) },
	];

	return (
		<>
			<CategoryHero
				title={category.name}
				description={plainDescription}
				backgroundImage={category.backgroundImage?.url}
				breadcrumbs={breadcrumbs}
			/>
			<Suspense fallback={<ProductsGridSkeleton />}>
				<CategoryProducts params={paramsPromise} searchParams={searchParams} />
			</Suspense>
		</>
	);
}

async function CategoryProducts({
	params: paramsPromise,
	searchParams: searchParamsPromise,
}: {
	params: PageProps["params"];
	searchParams: PageProps["searchParams"];
}) {
	const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);

	const paginationVariables = getPaginatedListVariables({ params: searchParams });
	const sortBy = buildSortVariables(searchParams.sort);
	const filter = buildFilterVariables({ priceRange: searchParams.price });

	const result = await executePublicGraphQL(ProductListByCategoryDocument, {
		variables: {
			slug: params.slug,
			channel: params.channel,
			...paginationVariables,
			sortBy,
			filter,
		},
		revalidate: 300,
	});

	const products = result.ok ? result.data.category?.products : null;
	if (!products) {
		notFound();
	}

	const productCards = products.edges.map((e) => transformToProductCard(e.node, params.channel));

	return (
		<CategoryPageClient
			products={productCards}
			pageInfo={products.pageInfo}
			totalCount={products.totalCount ?? productCards.length}
		/>
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
