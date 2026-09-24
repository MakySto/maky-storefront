import { Suspense } from "react";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { brandConfig } from "@/config/brand";
import { getLocaleConfigByLocale, getLocaleFromChannel } from "@/config/locale";
import { ProductListPaginatedDocument } from "@/gql/graphql";
import { getBrand, type Brand } from "@/lib/brands/catalog";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { executePublicGraphQL } from "@/lib/graphql";
import { BRAND_ATTRIBUTE_SLUG } from "@/lib/listing/facet-params";
import { logUpstreamError, upstreamError } from "@/lib/saleor/resource-outcome";
import { resolveExactLocaleProducts } from "@/lib/saleor/exact-locale";
import { buildCanonicalUrl } from "@/lib/seo/hreflang";
import { marketOpenGraph } from "@/lib/seo/metadata";
import { getPaginatedListVariables } from "@/lib/utils";
import { BrandMark } from "@/ui/components/brands/brand-mark";
import { BrandProducts } from "@/ui/components/brands/brand-products";
import { CategoryHero, transformToProductCard } from "@/ui/components/plp";
import { buildSortVariables } from "@/ui/components/plp/filter-utils";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type PageProps = {
	params: Promise<{ channel: string; brand: string }>;
	searchParams: Promise<{ cursor?: string | string[]; direction?: string | string[]; sort?: string }>;
};

async function brandOrNull(channel: string, slug: string): Promise<Brand | null> {
	if (!SLUG.test(slug)) return null;
	return getBrand(channel, slug);
}

/**
 * `/{market}/znacky/{brand}` — one maker's products in this market, under the maker's mark and,
 * once the owner publishes it in Payload, its logo, its line and its banner.
 *
 * The products are Saleor's own answer to "this maker, this channel" — the `manufacturer`
 * attribute filter — paged and ordered like any listing. A maker this channel does not sell has
 * no page: the content says so and the metadata keeps it out of the index.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const { channel, brand: slug } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "brands" });
	const brand = await brandOrNull(channel, slug).catch(() => null);
	if (!brand)
		return { title: `${t("title")} | ${brandConfig.siteName}`, robots: { index: false, follow: true } };

	const canonical = buildCanonicalUrl(REVERSE_MAP[channel] || channel, `/znacky/${brand.slug}`);
	return {
		title: `${brand.name} | ${brandConfig.siteName}`,
		description: brand.shortDescription ?? t("brandDescription", { brand: brand.name }),
		alternates: { canonical },
		openGraph: marketOpenGraph(channel, canonical),
	};
}

export default function Page(props: PageProps) {
	return (
		// The fallback is as tall as the page it stands for — the banner and a screen of grid — so
		// the footer is never on the first frame and pushed away when the products arrive (a CLS
		// of 0.54 in the preview with a short fallback).
		<Suspense
			fallback={
				<div aria-hidden="true">
					<div className="bg-scrim min-h-[16rem] lg:min-h-[19rem]" />
					<div className="min-h-screen" />
				</div>
			}
		>
			<BrandContent params={props.params} searchParams={props.searchParams} />
		</Suspense>
	);
}

async function BrandContent({ params: paramsPromise, searchParams: searchParamsPromise }: PageProps) {
	const [{ channel, brand: slug }, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
	const brand = await brandOrNull(channel, slug);
	if (!brand) notFound();

	const locale = getLocaleFromChannel(channel);
	const lang = getLocaleConfigByLocale(locale).graphqlLanguageCode;
	const [t, tNav] = await Promise.all([
		getTranslations({ locale, namespace: "brands" }),
		getTranslations({ locale, namespace: "nav" }),
	]);

	const result = await executePublicGraphQL(ProductListPaginatedDocument, {
		variables: {
			...getPaginatedListVariables({ params: searchParams }),
			channel,
			lang,
			sortBy: buildSortVariables(searchParams.sort),
			filter: { attributes: [{ slug: BRAND_ATTRIBUTE_SLUG, values: [brand.slug] }] },
		},
		revalidate: 300,
	});
	if (!result.ok || !result.data.products) {
		if (!result.ok) logUpstreamError("brand-products", upstreamError(result), { channel, slug });
		throw new Error(`brand listing failed for ${slug}`);
	}

	const products = result.data.products;
	const localized = resolveExactLocaleProducts(
		products.edges.map((edge) => edge.node),
		locale,
	);

	return (
		<>
			<CategoryHero
				title={brand.name}
				eyebrow={tNav("brands")}
				description={brand.shortDescription ?? t("brandDescription", { brand: brand.name })}
				photo={
					brand.heroImage
						? { url: brand.heroImage.url, position: "50% 50%", mobilePosition: "50% 50%", source: "cms" }
						: null
				}
				breadcrumbs={[
					{ label: tNav("home"), href: marketHref(channel) },
					{ label: t("title"), href: marketHref(channel, "/znacky") },
					{ label: brand.name, href: marketHref(channel, `/znacky/${brand.slug}`) },
				]}
				benefits={
					brand.logo ? (
						<span className="bg-surface-card mt-6 inline-flex w-fit rounded-sm px-5 py-3 shadow-lg">
							<BrandMark brand={brand} size="large" />
						</span>
					) : null
				}
			/>
			<BrandProducts
				products={localized.products.map((product) => transformToProductCard(product, channel, locale))}
				totalCount={products.totalCount ?? 0}
				localeDropped={localized.dropped}
				pageInfo={products.pageInfo}
			/>
		</>
	);
}
