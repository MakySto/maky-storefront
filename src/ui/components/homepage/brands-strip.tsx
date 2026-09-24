import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { HOMEPAGE_BRAND_SLUGS, getBrands } from "@/lib/brands/catalog";
import { marketHref } from "@/lib/channel-map";
import { BrandMark } from "@/ui/components/brands/brand-mark";

/**
 * Homepage brand strip: the approved makers (CLAUDE.md §6) that this market actually sells, each
 * to its brand page, and a link to all of them.
 *
 * Every name clears two tests. Approved for the homepage — Thule, Nordrive, Menabo, Yakima,
 * Peruzzo, Pro-USER, Spinder, Green Valley, SnowDrive, DAC, and never Cruz, HAK-SYSTEM, GALIA,
 * ORIS or JAEGER, nor a brand that only appears in a generated mockup (Dometic, iKamper). And
 * stocked here: the list is `getBrands` — Saleor's makers counted in this channel — so SnowDrive,
 * approved but with no products, stays out until it has some.
 *
 * A brand shows its logo once the owner publishes it in Payload's `brands` collection; until
 * then the name is set as a wordmark. A fault reading the brands hides the strip: a row of
 * links that may lead nowhere is worse than none.
 */
export async function BrandsStrip({ channel }: { channel: string }) {
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });
	const all = await getBrands(channel).catch((error: unknown) => {
		console.warn(
			`[Homepage] brand strip left out for ${channel}:`,
			error instanceof Error ? error.message : error,
		);
		return [];
	});
	const brands = HOMEPAGE_BRAND_SLUGS.flatMap((slug) => all.filter((brand) => brand.slug === slug));
	if (brands.length === 0) return null;

	return (
		<section className="max-w-page mx-auto px-4 pt-10 pb-12 sm:px-6 sm:pt-12 sm:pb-14 lg:px-8">
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">
					{t("brandsTitle")}
				</h2>
				<Link
					href={marketHref(channel, "/znacky")}
					className="text-text-primary hover:text-brand group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
				>
					{t("brandsAll")}
					<ArrowRightIcon
						className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
						strokeWidth={2.25}
						aria-hidden="true"
					/>
				</Link>
			</div>
			<ul className="mt-6 grid grid-cols-3 items-center gap-x-4 gap-y-6 sm:grid-cols-5 lg:flex lg:justify-between lg:gap-x-6">
				{brands.map((brand) => (
					<li key={brand.slug} className="flex justify-center">
						<Link
							href={marketHref(channel, `/znacky/${brand.slug}`)}
							aria-label={brand.name}
							className="hover:text-brand focus-visible:ring-ring rounded-xs transition-[color,opacity] hover:opacity-80 focus-visible:ring-2 focus-visible:outline-hidden"
						>
							<BrandMark brand={brand} className="text-lg sm:text-xl xl:text-[1.375rem]" />
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
