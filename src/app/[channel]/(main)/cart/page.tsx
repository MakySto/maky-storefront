import { Suspense } from "react";
import { type Metadata } from "next";
import { ArrowLeft, RotateCcw, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type CheckoutFindQuery } from "@/gql/graphql";
import { CheckoutLink } from "./checkout-link";
import * as Checkout from "@/lib/checkout";
import { getLocaleFromChannel, formatPrice } from "@/config/locale";
import { compareAtLineTotal } from "@/lib/pricing";
import { getHrefForVariant } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { CartLineActions } from "@/ui/components/cart/cart-line-actions";
import { getVariantDetails } from "@/ui/components/cart/variant-details";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

type CheckoutData = NonNullable<CheckoutFindQuery["checkout"]>;
type CartLine = CheckoutData["lines"][number];

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "cart" });

	return {
		title: t("yourCart"),
		robots: { index: false, follow: true },
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const t = await getTranslations({ locale: getLocaleFromChannel(channel), namespace: "cart" });

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
			<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("yourCart")}</h1>
			<Suspense fallback={<CartSkeleton />}>
				<CartContent channel={channel} />
			</Suspense>
		</div>
	);
}

function CartLinePrice({ line, locale }: { line: CartLine; locale: string }) {
	const compareAt = compareAtLineTotal({
		price: line.variant.pricing?.price?.gross.amount,
		priceUndiscounted: line.variant.pricing?.priceUndiscounted?.gross.amount,
		currency: line.variant.pricing?.priceUndiscounted?.gross.currency,
		quantity: line.quantity,
	});

	return (
		<div className="shrink-0 text-right">
			{compareAt ? (
				<p className="text-muted-foreground text-xs line-through">
					{formatPrice(compareAt.amount, compareAt.currency, locale)}
				</p>
			) : null}
			<p className="font-semibold tabular-nums">
				{formatPrice(line.totalPrice.gross.amount, line.totalPrice.gross.currency, locale)}
			</p>
		</div>
	);
}

async function CartItem({
	line,
	checkoutId,
	channel,
	locale,
}: {
	line: CartLine;
	checkoutId: string;
	channel: string;
	locale: string;
}) {
	const t = await getTranslations({ locale, namespace: "cart" });
	const details = getVariantDetails(line.variant);

	return (
		<li className="border-border bg-card rounded-xl border p-4 shadow-xs sm:p-5">
			<div className="flex gap-4 sm:gap-5">
				<LinkWithChannel
					href={getHrefForVariant({
						productSlug: line.variant.product.slug,
						variantId: line.variant.id,
					})}
					aria-label={line.variant.product.name}
					className="border-border bg-background relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border sm:h-36 sm:w-36"
				>
					{line.variant.product.thumbnail?.url ? (
						<ResilientProductImage
							src={line.variant.product.thumbnail.url}
							alt={line.variant.product.thumbnail.alt?.trim() || line.variant.product.name}
							fill
							sizes="(min-width: 640px) 144px, 112px"
							className="object-contain p-2"
						/>
					) : null}
				</LinkWithChannel>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<LinkWithChannel
								href={getHrefForVariant({
									productSlug: line.variant.product.slug,
									variantId: line.variant.id,
								})}
								className="line-clamp-2 leading-6 font-semibold hover:underline"
							>
								{line.variant.product.name}
							</LinkWithChannel>
							{line.variant.product.category?.name ? (
								<p className="text-muted-foreground mt-1 text-sm">{line.variant.product.category.name}</p>
							) : null}
							{details.length > 0 ? (
								<p className="text-muted-foreground mt-1 line-clamp-2 text-sm break-words">
									{details
										.map((detail) => t("variantAttribute", { name: detail.name, value: detail.value }))
										.join(" · ")}
								</p>
							) : line.variant.name && line.variant.name !== line.variant.id ? (
								<p className="text-muted-foreground mt-1 line-clamp-2 text-sm break-all">
									{t("variantLabel", { variant: line.variant.name })}
								</p>
							) : null}
						</div>
						<div className="hidden sm:block">
							<CartLinePrice line={line} locale={locale} />
						</div>
					</div>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-end justify-between gap-3">
				<CartLineActions
					channel={channel}
					checkoutId={checkoutId}
					lineId={line.id}
					productName={line.variant.product.name}
					quantity={line.quantity}
					trackInventory={line.variant.trackInventory}
					quantityAvailable={line.variant.quantityAvailable}
					quantityLimitPerCustomer={line.variant.quantityLimitPerCustomer}
				/>
				<div className="sm:hidden">
					<CartLinePrice line={line} locale={locale} />
				</div>
			</div>
		</li>
	);
}

