import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { getHeroShowcase, type HeroShowcase } from "@/lib/homepage/showcase";

/**
 * The translucent card floating over the hero photo: the product in the photo, its cut-out, its
 * name, its category and its price in this market, and a link.
 *
 * Light glass, as the approved hero draws it (second pass, 2026-09-24): the photo shows through
 * the card's SURFACE only — the words and the product sit on it fully opaque, so they read. The
 * cut-out is multiplied into the glass, so its white studio ground disappears; that is also why
 * there is no backdrop blur — a blurred backdrop isolates the card, and the cut-out's white
 * ground then stood on it as a box (seen in the preview, 2026-09-24). It says
 * "Na fotke" only when the photo comes from this product's own gallery (`showsProduct`); over an
 * illustration — the owner's banner from Payload — it says "Odporúčame" instead.
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
			// Smaller and lighter than the first cut (third pass, 2026-09-24): the card is a caption
			// to the photo, not a second hero. Only its ground is see-through — the name and the price
			// stay fully opaque.
			className="group bg-surface-card/75 text-text-primary hover:bg-surface-card/90 focus-visible:ring-text-inverse absolute right-6 bottom-36 hidden w-[22.5rem] items-center gap-3.5 rounded-sm border border-white/50 p-2.5 pr-3.5 shadow-xl transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:flex xl:right-8"
		>
			<span className="relative h-20 w-28 shrink-0">
				{product.image && (
					<Image
						src={product.image}
						alt=""
						fill
						sizes="112px"
						className="object-contain mix-blend-multiply"
					/>
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="text-text-secondary block text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">
					{showsProduct ? t("heroPhotoCaption") : t("heroRecommended")}
				</span>
				<span className="mt-1 line-clamp-2 block text-[0.9375rem] leading-snug font-bold">
					{product.name}
				</span>
				{product.category && (
					<span className="text-text-secondary mt-0.5 block truncate text-xs">{product.category}</span>
				)}
				{product.price && (
					<span className="mt-1.5 block text-lg font-extrabold tracking-[-0.01em] tabular-nums">
						{product.price}
					</span>
				)}
			</span>
			<span className="border-border-default bg-surface-card text-text-primary flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full border shadow-sm transition-transform duration-200 group-hover:translate-x-0.5">
				<ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
			</span>
		</Link>
	);
}
