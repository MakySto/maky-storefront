import { Suspense } from "react";
import { type Metadata } from "next";
import {
	ProductListByCollectionDocument,
	type ProductListByCollectionQuery,
	ProductOrderField,
	OrderDirection,
} from "@/gql/graphql";
import { buildAlternatesMetadata } from "@/lib/seo/hreflang";
import { executePublicGraphQL } from "@/lib/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { ProductList } from "@/ui/components/product-list";
import { HeroSection, CategoryGrid, WhyMaky, BrandsStrip, NewsletterCTA } from "@/ui/components/homepage";
import {
	ActiveVehicleLauncher,
	ActiveVehicleLauncherSkeleton,
} from "@/ui/components/vehicle/active-vehicle-launcher";
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
	// Homepage owns the market canonical (/{market}) + hreflang alternates.
	return buildAlternatesMetadata(channel);
}

export default function Page(props: { params: Promise<{ channel: string }> }) {
	return (
		<>
			{/* The hero CTA is request-time (it names the saved car), the rest of the hero
			    is not. Its own boundary keeps the static shell for everything else. */}
			<HeroSection
				vehicleAction={
					<Suspense fallback={<ActiveVehicleLauncherSkeleton variant="hero" />}>
						<ActiveVehicleLauncher variant="hero" />
					</Suspense>
				}
			/>
			<CategoryGrid />

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

	const t = await getTranslations("home");

	return (
		<section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
			<h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{t("featuredTitle")}</h2>
			<div className="mt-8">
				<ProductList products={products} />
			</div>
		</section>
	);
}

function FeaturedProductsSkeleton() {
	return (
		<section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
			<div className="mt-8">
				<ul
					role="list"
					data-testid="ProductList"
					className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{Array.from({ length: 8 }).map((_, i) => (
						<li key={i} className="animate-pulse">
							<div className="aspect-square overflow-hidden rounded-lg bg-gray-100" />
							<div className="mt-3 flex justify-between">
								<div>
									<div className="h-4 w-32 rounded bg-gray-100" />
									<div className="mt-2 h-4 w-20 rounded bg-gray-100" />
								</div>
								<div className="h-4 w-16 rounded bg-gray-100" />
							</div>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
