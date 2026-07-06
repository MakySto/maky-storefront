"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from "@/ui/components/ui/sheet";
import { useCart } from "./cart-context";
import { deleteCartLine, updateCartLineQuantity } from "./actions";
import { formatMoney } from "@/lib/utils";
import { localeConfig } from "@/config/locale";
import { hasDiscount } from "@/lib/pricing";

interface CartLine {
	id: string;
	quantity: number;
	totalPrice: {
		gross: {
			amount: number;
			currency: string;
		};
	};
	variant: {
		id: string;
		name: string;
		product: {
			id: string;
			name: string;
			slug: string;
			thumbnail?: {
				url: string;
				alt?: string | null;
			} | null;
		};
		pricing?: {
			price?: {
				gross: {
					amount: number;
					currency: string;
				};
			} | null;
			priceUndiscounted?: {
				gross: {
					amount: number;
					currency: string;
				};
			} | null;
		} | null;
		attributes?: Array<{
			attribute: {
				name?: string | null;
				slug?: string | null;
			};
			values: Array<{
				name?: string | null;
				value?: string | null;
			}>;
		}>;
	};
}

import { getColorHex, isColorAttribute } from "@/lib/colors";
import { marketHref } from "@/lib/channel-map";

interface VariantAttribute {
	name: string;
	value: string;
	colorHex?: string;
	isColor: boolean;
}

function getVariantDetails(variant: CartLine["variant"]): VariantAttribute[] {
	const attributes = variant.attributes || [];
	const result: VariantAttribute[] = [];

	for (const attr of attributes) {
		const slug = attr.attribute.slug || "";
		const name = attr.attribute.name || slug;
		const value = attr.values[0];

		if (!value?.name) continue;

		const isColor = isColorAttribute(slug);

		result.push({
			name,
			value: value.name,
			colorHex: isColor ? getColorHex(value) : undefined,
			isColor,
		});
	}

	// Sort: color first, then others
	return result.sort((a, b) => {
		if (a.isColor && !b.isColor) return -1;
		if (!a.isColor && b.isColor) return 1;
		return 0;
	});
}

interface CartDrawerProps {
	checkoutId: string | null;
	lines: CartLine[];
	totalPrice: {
		gross: {
			amount: number;
			currency: string;
		};
	} | null;
	channel: string;
}

