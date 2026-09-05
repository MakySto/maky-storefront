"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
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
		/**
		 * The attributes that distinguish the CHOSEN variant — colour, size — and
		 * nothing else. `CheckoutFind` aliases the two Saleor lists as
		 * `selectionAttributes` and `nonSelectionAttributes`; this used to be
		 * declared as `attributes`, which the query never returns, so it was always
		 * `undefined` and the whole block below was dead. It was optional, and
		 * `lines` is passed as a variable rather than an object literal, so excess
		 * property checking never ran and TypeScript said nothing.
		 *
		 * Required, not optional, precisely so that mismatch cannot recur silently.
		 */
		selectionAttributes: Array<{
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

import { getVariantDetails } from "./variant-details";
import { marketHref } from "@/lib/channel-map";
import { productHref } from "@/lib/product-url";
import { buildCheckoutPath } from "@/session-bridge";

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
	/**
	 * The checkout could not be READ. Distinct from an empty cart: the basket may
	 * well exist, so the drawer must not say it is empty.
	 */
	loadFailed?: boolean;
}

export function CartDrawer({ checkoutId, lines, totalPrice, channel, loadFailed }: CartDrawerProps) {
	const t = useTranslations("cart");
	const tCheckoutCommon = useTranslations("checkout.common");
	const tCommon = useTranslations("common");
	const { isOpen, closeCart } = useCart();
	const [isPending, startTransition] = useTransition();

	const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
	const subtotal = totalPrice?.gross.amount ?? 0;
	const currency = totalPrice?.gross.currency ?? localeConfig.fallbackCurrency;

	const handleRemove = (lineId: string) => {
		if (!checkoutId) return;
		startTransition(() => {
			deleteCartLine(channel, checkoutId, lineId);
		});
	};

	const handleUpdateQuantity = (lineId: string, newQuantity: number) => {
		if (!checkoutId || newQuantity < 1) return;
		startTransition(() => {
			updateCartLineQuantity(channel, checkoutId, lineId, newQuantity);
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
			<SheetContent side="right" className="flex flex-col p-0">
				{/* Header */}
				<SheetHeader className="border-border justify-between border-b px-6 py-4">
					<div className="flex items-center gap-3">
						<ShoppingBag className="h-5 w-5" />
						<SheetTitle>{t("yourCart")}</SheetTitle>
						<span className="text-muted-foreground text-sm">({t("items", { count: itemCount })})</span>
					</div>
					<SheetCloseButton className="static" label={tCommon("close")} />
				</SheetHeader>

				{/* Cart Items */}
				<div className="flex-1 overflow-y-auto">
					{loadFailed ? (
						/* Not the empty state. We could not read the checkout, which says
						   nothing about whether the shopper has one — and no "start
						   shopping" call to action, because there may be nothing to start. */
						<div className="flex h-full flex-col items-center justify-center px-6 text-center">
							<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
								<RotateCcw className="text-muted-foreground h-8 w-8" />
							</div>
							<p role="status" className="text-muted-foreground text-sm">
								{t("loadFailed")}
							</p>
						</div>
					) : lines.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center px-6 text-center">
							<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
								<ShoppingBag className="text-muted-foreground h-8 w-8" />
							</div>
							<h3 className="mb-2 text-lg font-medium">{t("emptyCart")}</h3>
							<p className="text-muted-foreground mb-6 text-sm">{t("emptyCartHint")}</p>
							<Link
								href={marketHref(channel, "/products")}
								onClick={closeCart}
								className="hover:bg-primary/90 bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
							>
								{t("startShopping")}
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
												href={productHref(channel, line.variant.product.slug, line.variant.id)}
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
															href={productHref(channel, line.variant.product.slug, line.variant.id)}
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
																		<span>
																			{attr.isColor
																				? attr.value
																				: t("variantAttribute", { name: attr.name, value: attr.value })}
																		</span>
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
														<span className="sr-only">
															{t("removeItemAria", { product: line.variant.product.name })}
														</span>
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
															<span className="sr-only">{t("decreaseQuantity")}</span>
														</button>
														<span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
														<button
															type="button"
															onClick={() => handleUpdateQuantity(line.id, line.quantity + 1)}
															disabled={isPending}
															className="hover:bg-secondary p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
														>
															<Plus className="h-3 w-3" />
															<span className="sr-only">{t("increaseQuantity")}</span>
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
								<span className="text-muted-foreground">{t("subtotal")}</span>
								<span>{formatMoney(subtotal, currency)}</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">{t("shipping")}</span>
								<span>{t("shippingAtCheckout")}</span>
							</div>
							<div className="border-border flex items-center justify-between border-t pt-2 text-base font-semibold">
								<span>{t("total")}</span>
								<span>{formatMoney(subtotal, currency)}</span>
							</div>
						</div>

						{/* Actions */}
						<div className="space-y-3 px-6 pb-6">
							<Link
								href={checkoutId ? buildCheckoutPath({ checkoutId }) : "/checkout"}
								onClick={closeCart}
								className="hover:bg-primary/90 group bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-medium transition-colors"
							>
								<span>{t("checkout")}</span>
								<ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
							</Link>
							{/* The full cart page had no route into it from anywhere in the UI:
							    the header icon opens this drawer, and the drawer offered only
							    checkout and /products. That matters more than a missing link,
							    because an unconfirmed add tells the shopper to go and check
							    their cart — and there was no way to get there.

							    `marketHref`, not a bare "/cart": the channel prop is the Saleor
							    slug (sk-eur) and the public route is /sk/cart. A market-less
							    /cart is a different URL, and robots.txt disallows it. */}
							<Link
								href={marketHref(channel, "/cart")}
								onClick={closeCart}
								className="border-border hover:bg-accent hover:text-accent-foreground inline-flex h-12 w-full items-center justify-center rounded-md border bg-transparent text-base font-medium transition-colors"
							>
								{t("viewCart")}
							</Link>
							{/* Closes the drawer and leaves the shopper where they are. It used
							    to navigate to /products, which takes someone off the product
							    they were reading in order to "continue shopping". */}
							<button
								type="button"
								onClick={closeCart}
								className="text-muted-foreground hover:text-foreground inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors"
							>
								{t("continueShopping")}
							</button>
						</div>

						{/* Trust Signals */}
						<div className="border-border text-muted-foreground flex items-center justify-center gap-6 border-t px-6 pt-4 pb-4 text-xs">
							<span className="flex items-center gap-1.5">
								<RotateCcw className="h-4 w-4" />
								{tCheckoutCommon("securePurchase")}
							</span>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
