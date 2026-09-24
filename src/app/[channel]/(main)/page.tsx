import { Suspense } from "react";
import { type Metadata } from "next";
import {
	ProductListByCollectionDocument,
	type ProductListByCollectionQuery,
	ProductOrderField,
	OrderDirection,
} from "@/gql/graphql";
import { buildAlternatesMetadata } from "@/lib/seo/hreflang";
import { marketOpenGraph } from "@/lib/seo/metadata";
import { formatPageTitle } from "@/config/brand";
import { executePublicGraphQL } from "@/lib/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { ProductGrid, transformToProductCard } from "@/ui/components/plp";
import {
	HeroSection,
	HeroPhotoFrame,
	HeroShowcasePhoto,
	HeroVehicleActions,
	HeroVehicleActionsSkeleton,
	CategoryGrid,
	CategoryGridPhotos,
	WhyMaky,
	BrandsStrip,
	NewsletterCTA,
	HomepageStructuredData,
} from "@/ui/components/homepage";
import { getTranslations } from "next-intl/server";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleCollection, resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";

async function getFeaturedProducts(channel: string) {
	"use cache";
	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	applyCacheProfile(CACHE_PROFILES.collections, { channel, locale, slug: "featured-products" });

	const result = await lookupBySlug(
		locale,
		(data: ProductListByCollectionQuery) => data.collection,
		(slugLang) =>
			executePublicGraphQL(ProductListByCollectionDocument, {
				variables: {
					slug: "featured-products",
					channel,
					lang,
					slugLang,
					first: 12,
					sortBy: { field: ProductOrderField.Collection, direction: OrderDirection.Asc },
				},
				revalidate: 300,
			}),
	);

	if (!result.ok) {
		console.warn(`[Homepage] Failed to fetch featured products for ${channel}:`, result.error.message);
		return [];
	}

	const collection = resolveExactLocaleCollection(result.data.collection, locale);
	if (!collection?.products) return [];
	return resolveExactLocaleProducts(
		collection.products.edges.map(({ node }) => node),
		locale,
	).products;
}

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });

	// `absolute`, because the (main) layout pins the bare site name as the title of
	// every page that does not set its own. That is right for the rest of the site
	// and wrong here: the homepage is the one page whose title has to say what the
	// shop sells, and "MAKY.STORE" says nothing. It mirrors the H1 on purpose.
	//
	// og:title and twitter:title are NOT set here — Next fills them from the
	// resolved title and description, which is how the current (wrong) values got
	// there in the first place.
	//
	// Homepage owns the market canonical (/{market}) + hreflang alternates, and og:url is
	// that canonical.
	const { alternates } = buildAlternatesMetadata(channel);
	return {
		title: { absolute: formatPageTitle(t("heroTitle")) },
		description: t("metaDescription"),
		alternates,
		openGraph: marketOpenGraph(channel, alternates.canonical),
	};
}

export default function Page(props: { params: Promise<{ channel: string }> }) {
	return (
		<>
			{/* OnlineStore + WebSite — who sells here, the return window, delivery times.
			    The homepage is the one page that describes the shop in full; product pages
			    point at it by `@id`. */}
			<Suspense fallback={null}>
				<HomepageStructuredData params={props.params} />
			</Suspense>

			{/* The hero's vehicle action is request-time (it reads the saved car) and its photo
			    comes from Saleor; each has its own boundary and a same-size fallback, so the
			    title and the copy stay in the static shell and nothing moves when they land. */}
			<HeroSection
				vehicleAction={
					<Suspense fallback={<HeroVehicleActionsSkeleton />}>
						<HeroVehicleActions params={props.params} />
					</Suspense>
				}
				showcase={
					<Suspense fallback={<HeroPhotoFrame />}>
						<HeroShowcasePhoto params={props.params} />
					</Suspense>
				}
			/>
			<Suspense fallback={<CategoryGrid images={null} />}>
				<CategoryGridPhotos params={props.params} />
			</Suspense>

			{/* Featured Products — the whole section (heading included) renders only when the
			    featured-products collection is non-empty; otherwise it is hidden entirely. */}
			<Suspense fallback={<FeaturedProductsSkeleton />}>
				<FeaturedProducts params={props.params} />
			</Suspense>

			<WhyMaky />
			<BrandsStrip />
			<NewsletterCTA />
		</>
	);
}

async function FeaturedProducts({ params: paramsPromise }: { params: Promise<{ channel: string }> }) {
	const { channel } = await paramsPromise;
	const products = await getFeaturedProducts(channel);

	// No featured products yet → hide the whole section (no heading, no English placeholder).
	if (products.length === 0) {
		return null;
	}

	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "home" });

	// The same card and grid as a category page — one product card across the shop.
	return (
		<section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<h2 className="text-text-primary text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
				{t("featuredTitle")}
			</h2>
			<div className="mt-6 sm:mt-8">
				<ProductGrid products={products.map((product) => transformToProductCard(product, channel, locale))} />
			</div>
		</section>
	);
}

/**
 * The featured section while it streams: the same heading slot and the same grid of the same
 * cards (photo square, three title lines, purchase row), so the real section lands in place.
 */
function FeaturedProductsSkeleton() {
	return (
		<section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-hidden="true">
			<div className="bg-surface-secondary h-8 w-64 animate-pulse rounded-xs sm:h-9" />
			<div className="mt-6 grid w-full grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						key={i}
						className="border-border-subtle bg-surface-card grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-lg border p-3 sm:flex sm:flex-col sm:gap-0 sm:p-0"
					>
						<div className="bg-surface-secondary aspect-square animate-pulse rounded-sm sm:rounded-none" />
						<div className="space-y-2 sm:px-4 sm:pt-3">
							<div className="bg-surface-secondary h-3 w-24 rounded-xs" />
							<div className="bg-surface-secondary h-4 w-full rounded-xs sm:h-[3lh]" />
							<div className="bg-surface-secondary h-5 w-20 rounded-xs" />
						</div>
						<div className="bg-surface-secondary col-span-2 h-11 rounded-sm sm:mx-4 sm:mt-3 sm:mb-4" />
					</div>
				))}
			</div>
		</section>
	);
}
