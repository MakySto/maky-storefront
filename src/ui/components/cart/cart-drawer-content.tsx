"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw, ShieldCheck, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CheckoutFindQuery } from "@/gql/graphql";
import { formatPrice } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { compareAtLineTotal } from "@/lib/pricing";
import { productHref } from "@/lib/product-url";
import { checkoutLineDisplay } from "@/lib/checkout-line-display";
import { useLocale } from "@/providers/locale-provider";
import { buildCheckoutPath } from "@/session-bridge";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from "@/ui/components/ui/sheet";
import type { CartLineFitment } from "@/ui/components/fitment/cart-line-fitment";
import { CartLineActions } from "./cart-line-actions";
import { CartLineFit } from "./cart-line-fit";
import { useCart } from "./cart-context";
import { getVariantDetails } from "./variant-details";

type Checkout = NonNullable<CheckoutFindQuery["checkout"]>;
type CartLine = Checkout["lines"][number];
type TaxedMoney = Checkout["totalPrice"];

type CartDrawerProps = {
	checkoutId: string | null;
	lines: CartLine[];
	totalPrice: TaxedMoney | null;
	subtotalPrice: TaxedMoney | null;
	shippingPrice: TaxedMoney | null;
	channel: string;
	/** Each product's fit with the saved car, by Saleor product id; absent = say nothing. */
	fitments?: Readonly<Record<string, CartLineFitment>>;
	loadFailed?: boolean;
};

function DrawerLine({
	line,
	checkoutId,
	channel,
	fitment,
	closeCart,
}: {
	line: CartLine;
	checkoutId: string;
	channel: string;
	fitment?: CartLineFitment;
	closeCart: () => void;
}) {
	const t = useTranslations("cart");
	const { locale } = useLocale();
	// The market's own name and slug, not Saleor's Slovak base row.
	const display = checkoutLineDisplay(line);
	const href = productHref(channel, display.slug, line.variant.id);
	const details = getVariantDetails(line.variant);
	const compareAt = compareAtLineTotal({
		price: line.variant.pricing?.price?.gross.amount,
		priceUndiscounted: line.variant.pricing?.priceUndiscounted?.gross.amount,
		currency: line.variant.pricing?.priceUndiscounted?.gross.currency,
		quantity: line.quantity,
	});

	return (
		<li className="border-border border-b px-5 py-5 last:border-b-0">
			<div className="flex gap-4">
				<Link
					href={href}
					onClick={closeCart}
					aria-label={display.name}
					className="border-border bg-card group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border sm:h-24 sm:w-24"
				>
					{line.variant.product.thumbnail?.url ? (
						<ResilientProductImage
							src={line.variant.product.thumbnail.url}
							alt={line.variant.product.thumbnail.alt?.trim() || display.name}
							fill
							sizes="(min-width: 640px) 96px, 80px"
							className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
						/>
					) : null}
				</Link>
				<div className="min-w-0 flex-1">
					<Link
						href={href}
						onClick={closeCart}
						className="line-clamp-2 text-sm leading-5 font-semibold hover:underline"
					>
						{display.name}
					</Link>
					{display.categoryName ? (
						<p className="text-muted-foreground mt-1 text-xs">{display.categoryName}</p>
					) : null}
					{details.length > 0 ? (
						<p className="text-muted-foreground mt-1 line-clamp-2 text-xs break-words">
							{details
								.map((detail) => t("variantAttribute", { name: detail.name, value: detail.value }))
								.join(" · ")}
						</p>
					) : line.variant.name && line.variant.name !== line.variant.id ? (
						<p className="text-muted-foreground mt-1 line-clamp-2 text-xs break-all">
							{t("variantLabel", { variant: line.variant.name })}
						</p>
					) : null}
					{fitment ? <CartLineFit fitment={fitment} className="mt-2" /> : null}
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-end justify-between gap-3">
				<CartLineActions
					channel={channel}
					checkoutId={checkoutId}
					lineId={line.id}
					productName={display.name}
					quantity={line.quantity}
					trackInventory={line.variant.trackInventory}
					quantityAvailable={line.variant.quantityAvailable}
					quantityLimitPerCustomer={line.variant.quantityLimitPerCustomer}
				/>
				<div className="shrink-0 text-right">
					{compareAt ? (
						<p className="text-muted-foreground text-xs line-through">
							{formatPrice(compareAt.amount, compareAt.currency, locale)}
						</p>
					) : null}
					<p className="text-sm font-semibold tabular-nums">
						{formatPrice(line.totalPrice.gross.amount, line.totalPrice.gross.currency, locale)}
					</p>
				</div>
			</div>
		</li>
	);
}

