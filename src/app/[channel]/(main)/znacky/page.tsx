import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";

import { brandConfig } from "@/config/brand";
import { getLocaleFromChannel } from "@/config/locale";
import { getBrands, stockedBrandSlugs } from "@/lib/brands/catalog";
import { marketHref, REVERSE_MAP } from "@/lib/channel-map";
import { buildCanonicalUrl } from "@/lib/seo/hreflang";
import { marketOpenGraph } from "@/lib/seo/metadata";
import { BrandMark } from "@/ui/components/brands/brand-mark";
import { CategoryHero } from "@/ui/components/plp";

/**
 * `/{market}/znacky` — every maker this market sells, each to its own page (owner, 2026-09-24).
 *
 * The makers are Saleor's (`manufacturer`), counted in this channel, so the page lists exactly
 * the brands a shopper can buy here; a logo and a line appear as soon as the owner publishes the
 * brand's entry in Payload. The canonical is the bare path.
 */
export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "brands" });
	const canonical = buildCanonicalUrl(REVERSE_MAP[channel] || channel, "/znacky");
	// A market whose channel sells no maker has an empty index here — every foreign market on
	// 2026-09-25, and it was indexable. Only an authoritative empty answer says so; a fault keeps
	// the page indexable, like any other outage. The navigation hides the link on the same answer.
	const empty = await stockedBrandSlugs(channel).then(
		(stocked) => stocked.size === 0,
		() => false,
	);
	return {
		title: `${t("title")} | ${brandConfig.siteName}`,
		description: t("description"),
		...(empty
			? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
			: { alternates: { canonical } }),
		openGraph: marketOpenGraph(channel, canonical),
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const locale = getLocaleFromChannel(channel);
	const [t, tNav] = await Promise.all([
		getTranslations({ locale, namespace: "brands" }),
		getTranslations({ locale, namespace: "nav" }),
	]);

	return (
		<>
			<CategoryHero
				title={t("title")}
				description={t("description")}
				breadcrumbs={[
					{ label: tNav("home"), href: marketHref(channel) },
					{ label: t("title"), href: marketHref(channel, "/znacky") },
				]}
			/>
			<Suspense fallback={<BrandGridSkeleton />}>
				<BrandGrid channel={channel} />
			</Suspense>
		</>
	);
}

async function BrandGrid({ channel }: { channel: string }) {
	const [brands, t] = await Promise.all([
		getBrands(channel),
		getTranslations({ locale: getLocaleFromChannel(channel), namespace: "brands" }),
	]);

	return (
		<section className="max-w-page mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
				{brands.map((brand) => (
					<li key={brand.slug}>
						<Link
							href={marketHref(channel, `/znacky/${brand.slug}`)}
							className="group border-border-subtle bg-surface-card hover:border-border-default focus-visible:ring-ring flex h-full flex-col rounded-sm border p-5 shadow-xs transition-[box-shadow,border-color] hover:shadow-lg focus-visible:ring-2 focus-visible:outline-hidden"
						>
							<span className="flex h-16 items-center">
								<BrandMark brand={brand} />
							</span>
							{brand.shortDescription && (
								<span className="text-text-secondary mt-3 line-clamp-2 text-[0.8125rem] leading-snug">
									{brand.shortDescription}
								</span>
							)}
							<span className="text-text-secondary mt-auto flex items-center justify-between gap-2 pt-4 text-sm">
								<span className="tabular-nums">{t("productCount", { count: brand.productCount })}</span>
								<ArrowRightIcon
									className="group-hover:text-brand h-4 w-4 transition-transform group-hover:translate-x-0.5"
									strokeWidth={2.25}
									aria-hidden="true"
								/>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}

function BrandGridSkeleton() {
	return (
		<section
			className="max-w-page mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-10"
			aria-hidden="true"
		>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
				{Array.from({ length: 10 }).map((_, i) => (
					<div
						key={i}
						className="border-border-subtle bg-surface-card h-36 animate-pulse rounded-sm border"
					/>
				))}
			</div>
		</section>
	);
}
