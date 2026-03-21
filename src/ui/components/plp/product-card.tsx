"use client";

import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

export interface ProductCardData {
	id: string;
	name: string;
	slug: string;
	brand?: string | null;
	price: number;
	compareAtPrice?: number | null;
	currency: string;
	image: string;
	imageAlt?: string;
	hoverImage?: string | null;
	href: string;
	badge?: "sale" | "new" | null;
	colors?: { name: string; hex: string }[];
	sizes?: string[];
	category?: { id: string; name: string; slug: string } | null;
	createdAt?: string | null;
	hasVariants?: boolean;
	onQuickAdd?: (productId: string) => void;
}

interface ProductCardProps {
	product: ProductCardData;
	priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
	const t = useTranslations("plp");
	const tCommon = useTranslations("common");
	const { locale } = useLocale();
	const canQuickAdd = !product.hasVariants && product.onQuickAdd;

	const handleQuickAdd = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		product.onQuickAdd?.(product.id);
	};

	const formatPrice = (amount: number, currency: string) => {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
		}).format(amount);
	};

	const badgeLabel = product.badge === "sale" ? tCommon("sale") : product.badge === "new" ? tCommon("new") : null;

	return (
		<article className="group">
			<Link href={product.href} className="block">
				{/* Image Container */}
				<div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-md bg-surface-muted">
					<Image
						src={product.image}
						alt={product.imageAlt || product.name}
						fill
						sizes="(max-width: 1024px) 50vw, 33vw"
						className={cn(
							"object-cover transition-all duration-500 ease-out md:group-hover:scale-105",
							product.hoverImage && "md:group-hover:opacity-0",
						)}
						priority={priority}
					/>

					{product.hoverImage && (
						<Image
							src={product.hoverImage}
							alt={`${product.name} - alternate view`}
							fill
							sizes="(max-width: 1024px) 50vw, 33vw"
							className="object-cover opacity-0 transition-all duration-500 ease-out md:group-hover:scale-105 md:group-hover:opacity-100"
						/>
					)}

					{badgeLabel && (
						<Badge
							variant={product.badge === "sale" ? "destructive" : "default"}
							className="absolute left-3 top-3"
						>
							{badgeLabel}
						</Badge>
					)}

					{canQuickAdd && (
						<div className="absolute bottom-0 left-0 right-0 hidden translate-y-2 p-3 opacity-0 transition-all duration-300 md:block md:group-hover:translate-y-0 md:group-hover:opacity-100">
							<Button className="w-full" size="sm" onClick={handleQuickAdd} type="button">
								<Plus className="mr-1.5 h-4 w-4" />
								{t("quickAdd")}
							</Button>
						</div>
					)}
				</div>

				{/* Product Info */}
				<div className="space-y-1.5">
					{product.brand && (
						<p className="text-xs tracking-wide text-text-secondary">{product.brand}</p>
					)}
					<h3 className="line-clamp-2 font-medium leading-snug text-text-primary underline-offset-2 md:group-hover:underline">
						{product.name}
					</h3>

					{product.colors && product.colors.length > 1 && (
						<div className="flex items-center gap-1.5 pt-1">
							{product.colors.slice(0, 4).map((color) => (
								<span
									key={color.name}
									className="h-4 w-4 rounded-full border border-border-default"
									style={{ backgroundColor: color.hex }}
									title={color.name}
								/>
							))}
							{product.colors.length > 4 && (
								<span className="ml-0.5 text-xs text-text-tertiary">
									+{product.colors.length - 4}
								</span>
							)}
						</div>
					)}

					{/* Price */}
					<div className="flex items-center gap-2 pt-0.5">
						<span className={cn("font-semibold", product.compareAtPrice && "text-price-sale")}>
							{formatPrice(product.price, product.currency)}
						</span>
						{product.compareAtPrice && (
							<span className="text-sm text-price-compare line-through">
								{formatPrice(product.compareAtPrice, product.currency)}
							</span>
						)}
					</div>
				</div>
			</Link>
		</article>
	);
}