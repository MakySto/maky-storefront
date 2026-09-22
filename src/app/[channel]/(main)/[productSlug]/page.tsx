import { Suspense } from "react";
import { categoryUrlFor } from "@/config/category-routes";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
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
import { previousProductSlug } from "@/lib/product-redirects";
import { productHref } from "@/lib/product-url";
import { Breadcrumbs } from "@/ui/components/breadcrumbs";
import { getGalleryImages } from "@/ui/components/pdp/gallery-images";
import { PdpVehicleApplications } from "@/ui/components/fitment/pdp-vehicle-applications";
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

async function fetchProductOutcome(
	slug: string,
	channel: string,
	locale: string,
): Promise<ResourceOutcome<LocalizedProduct>> {
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
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

/** `found` | `not-found` | `upstream-error`, shared by the page and its metadata. */
export async function getProductOutcome(
	slug: string,
	channel: string,
): Promise<ResourceOutcome<LocalizedProduct>> {
	const locale = getLocaleFromChannel(channel);
	return catchUpstreamError(() => getProductOutcomeCached(slug, channel, locale));
}

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
	const hasExplicitSeoTitle = isSourceLocale(locale)
		? Boolean(product.seoTitle?.trim())
		: Boolean(product.translation?.seoTitle?.trim());

	const description = product.seoDescription || product.name;
	const ogImage = getGalleryImages(product, null)[0]?.url || product.thumbnail?.url;
	const priceAmount = product.pricing?.priceRange?.start?.gross?.amount;
	const priceCurrency = product.pricing?.priceRange?.start?.gross?.currency;

	const metadata = buildPageMetadata({
		title: product.seoTitle || product.name,
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
	// the exact-locale boundary inside `getProductOutcome` decides the second. Asked of the
	// other live markets only; with `sk` alone live this costs nothing and says nothing.
	const market = REVERSE_MAP[params.channel] ?? params.channel;
	const languages = counterpartAlternates(
		market,
		await productCounterparts(product, params.channel, getProductOutcome),
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

	// An upstream fault is NOT an absence. Throwing hands it to the error
	// boundary; calling notFound() here would tell the world a live, buyable
	// product is gone every time Saleor hiccups — and once the proxy gate is
	// enabled, that would be a real 404 rather than a soft one.
	if (outcome.status === "upstream-error") {
		logUpstreamError("product", outcome, { slug: params.productSlug, channel: params.channel });
		throw new Error(`product lookup failed for ${params.productSlug}: ${outcome.message}`);
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
		<div className="bg-background flex min-h-screen flex-col">
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
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
				{/* Shown on mobile now. It used to be `hidden sm:block`, which cost phone
				    visitors the only "up to the category" control on the page — the trail
				    stays on one scrollable line instead of wrapping, and drops its own
				    (redundant) last crumb below `sm`. */}
				<Breadcrumbs items={breadcrumbs} className="mb-6" />

				{/* HERO — gallery beside the purchase summary, and nothing else.
				    Both columns end at roughly the same height, so neither leaves a
				    dead area on a wide monitor. Description and parameters moved
				    below at full width; the gallery is deliberately NOT sticky,
				    which would only re-create the imbalance. */}
				{/* `[&>*]:min-w-0` is load-bearing on phones. The lg template already uses
				    minmax(0,…), but below lg this is a single implicit column whose items
				    keep `min-width: auto` — so the column could not go under its own
				    min-content (365px) and the document ended up wider than a 360px
				    viewport, letting the whole page pan sideways while scrolling. */}
				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20 [&>*]:min-w-0">
					<ProductGallery images={images} productName={product.name} />

					<div className="flex flex-col gap-3">
						<h1 className="order-2 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
							{product.name}
						</h1>

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

				<ProductSpecs
					descriptionHtml={descriptionHtml}
					attributes={productAttributes}
					careInstructions={careInstructions}
					locale={getLocaleFromChannel(params.channel)}
				/>

				{/* Which cars this product is documented to fit — answerable with no
				    vehicle selected, which is when most shoppers ask it. Its own
				    boundary: it reads the fitment provider, and nothing above it may
				    wait on that. */}
				<div className="mt-10">
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
 * the same set as its hreflang cluster, from the same cached lookups.
 */
async function ProductSwitchTargets({ product, channel }: { product: LocalizedProduct; channel: string }) {
	const counterparts = await productCounterparts(product, channel, getProductOutcome);
	return (
		<MarketSwitchTargets paths={Object.fromEntries(counterparts.map(({ market, path }) => [market, path]))} />
	);
}

// ============================================================================
// Skeleton
// ============================================================================

function ProductPageSkeleton() {
	return (
		<div className="animate-skeleton-delayed bg-background flex min-h-screen flex-col opacity-0">
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
				<div className="bg-secondary mb-6 hidden h-4 w-64 animate-pulse rounded sm:block" />
				<div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
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
