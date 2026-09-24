import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { getHeroShowcase, type HeroShowcase } from "@/lib/homepage/showcase";

/**
 * The small translucent card floating over the hero photo: the product in the photo, with its
 * own cut-out, its name, its price in this market and a link.
 *
 * The glass is the card's SURFACE — a 12% white with a blur — and the photo shows through it;
 * the words and the product sit on it fully opaque, so they read. It says "Na fotke" only when
 * the photo comes from this product's own gallery (`showsProduct`); over an illustration — the
 * owner's banner from Payload — it says "Odporúčame" instead.
 *
 * Desktop only: on a phone the words fill the photo. A fault, or a market that does not sell the
 * product under its own name, leaves the card out and the hero whole.
 */
export async function HeroProductCard({
	params,
	showsProduct,
}: {
	params: Promise<{ channel: string }>;
	/** The hero photo is this product's own; otherwise the card only recommends it. */
	showsProduct: boolean;
}) {
	const { channel } = await params;

	let showcase: HeroShowcase | null = null;
	try {
		showcase = await getHeroShowcase(channel);
	} catch (error) {
		console.warn(
			`[Homepage] hero card left out for ${channel}:`,
			error instanceof Error ? error.message : error,
		);
	}
	const product = showcase?.product;
	if (!product) return null;

	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "home" });

	return (
		<Link
			href={product.href}
			className="group border-text-inverse/25 bg-text-inverse/12 text-text-inverse hover:bg-text-inverse/20 focus-visible:ring-text-inverse absolute right-6 bottom-40 hidden w-[23rem] items-center gap-4 rounded-sm border p-3 pr-4 shadow-2xl backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:flex xl:right-8"
		>
			<span className="bg-surface-card relative h-[4.5rem] w-24 shrink-0 overflow-hidden rounded-xs">
				{product.image && (
					<Image src={product.image} alt="" fill sizes="96px" className="object-contain p-1.5" />
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="text-text-inverse/80 block text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">
					{showsProduct ? t("heroPhotoCaption") : t("heroRecommended")}
				</span>
				<span className="mt-1 line-clamp-2 block text-sm leading-snug font-semibold">{product.name}</span>
				{product.price && (
					<span className="mt-1 block text-base font-bold tracking-[-0.01em] tabular-nums">
						{product.price}
					</span>
				)}
			</span>
			<span className="bg-text-inverse text-text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5">
				<ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
			</span>
		</Link>
	);
}