export function CartDrawer({
	checkoutId,
	lines,
	totalPrice,
	subtotalPrice,
	shippingPrice,
	channel,
	fitments = {},
	loadFailed = false,
}: CartDrawerProps) {
	const t = useTranslations("cart");
	const tCheckout = useTranslations("checkout.common");
	const tCommon = useTranslations("common");
	const { locale, fallbackCurrency } = useLocale();
	const { isOpen, closeCart } = useCart();
	const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
	const currency = totalPrice?.gross.currency ?? fallbackCurrency;
	const subtotal = subtotalPrice?.gross.amount ?? 0;
	const total = totalPrice?.gross.amount ?? subtotal;
	const shipping = shippingPrice?.gross.amount ?? 0;

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
			<SheetContent side="right" className="flex flex-col p-0 sm:max-w-lg">
				<SheetHeader className="border-border justify-between border-b px-5 py-4 sm:px-6">
					<div className="flex min-w-0 items-center gap-3">
						<ShoppingBag className="h-5 w-5 shrink-0" aria-hidden />
						<SheetTitle>{t("yourCart")}</SheetTitle>
						<span className="text-muted-foreground truncate text-sm">
							({t("items", { count: itemCount })})
						</span>
					</div>
					<SheetCloseButton className="static h-11 w-11 shrink-0" label={tCommon("close")} />
				</SheetHeader>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{loadFailed ? (
						<div className="flex h-full flex-col items-center justify-center px-6 text-center">
							<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
								<RotateCcw className="text-muted-foreground h-7 w-7" aria-hidden />
							</div>
							<p role="status" className="text-muted-foreground max-w-xs text-sm">
								{t("loadFailed")}
							</p>
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="border-border mt-5 h-11 rounded-md border px-5 text-sm font-medium"
							>
								{tCommon("retry")}
							</button>
						</div>
					) : lines.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center px-6 text-center">
							<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
								<ShoppingBag className="text-muted-foreground h-7 w-7" aria-hidden />
							</div>
							<h3 className="text-lg font-semibold">{t("emptyCart")}</h3>
							<p className="text-muted-foreground mt-2 mb-6 text-sm">{t("emptyCartHint")}</p>
							<Link
								href={marketHref(channel, "/products")}
								onClick={closeCart}
								className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
							>
								{t("startShopping")}
							</Link>
						</div>
					) : checkoutId ? (
						<ul role="list">
							{lines.map((line) => (
								<DrawerLine
									key={line.id}
									line={line}
									checkoutId={checkoutId}
									channel={channel}
									fitment={fitments[line.variant.product.id]}
									closeCart={closeCart}
								/>
							))}
						</ul>
					) : null}
				</div>

				{!loadFailed && lines.length > 0 ? (
					<div className="border-border bg-background border-t shadow-[0_-8px_24px_rgba(0,0,0,0.04)]">
						<div className="space-y-2 px-5 py-4 sm:px-6">
							<div className="flex items-center justify-between gap-4 text-sm">
								<span className="text-muted-foreground">{t("subtotal")}</span>
								<span className="tabular-nums">{formatPrice(subtotal, currency, locale)}</span>
							</div>
							<div className="flex items-center justify-between gap-4 text-sm">
								<span className="text-muted-foreground">{t("shipping")}</span>
								<span className="text-right">
									{shipping > 0
										? formatPrice(shipping, shippingPrice?.gross.currency ?? currency, locale)
										: t("shippingAtCheckout")}
								</span>
							</div>
							{/* Until a delivery is chosen the sum holds no shipping, and its label says so:
							    "Celkom" under "Doprava: vypočíta sa v pokladni" read as the final price. */}
							<div className="border-border flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
								<span>{shipping > 0 ? t("total") : t("totalWithoutShipping")}</span>
								<span className="tabular-nums">{formatPrice(total, currency, locale)}</span>
							</div>
						</div>
						<div className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
							<Link
								href={checkoutId ? buildCheckoutPath({ checkoutId }) : "/checkout"}
								onClick={closeCart}
								className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-base font-semibold transition-colors"
							>
								{t("checkout")}
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
							</Link>
							<Link
								href={marketHref(channel, "/cart")}
								onClick={closeCart}
								className="border-border hover:bg-accent inline-flex h-12 w-full items-center justify-center rounded-md border text-base font-medium transition-colors"
							>
								{t("viewCart")}
							</Link>
							<button
								type="button"
								onClick={closeCart}
								className="text-muted-foreground hover:text-foreground inline-flex h-11 w-full items-center justify-center text-sm font-medium"
							>
								{t("continueShopping")}
							</button>
						</div>
						<div className="border-border text-muted-foreground flex items-center justify-center gap-2 border-t px-6 py-3 text-xs">
							<ShieldCheck className="h-4 w-4" aria-hidden />
							{tCheckout("securePurchase")}
						</div>
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
