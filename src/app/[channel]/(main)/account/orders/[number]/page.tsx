import { formatDate, getLocaleFromChannel } from "@/config/locale";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, CreditCard } from "lucide-react";
import { OrderByNumberDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { formatMoney } from "@/lib/utils";
import { productPath } from "@/lib/product-url";
import { OrderTimeline } from "@/ui/components/account/order-timeline";
import { OrderStatusBadge } from "@/ui/components/account/order-status-badge";
import { type AddressDetailsFragment } from "@/gql/graphql";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

type Props = {
	// `channel` too: money is formatted in the market's locale, not the store default.
	params: Promise<{ channel: string; number: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
	const { channel, number } = await params;
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "account" });

	// Saleor's `me.orders` doesn't support filtering by number (UserOrdersArgs
	// only has pagination args). We fetch a page and find client-side. This covers
	// the vast majority of customers; a dedicated `orderByToken` query would be
	// more efficient if order counts grow large.
	const result = await executeAuthenticatedGraphQL(OrderByNumberDocument, {
		variables: { first: 100 },
		cache: "no-cache",
	});

	if (!result.ok || !result.data.me) {
		return null;
	}

	const orders = result.data.me.orders?.edges ?? [];
	const order = orders.find(({ node }) => node.number === number)?.node;

	if (!order) {
		notFound();
	}

	const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">ORD-{order.number}</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						{t("order.placedOn", { date: formatDate(new Date(order.created), locale) })}
					</p>
				</div>
				<OrderStatusBadge locale={locale} status={order.status} statusDisplay={order.statusDisplay} />
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
				<div className="space-y-6">
					<div className="rounded-xl border">
						<div className="border-b px-5 py-4">
							<h2 className="text-sm font-semibold">{t("order.items", { count: itemCount })}</h2>
						</div>
						<div className="divide-y">
							{order.lines.map((line) => {
								if (!line.variant) return null;
								const product = line.variant.product;
								const lineTotal = line.variant.pricing?.price?.gross
									? line.variant.pricing.price.gross.amount * line.quantity
									: null;
								const currency = line.variant.pricing?.price?.gross.currency;
								return (
									<div key={line.id} className="flex items-center gap-4 px-5 py-4">
										{product.thumbnail && (
											<div className="bg-secondary/30 h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
												<ResilientProductImage
													src={product.thumbnail.url}
													alt={product.thumbnail.alt ?? ""}
													width={128}
													height={128}
													className="h-full w-full object-contain"
												/>
											</div>
										)}
										<div className="min-w-0 flex-1">
											<LinkWithChannel
												href={productPath(product.slug)}
												className="text-sm font-medium hover:underline"
											>
												{product.name}
											</LinkWithChannel>
											{line.variant.name !== line.variant.id && Boolean(line.variant.name) && (
												<p className="text-muted-foreground text-[13px]">{line.variant.name}</p>
											)}
											<p className="text-muted-foreground text-[13px]">
												{t("order.quantity", { quantity: line.quantity })}
											</p>
										</div>
										{lineTotal != null && currency && (
											<span className="text-sm font-medium tabular-nums">
												{formatMoney(lineTotal, currency, locale)}
											</span>
										)}
									</div>
								);
							})}
						</div>

						<div className="border-t px-5 py-4">
							<dl className="space-y-2 text-sm">
								<div className="flex justify-between">
									<dt className="text-muted-foreground">{t("order.subtotal")}</dt>
									<dd className="tabular-nums">
										{formatMoney(order.subtotal.gross.amount, order.subtotal.gross.currency, locale)}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-muted-foreground">{t("order.shipping")}</dt>
									{/* The amount, also when it is 0 — never a "free shipping" word (CLAUDE.md §6, §9). */}
									<dd className="tabular-nums">
										{formatMoney(
											order.shippingPrice.gross.amount,
											order.shippingPrice.gross.currency,
											locale,
										)}
									</dd>
								</div>
								<div className="flex justify-between border-t pt-2 font-semibold">
									<dt>{t("order.total")}</dt>
									<dd className="tabular-nums">
										{formatMoney(order.total.gross.amount, order.total.gross.currency, locale)}
									</dd>
								</div>
								{/* Below the total, because it is part of it: every amount above is gross. */}
								{order.total.tax.amount > 0 && (
									<div className="flex justify-between">
										<dt className="text-muted-foreground">{t("order.taxIncluded")}</dt>
										<dd className="text-muted-foreground tabular-nums">
											{formatMoney(order.total.tax.amount, order.total.tax.currency, locale)}
										</dd>
									</div>
								)}
							</dl>
						</div>
					</div>

					<OrderTimeline order={order} locale={locale} />

					{/* Shortcut into the ONE withdrawal process, not a second one. It carries
					    no order data in the URL: the form lists the signed-in customer's own
					    orders server-side, so there is nothing to pass and nothing to leak
					    into history, referrers or a shared link.
					    Only the Slovak text states the periods, because only it is approved copy.
					    Every other market's text just points to its withdrawal page, where the
					    market's own reviewed legal text says what applies (src/lib/legal/locale.ts);
					    until 2026-09-26 all twelve markets got the Slovak sentence. */}
					<div className="rounded-xl border p-5">
						<h2 className="text-sm font-semibold">{t("withdrawal.title")}</h2>
						<p className="text-muted-foreground mt-1 text-[13px]">{t("withdrawal.body")}</p>
						<LinkWithChannel
							href="/odstupenie-od-zmluvy"
							className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring mt-3 inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
						>
							{t("withdrawal.cta")}
						</LinkWithChannel>
					</div>
				</div>

				<div className="space-y-4">
					{order.shippingAddress && (
						<OrderAddress title={t("order.shippingAddress")} address={order.shippingAddress} />
					)}
					{order.billingAddress && (
						<OrderAddress title={t("order.billingAddress")} address={order.billingAddress} />
					)}

					{order.isPaid && (
						<div className="rounded-xl border px-5 py-4">
							<h3 className="mb-3 text-sm font-semibold">{t("order.payment")}</h3>
							<div className="flex items-center gap-3">
								<CreditCard className="text-muted-foreground h-4 w-4" />
								<span className="text-sm">{t(paymentLabelKey(order.paymentStatus))}</span>
							</div>
						</div>
					)}

					{/* `/kontakt` — this pointed at `/contact`, a 404, until 2026-09-26. */}
					<LinkWithChannel
						href="/kontakt"
						className="hover:bg-secondary/50 block w-full rounded-xl border px-5 py-3 text-center text-sm font-medium transition-colors"
					>
						{t("order.help")}
					</LinkWithChannel>
				</div>
			</div>
		</div>
	);
}

/**
 * The block is only shown for a paid order, so anything not refunded reads as paid. Saleor's raw
 * value (e.g. "PARTIALLY_REFUNDED") was printed as it is until 2026-09-26.
 */
function paymentLabelKey(status: string): string {
	switch (status) {
		case "FULLY_REFUNDED":
			return "order.refunded";
		case "PARTIALLY_REFUNDED":
			return "order.partiallyRefunded";
		default:
			return "order.paid";
	}
}

function OrderAddress({ title, address }: { title: string; address: AddressDetailsFragment }) {
	return (
		<div className="rounded-xl border px-5 py-4">
			<h3 className="mb-3 text-sm font-semibold">{title}</h3>
			<div className="flex gap-3">
				<MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
				<div className="text-sm leading-relaxed">
					<p className="font-medium">
						{address.firstName} {address.lastName}
					</p>
					<p className="text-muted-foreground">{address.streetAddress1}</p>
					{address.streetAddress2 && <p className="text-muted-foreground">{address.streetAddress2}</p>}
					<p className="text-muted-foreground">
						{address.postalCode} {address.city}
					</p>
					<p className="text-muted-foreground">{address.country.country}</p>
				</div>
			</div>
		</div>
	);
}
