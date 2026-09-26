import { Suspense, cache } from "react";
import { categoryUrlFor } from "@/config/category-routes";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { meaningfulTitle } from "@/config/brand";
import { ErrorBoundary } from "react-error-boundary";

import { getTranslations } from "next-intl/server";
import { executePublicGraphQL } from "@/lib/graphql";
import {
	catchUpstreamError,
	logUpstreamError,
	refuseToCacheUpstreamError,
	toOutcome,
	type AuthoritativeOutcome,
	type ResourceOutcome,
} from "@/lib/saleor/resource-outcome";
import { ProductDetailsDocument, type ProductDetailsQuery } from "@/gql/graphql";
import { buildPageMetadata, buildProductJsonLd } from "@/lib/seo";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { counterpartAlternates } from "@/lib/seo/hreflang";
import { productCounterparts } from "@/lib/seo/product-counterparts";
import { getProductMarketPresence } from "@/lib/saleor/product-presence";
import { previousProductSlug } from "@/lib/product-redirects";
import { productHref } from "@/lib/product-url";
import { Breadcrumbs } from "@/ui/components/breadcrumbs";
import { getGalleryImages } from "@/ui/components/pdp/gallery-images";
import { PdpVehicleApplications } from "@/ui/components/fitment/pdp-vehicle-applications";
import { ProductHighlights } from "@/ui/components/pdp/product-highlights";
import { cn } from "@/lib/utils";
import {
	ProductGallery,
	ProductSpecs,
	VariantSectionDynamic,
	VariantSectionSkeleton,
	VariantSectionError,
} from "@/ui/components/pdp";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { parseEditorJSToHtml } from "@/lib/editorjs";
import { isSourceLocale, resolveExactLocaleProduct } from "@/lib/saleor/exact-locale";
import { lookupBySlug } from "@/lib/saleor/slug-lookup";
import { productAnswerTags } from "@/lib/saleor/product-cache-tags";
import { publicSku } from "@/lib/product-code";
import { MarketSwitchTargets } from "@/ui/components/header/market-switch-targets";

/** CFM's manufacturer attribute, keyed on externalReference — see product-attributes.ts. */
const MANUFACTURER_REF = "cfm:attribute:manufacturer";

// ============================================================================
// Cached Data Fetching
// ============================================================================

type Product = NonNullable<ProductDetailsQuery["product"]>;

/**
 * The product in the market's language, plus the one thing the exact-locale boundary
 * overwrites and the page still needs: the BASE slug (`Product.slug`). Abroad `slug` is the
 * translated slug — the market's URL — while every other market, the revalidation event and
 * the cache key of the Slovak page know the product by its base slug.
 */
type LocalizedProduct = Product & { baseSlug: string };

/**
 * The most a product page's own product may take to arrive, retries included.
 *
 * It had no bound but the transport's: 15 s per attempt, three retries with back-off — about a
 * minute, past nginx's 60 s. A crawler that is served the finished page (`htmlLimitedBots`)
 * waits for this answer before the first byte, and on 2026-09-25 one waited 43.8 s. A healthy
 * answer takes ~0.1 s; past this budget the page takes its "temporarily unavailable" path, which
 * is never cached and recovers on the next request. Generous on purpose: a visitor would rather
 * wait a few seconds for a slow Saleor than see that state, and a crawler is not held by it —
 * while Saleor is unwell the proxy answers crawlers 503 before any rendering (`saleorUnwell`).
 * Measured on a preview with every Saleor query slowed by 8 s: 8.4 s with a 6 s budget, against
 * about a minute without one.
 */
const PRODUCT_DEADLINE_MS = 8_000;

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
 * `found` | `not-found` | `upstream-error`, shared by the page and its metadata.
 *
 * `cache()` so the two share one answer per request explicitly — including a fault, which is
 * never stored across requests but must not be asked for twice, with retries, inside one.
 */
