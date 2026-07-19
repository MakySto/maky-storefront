"use client";

import { useState, type FC } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Tag, ShieldCheck, ChevronDown, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CheckoutFragment, type OrderFragment } from "@/checkout/graphql";
import { localeConfig } from "@/config/locale";

// ============================================================================
// Types
// ============================================================================

interface LineItem {
	id: string;
	quantity: number;
	name: string;
	attributes: string[];
	imageUrl?: string | null;
	imageAlt?: string | null;
	totalAmount: number;
}

interface OrderSummaryData {
	lines: LineItem[];
	currency: string;
	subtotal: number;
	shipping: number;
	tax: number;
	discount: number;
	total: number;
	editable?: boolean;
}

interface OrderSummaryProps {
	checkout?: CheckoutFragment;
	order?: OrderFragment;
	editable?: boolean;
}

// ============================================================================
// Data Adapters
// ============================================================================

function extractCheckoutData(checkout: CheckoutFragment, productNameFallback: string): OrderSummaryData {
	const lines: LineItem[] = checkout.lines.map((line) => {
		const variantImage = line.variant?.media?.find((m) => m.type === "IMAGE");
		const productImage = line.variant?.product?.media?.find((m) => m.type === "IMAGE");
		const image = variantImage || productImage;
		const attributes =
			line.variant?.attributes
				?.map((attr) => attr.values[0]?.name)
				.filter((name): name is string => Boolean(name)) || [];

		return {
			id: line.id,
			quantity: line.quantity,
			name: line.variant?.product?.name || productNameFallback,
			attributes,
			imageUrl: image?.url,
			imageAlt: image?.alt,
			totalAmount: line.totalPrice?.gross?.amount || 0,
		};
	});

	return {
		lines,
		currency: checkout.totalPrice?.gross?.currency || localeConfig.fallbackCurrency,
		subtotal: checkout.subtotalPrice?.gross?.amount || 0,
		shipping: checkout.shippingPrice?.gross?.amount || 0,
		tax: checkout.totalPrice?.tax?.amount || 0,
		discount: checkout.discount?.amount || 0,
		total: checkout.totalPrice?.gross?.amount || 0,
		editable: true,
	};
}

function extractOrderData(order: OrderFragment, productNameFallback: string): OrderSummaryData {
	const lines: LineItem[] = order.lines.map((line) => {
		const attributes =
			line.variant?.attributes
				?.map((attr) => attr.values[0]?.name)
				.filter((name): name is string => Boolean(name)) || [];

		return {
			id: line.id,
			quantity: line.quantity,
			name: line.productName || productNameFallback,
			attributes,
			imageUrl: line.thumbnail?.url,
			imageAlt: line.thumbnail?.alt,
			totalAmount: line.totalPrice?.gross?.amount || 0,
		};
	});

	const discount = order.discounts?.reduce((sum, d) => sum + (d.amount?.amount || 0), 0) || 0;

	return {
		lines,
		currency: order.total?.gross?.currency || localeConfig.fallbackCurrency,
		subtotal: order.subtotal?.gross?.amount || 0,
		shipping: order.shippingPrice?.gross?.amount || 0,
		tax: order.total?.tax?.amount || 0,
		discount,
		total: order.total?.gross?.amount || 0,
		editable: false,
	};
}

// ============================================================================
// Component
// ============================================================================

