import { Suspense } from "react";
import { notFound } from "next/navigation";
import { type ResolvingMetadata, type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
	ProductListByCollectionDocument,
	ProductOrderField,
	OrderDirection,
	type ProductListByCollectionQuery,
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
import { parseEditorJSToText } from "@/lib/editorjs";
import { CategoryHero, transformToProductCard } from "@/ui/components/plp";
import { marketHref } from "@/lib/channel-map";
import { buildSortVariables, buildFilterVariables } from "@/ui/components/plp/filter-utils";
import { CollectionPageClient } from "./client";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleCollection, resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";

type Collection = NonNullable<ProductListByCollectionQuery["collection"]>;

async function getCollectionOutcomeCached(
	slug: string,
	channel: string,
	locale: string,
): Promise<AuthoritativeOutcome<Collection>> {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.collections, { channel, locale, slug });
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	const result = await lookupBySlug(
		locale,
		(data: ProductListByCollectionQuery) => data.collection,
		(slugLang) =>
			executePublicGraphQL(ProductListByCollectionDocument, {
				variables: { slug, channel, lang, slugLang, first: 1 },
				revalidate: 300,
			}),
	);

	// Throws on a fault, so the entry is never cached: an outage must not be
	// remembered as "this collection does not exist" for up to an hour.
	return refuseToCacheUpstreamError(
		toOutcome(result, (data) => resolveExactLocaleCollection(data.collection, locale)),
	);
}

/** `found` | `not-found` | `upstream-error`, shared by the page and its metadata. */
async function getCollectionOutcome(slug: string, channel: string): Promise<ResourceOutcome<Collection>> {
	const locale = getLocaleFromChannel(channel);
	return catchUpstreamError(() => getCollectionOutcomeCached(slug, channel, locale));
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
	const outcome = await getCollectionOutcome(params.slug, params.channel);

	if (outcome.status === "upstream-error") {
		// Could not verify. `noindex`, and no "not found" title — that would be a
		// claim we cannot support. This route emits no canonical on any branch.
		return { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
	}

	if (outcome.status === "not-found") {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here
		// until the proxy gate lands.
		const t = await getTranslations("pages");
		return {
			title: t("notFound"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const collection = outcome.resource;
	const plainDescription = parseEditorJSToText(collection.description);

	return {
		title: `${collection.name} | ${collection.seoTitle || (await parent).title?.absolute}`,
		description: collection.seoDescription || plainDescription || collection.seoTitle || collection.name,
	};
};

/**
 * Sync page shell with dedicated Suspense boundary.
 * Cached hero + dynamic product grid stream inside this boundary,
 * not through the layout's main Suspense.
 */
export default function Page(props: PageProps) {
	return (
		<Suspense fallback={<PageSkeleton />}>
			<CollectionContent params={props.params} searchParams={props.searchParams} />
		</Suspense>
	);
}

async function CollectionContent({
	params: paramsPromise,
	searchParams,
}: {
	params: PageProps["params"];
	searchParams: PageProps["searchParams"];
}) {
	const params = await paramsPromise;
	const [outcome, t] = await Promise.all([
		getCollectionOutcome(params.slug, params.channel),
		getTranslations("plp"),
	]);

	// A fault is not an absence.
	if (outcome.status === "upstream-error") {
		logUpstreamError("collection", outcome, { slug: params.slug, channel: params.channel });
		throw new Error(`collection lookup failed for ${params.slug}: ${outcome.message}`);
	}

	if (outcome.status === "not-found") {
		notFound();
	}

	const collection = outcome.resource;
	const plainDescription = parseEditorJSToText(collection.description);

	const breadcrumbs = [
		{ label: t("home"), href: marketHref(params.channel) },
		{ label: collection.name, href: marketHref(params.channel, `/collections/${collection.slug}`) },
	];

	return (
		<>
			<CategoryHero
				title={collection.name}
				description={plainDescription}
				backgroundImage={collection.backgroundImage?.url}
				breadcrumbs={breadcrumbs}
			/>
			<Suspense fallback={<ProductsGridSkeleton />}>
				<CollectionProducts params={paramsPromise} searchParams={searchParams} />
			</Suspense>
		</>
	);
}

async function CollectionProducts({
	params: paramsPromise,
	searchParams: searchParamsPromise,
}: {
	params: PageProps["params"];
	searchParams: PageProps["searchParams"];
}) {
	const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);

	const paginationVariables = getPaginatedListVariables({ params: searchParams });
	const sortBy = buildSortVariables(searchParams.sort) ?? {
		field: ProductOrderField.Collection,
		direction: OrderDirection.Asc,
	};
	const filter = buildFilterVariables({ priceRange: searchParams.price });
	const locale = getLocaleFromChannel(params.channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;

	const result = await lookupBySlug(
		locale,
		(data: ProductListByCollectionQuery) => data.collection,
		(slugLang) =>
			executePublicGraphQL(ProductListByCollectionDocument, {
				variables: {
					slug: params.slug,
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

	// Nested Suspense, below a hero that already proved the collection exists.
	// A transport failure here is an error, not an absence.
	if (!result.ok) {
		logUpstreamError("collection-products", upstreamError(result), {
			slug: params.slug,
			channel: params.channel,
		});
		throw new Error(`collection product list failed for ${params.slug}: ${result.error.message}`);
	}

	const collection = resolveExactLocaleCollection(result.data.collection, locale);
	const products = collection?.products;
	if (!products) {
		notFound();
	}

	const localized = resolveExactLocaleProducts(
		products.edges.map((edge) => edge.node),
		locale,
	);
	const productCards = localized.products.map((product) =>
		transformToProductCard(product, params.channel, locale),
	);

	return (
		<CollectionPageClient
			products={productCards}
			totalCount={products.totalCount ?? 0}
			localeDropped={localized.dropped}
			pageInfo={products.pageInfo}
		/>
	);
}

function PageSkeleton() {
	return (
		<div className="animate-skeleton-delayed opacity-0">
			<div className="bg-muted px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<div className="bg-muted-foreground/10 h-8 w-48 animate-pulse rounded" />
					<div className="bg-muted-foreground/10 mt-3 h-4 w-96 max-w-full animate-pulse rounded" />
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