async function CartContent({ channel }: { channel: string }) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "cart" });
	const tCheckout = await getTranslations({ locale, namespace: "checkout.common" });
	const checkoutId = await Checkout.getIdFromCookies(channel);
	const lookup = await Checkout.lookup(checkoutId);

	if (lookup.status === "upstream-error") {
		return (
			<div className="border-border bg-card mt-10 flex min-h-72 flex-col items-center justify-center rounded-2xl border px-6 text-center">
				<div className="bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
					<RotateCcw className="text-muted-foreground h-7 w-7" aria-hidden />
				</div>
				<p role="status" className="text-muted-foreground max-w-md text-sm">
					{t("loadFailed")}
				</p>
			</div>
		);
	}

	const checkout = lookup.status === "found" ? lookup.checkout : null;
	if (!checkout || checkout.lines.length === 0) {
		return (
			<div className="border-border bg-card mt-10 flex min-h-80 flex-col items-center justify-center rounded-2xl border px-6 text-center">
				<div className="bg-secondary mb-5 flex h-20 w-20 items-center justify-center rounded-full">
					<ShoppingBag className="text-muted-foreground h-9 w-9" aria-hidden />
				</div>
				<h2 className="text-xl font-semibold">{t("emptyCart")}</h2>
				<p className="text-muted-foreground mt-2 mb-7 max-w-sm text-sm">{t("emptyCartHint")}</p>
				<LinkWithChannel
					href="/products"
					className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center rounded-md px-6 font-semibold transition-colors"
				>
					{t("startShopping")}
				</LinkWithChannel>
			</div>
		);
	}

	const itemCount = checkout.lines.reduce((sum, line) => sum + line.quantity, 0);
	const currency = checkout.totalPrice.gross.currency;
	const shipping = checkout.shippingPrice.gross.amount;

	return (
		<div className="mt-3">
			<p className="text-muted-foreground text-sm">{t("items", { count: itemCount })}</p>
			<div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div>
					<ul data-testid="CartProductList" role="list" className="space-y-4">
						{checkout.lines.map((line) => (
							<CartItem key={line.id} line={line} checkoutId={checkoutId} channel={channel} locale={locale} />
						))}
					</ul>
					<LinkWithChannel
						href="/products"
						className="text-muted-foreground hover:text-foreground mt-6 inline-flex h-11 items-center gap-2 text-sm font-medium"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden />
						{t("continueShopping")}
					</LinkWithChannel>
				</div>

				<aside className="border-border bg-card rounded-2xl border p-5 shadow-xs lg:sticky lg:top-28 lg:p-6">
					<h2 className="text-xl font-semibold">{t("total")}</h2>
					<div className="mt-5 space-y-3 text-sm">
						<div className="flex items-center justify-between gap-4">
							<span className="text-muted-foreground">{t("subtotal")}</span>
							<span className="tabular-nums">
								{formatPrice(
									checkout.subtotalPrice.gross.amount,
									checkout.subtotalPrice.gross.currency,
									locale,
								)}
							</span>
						</div>
						<div className="flex items-start justify-between gap-4">
							<span className="text-muted-foreground flex items-center gap-2">
								<Truck className="h-4 w-4" aria-hidden />
								{t("shipping")}
							</span>
							<span className="max-w-44 text-right" title={t("shippingNextStepNote")}>
								{shipping > 0
									? formatPrice(shipping, checkout.shippingPrice.gross.currency, locale)
									: t("shippingAtCheckout")}
							</span>
						</div>
						<div className="border-border flex items-center justify-between gap-4 border-t pt-4 text-lg font-semibold">
							<span>{t("total")}</span>
							<span className="tabular-nums">
								{formatPrice(checkout.totalPrice.gross.amount, currency, locale)}
							</span>
						</div>
					</div>
					<CheckoutLink checkoutId={checkoutId} className="mt-6 w-full" />
					<p className="text-muted-foreground mt-4 flex items-center justify-center gap-2 text-xs">
						<ShieldCheck className="h-4 w-4" aria-hidden />
						{tCheckout("securePurchase")}
					</p>
				</aside>
			</div>
		</div>
	);
}

function CartSkeleton() {
	return (
		<div className="mt-10 animate-pulse lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
			<div className="space-y-4">
				{[1, 2].map((item) => (
					<div key={item} className="border-border bg-card flex rounded-xl border p-4 sm:p-5">
						<div className="bg-secondary h-28 w-28 shrink-0 rounded-xl sm:h-36 sm:w-36" />
						<div className="flex-1 p-4">
							<div className="bg-secondary h-5 w-2/3 rounded" />
							<div className="bg-secondary mt-3 h-4 w-1/3 rounded" />
							<div className="bg-secondary mt-8 h-11 w-40 rounded" />
						</div>
					</div>
				))}
			</div>
			<div className="border-border bg-card mt-8 h-72 rounded-2xl border lg:mt-0" />
		</div>
	);
}