export const OrderSummary: FC<OrderSummaryProps> = ({ checkout, order }) => {
	const t = useTranslations("checkout");
	const tCart = useTranslations("cart");

	// Collapsed by default on mobile
	const [isExpanded, setIsExpanded] = useState(false);

	// Extract data from either checkout or order
	const productNameFallback = t("summary.productFallback");
	const data = checkout
		? extractCheckoutData(checkout, productNameFallback)
		: order
			? extractOrderData(order, productNameFallback)
			: null;

	if (!data) {
		return null;
	}

	const { lines, currency, subtotal, shipping, discount, total } = data;
	const itemCount = lines.reduce((acc, line) => acc + line.quantity, 0);

	const formatMoney = (amount: number) => {
		return new Intl.NumberFormat(localeConfig.default, {
			style: "currency",
			currency,
		}).format(amount);
	};

	// Product thumbnails for collapsed state (show max 2 for cleaner look)
	const thumbnails = lines.slice(0, 2);
	const remainingCount = Math.max(0, lines.length - 2);

	return (
		<article>
			{/* Mobile Collapsible Header - Only visible on mobile */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center justify-between px-4 py-3 md:hidden"
				aria-expanded={isExpanded}
				aria-controls="order-summary-content"
			>
				<div className="flex items-center gap-3">
					{/* Stacked product thumbnails - last image on top */}
					<div className="flex">
						{thumbnails.length > 0 ? (
							thumbnails.map((line, idx) => (
								<div
									key={line.id}
									className={cn(
										"border-card bg-secondary relative h-8 w-8 shrink-0 overflow-hidden rounded-md border-2",
										idx === 0 && "z-[1]",
										idx === 1 && "z-[2] -ml-3",
									)}
								>
									{line.imageUrl ? (
										<Image
											src={line.imageUrl}
											alt={line.imageAlt || line.name}
											width={32}
											height={32}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center">
											<Tag className="h-3 w-3" />
										</div>
									)}
								</div>
							))
						) : (
							<div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-md">
								<ShoppingBag className="text-muted-foreground h-4 w-4" />
							</div>
						)}
						{remainingCount > 0 && (
							<div className="border-card bg-muted text-muted-foreground z-[3] -ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 text-[10px] font-semibold">
								+{remainingCount}
							</div>
						)}
					</div>
					{/* Text */}
					<div className="flex flex-col items-start">
						<span className="text-sm font-medium">
							{isExpanded ? t("summary.hideSummary") : t("summary.showSummary")}
						</span>
						<span className="text-muted-foreground text-xs">{tCart("items", { count: itemCount })}</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-base font-semibold">{formatMoney(total)}</span>
					<ChevronDown
						className={cn(
							"text-muted-foreground h-5 w-5 transition-transform duration-200",
							isExpanded && "rotate-180",
						)}
					/>
				</div>
			</button>

			{/* Desktop Header - Only visible on desktop */}
			<header className="bg-secondary/30 hidden items-center gap-2 px-5 py-4 md:flex">
				<h2 className="text-base font-semibold">{t("summary.title")}</h2>
				<span className="text-muted-foreground text-sm">({tCart("items", { count: itemCount })})</span>
			</header>

			{/* Collapsible Content - animated on mobile, always visible on desktop */}
			<div id="order-summary-content" className="order-summary-content" data-expanded={isExpanded}>
				<div className="order-summary-inner">
					{/* Products */}
					<section className="border-border border-t">
						<ul className="max-h-[280px] space-y-1 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable]">
							{lines.map((line) => (
								<li key={line.id} className="flex gap-4 py-2">
									{/* Product image with quantity badge */}
									<figure className="relative shrink-0">
										<span className="bg-foreground text-background absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium shadow-xs">
											{line.quantity}
										</span>
										<div className="border-border bg-secondary h-14 w-14 overflow-hidden rounded-lg border">
											{line.imageUrl ? (
												<Image
													src={line.imageUrl}
													alt={line.imageAlt || line.name}
													width={56}
													height={56}
													className="h-full w-full object-contain object-center"
												/>
											) : (
												<div className="text-muted-foreground flex h-full w-full items-center justify-center">
													<Tag className="h-5 w-5" />
												</div>
											)}
										</div>
									</figure>

									{/* Product details */}
									<div className="flex min-w-0 flex-1 flex-col justify-center">
										<p className="truncate text-sm leading-tight font-medium">{line.name}</p>
										{line.attributes.length > 0 && (
											<p className="text-muted-foreground mt-0.5 truncate text-xs">
												{line.attributes.join(" / ")}
											</p>
										)}
									</div>

									{/* Price */}
									<data
										value={line.totalAmount}
										className="flex flex-col justify-center text-sm font-medium tabular-nums"
									>
										{formatMoney(line.totalAmount)}
									</data>
								</li>
							))}
						</ul>
					</section>

					{/* Amounts */}
					<section className="border-border border-t px-5 py-4">
						<dl className="space-y-2 text-sm tabular-nums">
							<div className="flex justify-between">
								<dt className="text-muted-foreground">{tCart("subtotal")}</dt>
								<dd>{formatMoney(subtotal)}</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-muted-foreground">{tCart("shipping")}</dt>
								<dd>{shipping > 0 ? formatMoney(shipping) : "—"}</dd>
							</div>
							{discount > 0 && (
								<div className="flex justify-between text-green-600">
									<dt>{t("summary.discount")}</dt>
									<dd>-{formatMoney(discount)}</dd>
								</div>
							)}
						</dl>

						{/* Total */}
						<div className="border-border/50 mt-4 flex items-baseline justify-between border-t pt-4">
							<span className="text-base font-semibold">{t("summary.total")}</span>
							<data value={total} className="text-xl font-semibold tabular-nums">
								{formatMoney(total)}
							</data>
						</div>
					</section>

					{/* Trust */}
					<footer className="bg-secondary/30 border-border flex justify-center border-t px-5 py-4">
						<div className="bg-secondary flex items-center gap-2 rounded-lg px-4 py-2.5">
							<ShieldCheck className="text-muted-foreground h-4 w-4" />
							<span className="text-muted-foreground text-[10px] leading-tight">
								{t("common.securePurchase")}
							</span>
						</div>
					</footer>
				</div>
			</div>
		</article>
	);
};
