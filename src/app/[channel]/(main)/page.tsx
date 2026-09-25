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
import { transformToProductCard } from "@/ui/components/plp";
import { FeaturedShowcase } from "@/ui/components/homepage/featured-showcase";
import {
	HeroSection,
	HeroProductCard,
	HeroVehicleActions,
	HeroVehicleActionsSkeleton,
	CategoryGrid,
	CategoryGridPhotos,
	HomeVehicleBlock,
	HomeVehicleBlockSkeleton,
	BrandsStrip,
	AdviceAndNewsletter,
	HomepageStructuredData,
} from "@/ui/components/homepage";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { getSceneryOrNone } from "@/lib/homepage/scenery";
import { HERO_SCENERY } from "@/config/storefront-imagery";
import { getTranslations } from "next-intl/server";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { resolveExactLocaleCollection, resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";

/**
 * How many featured products the homepage shows: two rows of five on a wide desktop. Eight or
 * twelve work as well; the grid does not need a full last row, and nothing is ever duplicated to
 * fill one.
 */
const FEATURED_PRODUCTS_LIMIT = 10;

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
					first: FEATURED_PRODUCTS_LIMIT,
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

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	// Scenery is cached for hours and never throws here; without it the hero is its dark ground.
	const scenery = await getSceneryOrNone(channel);

	return (
		<>
			{/* OnlineStore + WebSite — who sells here, the return window, delivery times.
			    The homepage is the one page that describes the shop in full; product pages
			    point at it by `@id`. */}
			<Suspense fallback={null}>
				<HomepageStructuredData params={props.params} />
			</Suspense>

			{/* The photo, the words and the buttons are in the static shell. The vehicle action is
			    request-time (it reads the saved car) and the floating product card is this market's
			    product; each has its own boundary, so nothing moves when they land. */}
			<HeroSection
				channel={channel}
				photo={scenery?.hero ?? null}
				vehicleAction={
					<Suspense fallback={<HeroVehicleActionsSkeleton />}>
						<HeroVehicleActions params={props.params} />
					</Suspense>
				}
				// Not in a Suspense boundary of its own: its data is cached, so it resolves in the
				// static shell, and a completed boundary this far down the page would be outlined
				// behind the footer (the flush is past React's 12 800-byte chunk by now).
				productCard={
					<HeroProductCard
						params={props.params}
						// "Na fotke" only when the photo is the product's own; over the owner's
						// illustration from Payload the card recommends instead.
						showsProduct={scenery?.hero?.source === "saleor" && HERO_SCENERY.showsProduct}
					/>
				}
			/>
			<Suspense fallback={<CategoryGrid photos={null} />}>
				<CategoryGridPhotos params={props.params} />
			</Suspense>

			<Suspense fallback={<HomeVehicleBlockSkeleton />}>
				<HomeVehicleBlock params={props.params} />
			</Suspense>

			{/* Featured Products — the whole section (heading included) renders only when the
			    featured-products collection is non-empty; otherwise it is hidden entirely. */}
			<Suspense fallback={<FeaturedProductsSkeleton />}>
				<FeaturedProducts params={props.params} />
			</Suspense>

			<BrandsStrip channel={channel} />
			{/* Inline, like the product card above: cached reads only, and an empty-fallback
			    boundary here would be outlined after the footer and push it down on arrival. */}
			<AdviceAndNewsletter channel={channel} photo={scenery?.advice ?? null} />
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

	// The same card as a category page — one product card across the shop — in the homepage's
	// five-column rows, with a tab per category the collection holds.
	return (
		<section className="max-w-page mx-auto px-4 pt-10 pb-6 sm:px-6 sm:pt-14 lg:px-8">
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">
					{t("featuredTitle")}
				</h2>
				<Link
					href={marketHref(channel, "/products")}
					className="text-text-primary hover:text-brand group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
				>
					{t("featuredAll")}
					<ArrowRightIcon
						className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
						strokeWidth={2.25}
						aria-hidden="true"
					/>
				</Link>
			</div>
			<FeaturedShowcase
				products={products.map((product) => transformToProductCard(product, channel, locale))}
				allLabel={t("featuredTabAll")}
				tabsLabel={t("featuredTitle")}
			/>
		</section>
	);
}

/**
 * The featured section while it streams: the same heading slot and the same grid of the same
 * cards (photo square, three title lines, purchase row), so the real section lands in place.
 */
function FeaturedProductsSkeleton() {
	return (
		<section className="max-w-page mx-auto px-4 pt-10 pb-6 sm:px-6 sm:pt-14 lg:px-8" aria-hidden="true">
			<div className="bg-surface-secondary h-8 w-64 animate-pulse rounded-xs sm:h-9" />
			<div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 min-[90rem]:grid-cols-5">
				{Array.from({ length: FEATURED_PRODUCTS_LIMIT }).map((_, i) => (
					<div key={i} className="border-border-default bg-surface-card flex flex-col rounded-sm border">
						<div className="bg-surface-secondary aspect-[5/4] animate-pulse rounded-t-sm" />
						<div className="space-y-2 px-4 pt-3">
							<div className="bg-surface-secondary h-3 w-24 rounded-xs" />
							<div className="bg-surface-secondary h-[2lh] w-full rounded-xs" />
							<div className="bg-surface-secondary h-6 w-20 rounded-xs" />
						</div>
						<div className="bg-surface-secondary mx-4 mt-3 mb-4 h-11 rounded-xs" />
					</div>
				))}
			</div>
		</section>
	);
}