export function CartDrawer({ checkoutId, lines, totalPrice, channel }: CartDrawerProps) {
	const { isOpen, closeCart } = useCart();
	const [isPending, startTransition] = useTransition();

	const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
	const subtotal = totalPrice?.gross.amount ?? 0;
	const currency = totalPrice?.gross.currency ?? localeConfig.fallbackCurrency;

	const handleRemove = (lineId: string) => {
		if (!checkoutId) return;
		startTransition(() => {
			deleteCartLine(checkoutId, lineId);
		});
	};

	const handleUpdateQuantity = (lineId: string, newQuantity: number) => {
		if (!checkoutId || newQuantity < 1) return;
		startTransition(() => {
			updateCartLineQuantity(checkoutId, lineId, newQuantity);
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
			<SheetContent side="right" className="flex flex-col p-0">
				{/* Header */}
				<SheetHeader className="border-border justify-between border-b px-6 py-4">
					<div className="flex items-center gap-3">
						<ShoppingBag className="h-5 w-5" />
						<SheetTitle>Your Bag</SheetTitle>
						<span className="text-muted-foreground text-sm">({itemCount} items)</span>
					</div>
					<SheetCloseButton className="static" />
				</SheetHeader>

				{/* Cart Items */}
				<div className="flex-1 overflow-y-auto">
					{lines.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center px-6 text-center">
							<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
								<ShoppingBag className="text-muted-foreground h-8 w-8" />
							</div>
							<h3 className="mb-2 text-lg font-medium">Your bag is empty</h3>
							<p className="text-muted-foreground mb-6 text-sm">
								Looks like you haven&apos;t added anything to your bag yet.
							</p>
							<Link
								href={marketHref(channel, "/products")}
								onClick={closeCart}
								className="hover:bg-primary/90 bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
							>
								Start Shopping
							</Link>
						</div>
					) : (
						<ul className="divide-border divide-y">
							{lines.map((line) => {
								const variantAttributes = getVariantDetails(line.variant);
								const isDiscounted = hasDiscount(
									line.variant.pricing?.price?.gross.amount,
									line.variant.pricing?.priceUndiscounted?.gross.amount,
								);

								return (
									<li key={line.id} className="px-6 py-4">
										<div className="flex gap-4">
											{/* Product Image */}
											<Link
												href={marketHref(
													channel,
													`/products/${line.variant.product.slug}?variant=${line.variant.id}`,
												)}
												onClick={closeCart}
												className="group bg-secondary relative h-24 w-20 shrink-0 overflow-hidden rounded-lg"
											>
												{line.variant.product.thumbnail?.url && (
													<Image
														src={line.variant.product.thumbnail.url}
														alt={line.variant.product.thumbnail.alt ?? line.variant.product.name}
														fill
														className="object-cover transition-transform duration-300 group-hover:scale-105"
													/>
												)}
											</Link>

											{/* Product Details */}
											<div className="min-w-0 flex-1">
												<div className="flex items-start justify-between gap-2">
													<div>
														<Link
															href={marketHref(
																channel,
																`/products/${line.variant.product.slug}?variant=${line.variant.id}`,
															)}
															onClick={closeCart}
															className="line-clamp-1 text-sm font-medium hover:underline"
														>
															{line.variant.product.name}
														</Link>
														{/* Variant attributes: Color swatch + values separated by | */}
														{variantAttributes.length > 0 ? (
															<div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
																{variantAttributes.map((attr, index) => (
																	<span key={attr.name} className="flex items-center gap-1.5">
																		{index > 0 && <span className="text-border">|</span>}
																		{attr.colorHex && (
																			<span
																				className="border-border h-3 w-3 rounded-full border"
																				style={{ backgroundColor: attr.colorHex }}
																			/>
																		)}
																		{/* Show "Size X" for size attributes, just value for colors */}
																		<span>{attr.isColor ? attr.value : `${attr.name} ${attr.value}`}</span>
																	</span>
																))}
															</div>
														) : line.variant.name && line.variant.name !== line.variant.id ? (
															<p className="text-muted-foreground mt-1 text-xs">{line.variant.name}</p>
														) : null}
													</div>
													<Button
														variant="ghost"
														size="icon"
														className="text-muted-foreground hover:text-destructive -mt-1 -mr-2 h-8 w-8 shrink-0"
														onClick={() => handleRemove(line.id)}
														disabled={isPending}
													>
														<Trash2 className="h-4 w-4" />
														<span className="sr-only">Remove {line.variant.product.name}</span>
													</Button>
												</div>

												{/* Quantity & Price */}
												<div className="mt-3 flex items-center justify-between">
													{/* Quantity Selector */}
													<div className="border-border flex items-center rounded-lg border">
														<button
															type="button"
															onClick={() => handleUpdateQuantity(line.id, line.quantity - 1)}
															disabled={line.quantity <= 1 || isPending}
															className="hover:bg-secondary p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
														>
															<Minus className="h-3 w-3" />
															<span className="sr-only">Decrease quantity</span>
														</button>
														<span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
														<button
															type="button"
															onClick={() => handleUpdateQuantity(line.id, line.quantity + 1)}
															disabled={isPending}
															className="hover:bg-secondary p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
														>
															<Plus className="h-3 w-3" />
															<span className="sr-only">Increase quantity</span>
														</button>
													</div>

													{/* Price */}
													<div className="text-right">
														<span className="text-sm font-medium">
															{formatMoney(line.totalPrice.gross.amount, line.totalPrice.gross.currency)}
														</span>
														{isDiscounted && line.variant.pricing?.priceUndiscounted && (
															<span className="text-muted-foreground block text-xs line-through">
																{formatMoney(
																	line.variant.pricing.priceUndiscounted.gross.amount * line.quantity,
																	line.variant.pricing.priceUndiscounted.gross.currency,
																)}
															</span>
														)}
													</div>
												</div>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{/* Footer */}
				{lines.length > 0 && (
					<div className="border-border bg-background border-t">
						{/* Order Summary */}
						<div className="space-y-2 px-6 py-4">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Subtotal</span>
								<span>{formatMoney(subtotal, currency)}</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Shipping</span>
								<span>Calculated at checkout</span>
							</div>
							<div className="border-border flex items-center justify-between border-t pt-2 text-base font-semibold">
								<span>Total</span>
								<span>{formatMoney(subtotal, currency)}</span>
							</div>
						</div>

						{/* Actions */}
						<div className="space-y-3 px-6 pb-6">
							<Link
								href={`/checkout?checkout=${checkoutId}`}
								onClick={closeCart}
								className="hover:bg-primary/90 group bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-medium transition-colors"
							>
								<span>Checkout</span>
								<ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
							</Link>
							<Link
								href={marketHref(channel, "/products")}
								onClick={closeCart}
								className="border-border hover:bg-accent hover:text-accent-foreground inline-flex h-12 w-full items-center justify-center rounded-md border bg-transparent text-base font-medium transition-colors"
							>
								Continue Shopping
							</Link>
						</div>

						{/* Trust Signals */}
						<div className="border-border text-muted-foreground flex items-center justify-center gap-6 border-t px-6 pt-4 pb-4 text-xs">
							<span className="flex items-center gap-1.5">
								<RotateCcw className="h-4 w-4" />
								30-day returns
							</span>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