export const getProductOutcome = cache(
	async (slug: string, channel: string): Promise<ResourceOutcome<LocalizedProduct>> => {
		const locale = getLocaleFromChannel(channel);
		return catchUpstreamError(() => getProductOutcomeCached(slug, channel, locale));
	},
);

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata(props: {
	params: Promise<{ productSlug: string; channel: string }>;
}): Promise<Metadata> {
	const params = await props.params;
	const outcome = await getProductOutcome(params.productSlug, params.channel);

	if (outcome.status === "upstream-error") {
		// We could not find out whether this product exists. `noindex` and NO
		// canonical — nominating a URL we failed to verify is how a transient
		// fault turns into an indexed page — but deliberately no "not found"
		// title either, because that would be a claim we cannot support.
		return { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
	}

	if (outcome.status === "not-found") {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here
		// until the proxy gate lands.
		const t = await getTranslations({
			locale: getLocaleFromChannel(params.channel),
			namespace: "product",
		});
		return {
			title: t("notFoundTitle"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const product = outcome.resource;
	const locale = getLocaleFromChannel(params.channel);
	// A seoTitle that is only the shop's name is a placeholder, not a title (see `meaningfulTitle`).
	const hasExplicitSeoTitle = isSourceLocale(locale)
		? Boolean(meaningfulTitle(product.seoTitle))
		: Boolean(meaningfulTitle(product.translation?.seoTitle));

	const description = product.seoDescription || product.name;
	// The gallery's first image, which already falls back to the thumbnail — and already
	// leaves the "no image" placeholder out. A second `|| product.thumbnail?.url` here would
	// put the placeholder straight back as the share image.
	const ogImage = getGalleryImages(product, null)[0]?.url;
	const priceAmount = product.pricing?.priceRange?.start?.gross?.amount;
	const priceCurrency = product.pricing?.priceRange?.start?.gross?.currency;

	const metadata = buildPageMetadata({
		channel: params.channel,
		title: meaningfulTitle(product.seoTitle) ?? product.name,
		titleSource: hasExplicitSeoTitle ? "seo" : "fallback",
		description,
		image: ogImage,
		url: productHref(params.channel, product.slug),
		openGraph:
			priceAmount && priceCurrency
				? {
						"product:price:amount": String(priceAmount),
						"product:price:currency": priceCurrency,
					}
				: undefined,
	});

	// hreflang only toward live markets where this product is published AND fully translated —
	// the same exact-locale boundary decides the second, inside `getProductMarketPresence`, which
	// asks every live market in one request and is shared with the market switcher below. With
	// `sk` alone live this costs nothing and says nothing; if Saleor cannot answer, the page
	// names only itself.
	const market = REVERSE_MAP[params.channel] ?? params.channel;
	const languages = counterpartAlternates(
		market,
		await productCounterparts(product, params.channel, getProductMarketPresence),
	);
	return languages ? { ...metadata, alternates: { ...metadata.alternates, languages } } : metadata;
}

// NOTE: generateStaticParams is intentionally omitted for product pages.
// All product pages are generated on-demand via ISR instead.

// ============================================================================
// Page Component
// ============================================================================

/**
 * Sync page shell with dedicated Suspense boundary.
 * All cached product data + dynamic variant section stream inside
 * this boundary, not through the layout's main Suspense.
 */
export default function ProductPage(props: {
	params: Promise<{ productSlug: string; channel: string }>;
	searchParams: Promise<{ variant?: string }>;
}) {
	return (
		<Suspense fallback={<ProductPageSkeleton />}>
			<ProductContent params={props.params} searchParams={props.searchParams} />
		</Suspense>
	);
}

async function ProductContent({
	params: paramsPromise,
	searchParams: searchParamsPromise,
}: {
	params: Promise<{ productSlug: string; channel: string }>;
	searchParams: Promise<{ variant?: string }>;
}) {
	const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);

	const outcome = await getProductOutcome(params.productSlug, params.channel);

	// An upstream fault is NOT an absence. Calling notFound() here would tell the world a
	// live, buyable product is gone every time Saleor hiccups — and once the proxy gate is
	// enabled, that would be a real 404 rather than a soft one.
	//
	// Rendered rather than thrown. There is no error boundary under `[channel]`, so the throw
	// this used to be ended as React's client-side retry of the Suspense boundary and, failing
	// that, the framework's bare "Application error" screen. The metadata for the same request
	// is `noindex` with no canonical (see `generateMetadata`), and nothing here is cached.
	if (outcome.status === "upstream-error") {
		logUpstreamError("product", outcome, { slug: params.productSlug, channel: params.channel });
		return <ProductTemporarilyUnavailable channel={params.channel} productSlug={params.productSlug} />;
	}

	if (outcome.status === "not-found") {
		notFound();
	}

	const product = outcome.resource;
	const variants = product.variants || [];
	const selectedVariantId = searchParams.variant || (variants.length === 1 ? variants[0].id : undefined);
	const selectedVariant = variants.find((v) => v.id === selectedVariantId);

	const descriptionHtml = parseEditorJSToHtml(product.description);
	const images = getGalleryImages(product, selectedVariant);
	const productAttributes = extractProductAttributes(product);
	const subtitle =
		product.seoDescription?.trim() && product.seoDescription.trim() !== product.name.trim()
			? product.seoDescription.trim()
			: null;
	const careInstructions = extractCareInstructions(product);

	const tCommon = await getTranslations({
		locale: getLocaleFromChannel(params.channel),
		namespace: "common",
	});
	const breadcrumbs = [
		{ label: tCommon("home"), href: marketHref(params.channel) },
		...(product.category
			? [
					{
						label: product.category.name,
						href: marketHref(params.channel, categoryUrlFor(params.channel, product.category.slug)),
					},
				]
			: []),
		{ label: product.name },
	];

	const productJsonLd = buildProductJsonLd({
		name: product.name,
		description: product.seoDescription || product.name,
		images: images.length > 0 ? images.map((img) => img.url) : undefined,
		// The manufacturer attribute, never the category. `category.name` here
		// declared "Strešné boxy" to be the brand of every roof box in structured
		// data. Same defect the listing card already had fixed; the JSON-LD was
		// missed. Absent attribute → no `brand` key, which is better than a wrong one.
		brand: product.attributes?.find((a) => a.attribute.externalReference === MANUFACTURER_REF)?.values[0]
			?.name,
		// Use the exact-locale slug resolved by the storefront boundary, matching
		// the canonical URL advertised for this localized product.
		url: productHref(params.channel, product.slug),
		// `sku` only. An `mpn` used to be emitted from the same value, which made
		// MAKY's internal composite identifier a claim about the manufacturer's part
		// number — it is not one, in any reading.
		//
		// Through `publicSku`, never `sourceSku || sku`. That fallback reached raw
		// `variant.sku` whenever CFM had not set `cfm_source_sku` — which is the
		// whole catalogue — and so published the internal identifier to Google on
		// 94% of pages once the Nordrive cohort went live. The visible code has
		// always been correct; only this path bypassed the module that makes it so.
		sku: publicSku(product.variants?.[0]) ?? undefined,
		isPurchasable: product.isAvailableForPurchase === true,
		priceRange: product.pricing?.priceRange?.start?.gross
			? {
					lowPrice: product.pricing.priceRange.start.gross.amount,
					highPrice:
						product.pricing.priceRange.stop?.gross?.amount || product.pricing.priceRange.start.gross.amount,
					currency: product.pricing.priceRange.start.gross.currency,
				}
			: null,
		// The real variants, so a single-variant product gets its EXACT price and
		// SKU in an Offer instead of a 299-to-299 AggregateOffer band, and a
		// multi-variant one becomes a ProductGroup whose members each carry their
		// own. Every product in the live catalogue is single-variant today, so this
		// is the arm that actually renders.
		variants: (product.variants ?? []).map((v) => ({
			sku: publicSku(v),
			name: v.name,
			price: v.pricing?.price?.gross
				? { amount: v.pricing.price.gross.amount, currency: v.pricing.price.gross.currency }
				: null,
			inStock: Boolean(v.quantityAvailable),
			trackInventory: v.trackInventory,
			availabilityMode: v.metafield,
		})),
		inStock: product.variants?.some((v) => v.quantityAvailable) ?? false,
		// The CFM-owned availability fact, taken from the first variant that
		// publishes one — it is a product-level decision that Saleor happens to
		// carry on the variant. Without it the offer said InStock, derived from a
		// `quantityAvailable` of 50 that is a configuration cap rather than stock,
		// on a catalogue that holds none. `sale_to_order` makes it BackOrder, which
		// is what the badge beside the price already tells the customer.
		availabilityMode: product.variants?.find((v) => v.metafield)?.metafield,
		variantCount: product.variants?.length ?? 0,
	});

	// No manual LCP preload here. The gallery's first <Image> carries `priority`,
	// and next/image already emits a preload with the correct `imagesrcset` for the
	// /_next/image URL the browser actually renders. A hand-written preload of
	// `images[0].url` pointed at the RAW CDN file instead — a second, different
	// resource, fetched at high priority and never displayed. It cost the LCP image
	// ~2 s of load delay on mobile by competing for the connection.

	return (
		<div className="bg-background flex flex-col">
			{/* Own boundary: it asks the other live channels, and the product must never wait. */}
			<Suspense fallback={null}>
				<ProductSwitchTargets product={product} channel={params.channel} />
			</Suspense>
			{productJsonLd && (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
				/>
			)}

			{/* max-w-7xl, like the header, the footer and the other 33 files that lay
			    out a page. This was max-w-[1480px], so on a 1440px screen the product
			    body ran the full width while the header and footer stopped 80px short
			    on each side — and the loading skeleton next door is max-w-7xl too, so
			    the page also jumped 160px wider the moment the content arrived. */}
			<main className="max-w-page mx-auto w-full flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-20">
				{/* Shown on mobile now. It used to be `hidden sm:block`, which cost phone
				    visitors the only "up to the category" control on the page — the trail
				    stays on one scrollable line instead of wrapping, and drops its own
				    (redundant) last crumb below `sm`. */}
				<Breadcrumbs items={breadcrumbs} className="mb-5 lg:mb-6" />

				{/* HERO — the gallery beside the purchase block (premium redesign 2026-09): the
				    gallery takes a little over half, the purchase block the rest, both starting on
				    the same line. Description and parameters follow at full width.

				    `[&>*]:min-w-0` is load-bearing on phones. The lg template already uses
				    minmax(0,…), but below lg this is a single implicit column whose items
				    keep `min-width: auto` — so the column could not go under its own
				    min-content (365px) and the document ended up wider than a 360px
				    viewport, letting the whole page pan sideways while scrolling. */}
				<div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16 [&>*]:min-w-0">
					<ProductGallery images={images} productName={product.name} />

					<div className="flex flex-col">
						{/* The whole name, never split: a roof-rack set's name carries the car and the roof
						    type, and cutting it at a dash would be guessing. A long one is set a size
						    smaller so it does not push the price off the first screen. */}
						<h1
							className={cn(
								"text-text-primary order-2 mt-3 font-extrabold tracking-[-0.03em] text-balance break-words",
								product.name.length > 64
									? "text-2xl sm:text-[1.875rem] xl:text-[2.125rem]"
									: "text-[1.875rem] sm:text-[2.375rem] xl:text-[2.75rem]",
								// After the sizes: tailwind-merge drops a line height that comes BEFORE a
								// font size (Tailwind's `text-*` sets one), which left the title at the
								// body's 1.5 — a 66px gap between two lines of a 44px title.
								"leading-[1.1]",
							)}
						>
							{product.name}
						</h1>
						{/* The product's own short summary from the catalogue — its SEO description,
						    written per product — never a slogan made up for the page. */}
						{subtitle && (
							<p className="text-text-secondary order-2 mt-3 line-clamp-3 text-[0.9375rem] leading-relaxed sm:text-base">
								{subtitle}
							</p>
						)}

						<ErrorBoundary FallbackComponent={VariantSectionError}>
							<Suspense fallback={<VariantSectionSkeleton />}>
								<VariantSectionDynamic
									product={product}
									channel={params.channel}
									searchParams={searchParamsPromise}
								/>
							</Suspense>
						</ErrorBoundary>
					</div>
				</div>

				{/* The key features as one band across the page, under the gallery AND the buy box
				    (third pass, 2026-09-24). In the buy column they ran on below the purchase while
				    the gallery's half of the page stood empty beside them. On a phone they come
				    after the purchase row, before the description, as before. */}
				<ProductHighlights
					attributes={productAttributes}
					locale={getLocaleFromChannel(params.channel)}
					className="mt-8 lg:mt-10"
				/>

				<ProductSpecs
					descriptionHtml={descriptionHtml}
					attributes={productAttributes}
					careInstructions={careInstructions}
					locale={getLocaleFromChannel(params.channel)}
					// The product's own second photo beside the description, when the gallery has one:
					// never a stock picture, never one the gallery does not already show.
					image={images[1] ? { url: images[1].url, alt: images[1].alt ?? product.name } : null}
				/>

				{/* Which cars this product is documented to fit — answerable with no
				    vehicle selected, which is when most shoppers ask it. Its own
				    boundary: it reads the fitment provider, and nothing above it may
				    wait on that. */}
				<div className="mt-6">
					<Suspense fallback={null}>
						<PdpVehicleApplications saleorProductId={product.id} />
					</Suspense>
				</div>
			</main>
		</div>
	);
}

/**
 * Where this product lives in the other live markets, for the header's market switcher —
 * the same set as its hreflang cluster, from the same presence answer (`cache()`-shared
 * within the request, `"use cache"`-shared across requests).
 */
async function ProductSwitchTargets({ product, channel }: { product: LocalizedProduct; channel: string }) {
	const counterparts = await productCounterparts(product, channel, getProductMarketPresence);
	return (
		<MarketSwitchTargets paths={Object.fromEntries(counterparts.map(({ market, path }) => [market, path]))} />
	);
}

/**
 * What the page says when Saleor could not be asked about its own product: a temporary
 * error, never "this product does not exist". The retry is a plain link to the same URL, so
 * it is a fresh request and a fresh lookup — nothing about the failure was cached.
 */
async function ProductTemporarilyUnavailable({
	channel,
	productSlug,
}: {
	channel: string;
	productSlug: string;
}) {
	const locale = getLocaleFromChannel(channel);
	const [tCommon, tProduct] = await Promise.all([
		getTranslations({ locale, namespace: "common" }),
		getTranslations({ locale, namespace: "product" }),
	]);
	const buttonBase =
		"inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	return (
		<main className="mx-auto flex min-h-[50vh] w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
			<h1 className="text-text-primary mb-6 text-2xl font-bold tracking-tight">{tCommon("error")}</h1>
			<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
				<a
					href={marketHref(channel, `/${productSlug}`)}
					className={`${buttonBase} bg-action-primary text-action-primary-text hover:bg-action-primary-hover`}
				>
					{tCommon("retry")}
				</a>
				<a
					href={marketHref(channel)}
					className={`${buttonBase} border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted border`}
				>
					{tProduct("goHome")}
				</a>
			</div>
		</main>
	);
}

// ============================================================================
// Skeleton
// ============================================================================

function ProductPageSkeleton() {
	return (
		<div className="animate-skeleton-delayed bg-background flex min-h-screen flex-col opacity-0">
			<main className="max-w-page mx-auto w-full flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
				<div className="bg-secondary mb-6 hidden h-4 w-64 animate-pulse rounded sm:block" />
				<div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
					<div className="bg-secondary aspect-square animate-pulse rounded-lg" />
					<div className="flex flex-col gap-4">
						<div className="bg-secondary h-8 w-3/4 animate-pulse rounded" />
						<div className="bg-secondary h-6 w-24 animate-pulse rounded" />
						<div className="mt-4 space-y-3">
							<div className="bg-secondary h-10 w-full animate-pulse rounded" />
							<div className="bg-secondary h-10 w-full animate-pulse rounded" />
						</div>
						<div className="bg-secondary mt-4 h-12 w-full animate-pulse rounded" />
					</div>
				</div>
			</main>
		</div>
	);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Attributes for the specifications table.
 *
 * The raw Saleor shape is passed through rather than flattened to
 * `{name, value}`: `formatProductAttributeValue` keys units on
 * `externalReference`, which flattening would throw away.
 *
 * Manufacturer is dropped here because it is surfaced beside the title — a
 * spec row repeating it adds nothing.
 */
function extractProductAttributes(product: NonNullable<ProductDetailsQuery["product"]>) {
	const variantAttributeSlugs = ["size", "color", "colour", "variant"];
	const internalAttributeSlugs = ["care-instructions", "care"];
	const promotedRefs = ["cfm:attribute:manufacturer"];

	return (product.attributes || [])
		.filter((attr) => attr.attribute.name)
		.filter((attr) => !variantAttributeSlugs.includes((attr.attribute.slug ?? "").toLowerCase()))
		.filter((attr) => !internalAttributeSlugs.includes((attr.attribute.slug ?? "").toLowerCase()))
		.filter((attr) => !promotedRefs.includes(attr.attribute.externalReference ?? ""))
		.filter((attr) => attr.values.some((v) => v.name?.trim()));
}

function extractCareInstructions(product: NonNullable<ProductDetailsQuery["product"]>): string | null {
	const careAttr = (product.attributes || []).find(
		(attr) =>
			attr.attribute.slug === "care-instructions" ||
			attr.attribute.slug === "care" ||
			(attr.attribute.name ?? "").toLowerCase().includes("care"),
	);

	return (
		careAttr?.values
			.map((v) => v.name)
			.filter(Boolean)
			.join(". ") || null
	);
}
