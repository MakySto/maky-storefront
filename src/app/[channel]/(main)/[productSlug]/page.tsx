import { Suspense } from "react";
import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { ErrorBoundary } from "react-error-boundary";
import edjsHTML from "editorjs-html";
import xss from "xss";

import { getTranslations } from "next-intl/server";
import { executePublicGraphQL } from "@/lib/graphql";
import { ProductDetailsDocument, type ProductDetailsQuery } from "@/gql/graphql";
import { buildPageMetadata, buildProductJsonLd } from "@/lib/seo";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { marketHref } from "@/lib/channel-map";
import { previousProductSlug } from "@/lib/product-redirects";
import { productHref } from "@/lib/product-url";
import { Breadcrumbs } from "@/ui/components/breadcrumbs";
import { getGalleryImages } from "@/ui/components/pdp/gallery-images";
import {
	ProductGallery,
	ProductSpecs,
	VariantSectionDynamic,
	VariantSectionSkeleton,
	VariantSectionError,
} from "@/ui/components/pdp";
import { getLocaleFromChannel } from "@/config/locale";

/** CFM's manufacturer attribute, keyed on externalReference — see product-attributes.ts. */
const MANUFACTURER_REF = "cfm:attribute:manufacturer";

// ============================================================================
// Cached Data Fetching
// ============================================================================

async function fetchProduct(slug: string, channel: string) {
	const result = await executePublicGraphQL(ProductDetailsDocument, {
		variables: {
			slug: decodeURIComponent(slug),
			channel,
		},
		revalidate: 300,
	});

	if (!result.ok) {
		console.error(`[getProductData] Failed to fetch product ${slug} for ${channel}:`, result.error.message);
		return null;
	}

	return result.data.product;
}

async function getProductData(slug: string, channel: string) {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.products, slug);

	const product = await fetchProduct(slug, channel);
	if (product) {
		return product;
	}

	// Migration shim: a product whose Saleor slug has not been updated to the
	// SKU-last form yet is still reachable at its canonical new URL. Only fires
	// on a miss, and only for the ten explicitly mapped slugs, so it disappears
	// on its own once Saleor has converged. See `previousProductSlug`.
	const previous = previousProductSlug(slug);
	return previous ? await fetchProduct(previous, channel) : null;
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata(props: {
	params: Promise<{ productSlug: string; channel: string }>;
}): Promise<Metadata> {
	const params = await props.params;
	const product = await getProductData(params.productSlug, params.channel);

	if (!product) {
		// Streaming/PPR can't set a 404 status after the shell is flushed, so the
		// noindex robots meta is the only crawler-visible not-found signal here.
		const t = await getTranslations("product");
		return {
			title: t("notFoundTitle"),
			robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
		};
	}

	const description = product.seoDescription || product.name;
	const ogImage = product.media?.[0]?.url || product.thumbnail?.url;
	const priceAmount = product.pricing?.priceRange?.start?.gross?.amount;
	const priceCurrency = product.pricing?.priceRange?.start?.gross?.currency;

	return buildPageMetadata({
		title: product.seoTitle || product.name,
		description,
		image: ogImage,
		url: productHref(params.channel, params.productSlug),
		openGraph:
			priceAmount && priceCurrency
				? {
						"product:price:amount": String(priceAmount),
						"product:price:currency": priceCurrency,
					}
				: undefined,
	});
}

// NOTE: generateStaticParams is intentionally omitted for product pages.
// All product pages are generated on-demand via ISR instead.

// ============================================================================
// Page Component
// ============================================================================

const parser = edjsHTML();

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

	const product = await getProductData(params.productSlug, params.channel);

	if (!product) {
		notFound();
	}

	const variants = product.variants || [];
	const selectedVariantId = searchParams.variant || (variants.length === 1 ? variants[0].id : undefined);
	const selectedVariant = variants.find((v) => v.id === selectedVariantId);

	const descriptionHtml = parseDescription(product.description);
	const images = getGalleryImages(product, selectedVariant);
	const productAttributes = extractProductAttributes(product);
	const careInstructions = extractCareInstructions(product);

	const tCommon = await getTranslations("common");
	const breadcrumbs = [
		{ label: tCommon("home"), href: marketHref(params.channel) },
		...(product.category
			? [
					{
						label: product.category.name,
						href: marketHref(params.channel, `/categories/${product.category.slug}`),
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
		// The requested slug, not product.slug: they are the same once Saleor has
		// converged, and while it has not, this is the URL the canonical tag
		// advertises — the two must never disagree.
		url: productHref(params.channel, params.productSlug),
		priceRange: product.pricing?.priceRange?.start?.gross
			? {
					lowPrice: product.pricing.priceRange.start.gross.amount,
					highPrice:
						product.pricing.priceRange.stop?.gross?.amount || product.pricing.priceRange.start.gross.amount,
					currency: product.pricing.priceRange.start.gross.currency,
				}
			: null,
		inStock: product.variants?.some((v) => v.quantityAvailable) ?? false,
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
			</main>
		</div>
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

function parseDescription(description: string | null | undefined): string[] | null {
	if (!description) return null;

	try {
		const parsed = parser.parse(JSON.parse(description));
		return parsed.map((html: string) => xss(html));
	} catch {
		return [xss(`<p>${description}</p>`)];
	}
}

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
