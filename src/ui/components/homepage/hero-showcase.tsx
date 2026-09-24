import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { getHeroShowcase, type HeroShowcase } from "@/lib/homepage/showcase";
import { HeroPhotoFrame } from "./hero-photo-frame";

/**
 * The hero photo, and — where this market sells the product under its own name — a small
 * label naming it, with its price, linking to it.
 *
 * A fault leaves the frame empty rather than failing the homepage: the photo decorates, the
 * copy and the buttons beside it carry the page.
 */
export async function HeroShowcasePhoto({ params }: { params: Promise<{ channel: string }> }) {
	const { channel } = await params;
	const locale = getLocaleFromChannel(channel);

	let showcase: HeroShowcase | null = null;
	try {
		showcase = await getHeroShowcase(channel);
	} catch (error) {
		console.warn(
			`[Homepage] hero photo left out for ${channel}:`,
			error instanceof Error ? error.message : error,
		);
	}
	if (!showcase) return <HeroPhotoFrame />;

	const t = await getTranslations({ locale, namespace: "home" });
	const { product } = showcase;

	return (
		<HeroPhotoFrame>
			<Image
				src={showcase.imageUrl}
				alt={product ? product.name : t("heroImageAlt")}
				fill
				// Above the fold on every desktop and the largest paint there: fetch it first.
				priority
				sizes="(min-width: 1280px) 616px, (min-width: 1024px) 50vw, 100vw"
				className="object-cover"
			/>
			{product && (
				<Link
					href={product.href}
					className="group bg-surface-card/95 text-text-primary absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-sm py-2 pr-3 pl-3.5 shadow-lg backdrop-blur-sm transition-colors sm:bottom-4 sm:left-4"
				>
					<span className="min-w-0">
						<span className="text-text-tertiary block text-xs">{t("heroPhotoCaption")}</span>
						<span className="block truncate text-sm font-semibold">{product.name}</span>
					</span>
					{product.price && (
						<span className="text-price-current shrink-0 text-sm font-semibold tabular-nums">
							{product.price}
						</span>
					)}
					<ArrowRightIcon
						className="text-text-tertiary group-hover:text-text-link h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</Link>
			)}
		</HeroPhotoFrame>
	);
}
