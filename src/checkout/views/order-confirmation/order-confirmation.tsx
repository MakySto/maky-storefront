"use client";

import Link from "next/link";
import { CheckCircle, Mail, MapPin, CreditCard } from "lucide-react";
import { useOrder } from "@/checkout/hooks/use-order";
import { OrderSummary } from "@/checkout/views/saleor-checkout/order-summary";
import { CheckoutHeader } from "@/checkout/views/saleor-checkout/checkout-header";
import { DefaultChannelSlug } from "@/app/config";
import { marketHref } from "@/lib/channel-map";

/** Format address for display */
function formatAddress(address: {
	streetAddress1?: string | null;
	city?: string | null;
	postalCode?: string | null;
	country?: { country?: string | null } | null;
}) {
	return [address.streetAddress1, address.city, address.postalCode, address.country?.country]
		.filter(Boolean)
		.join(", ");
}

/**
 * Order confirmation page - uses the same layout as SaleorCheckout
 * Renders after successful order creation with real order data.
 */
export const OrderConfirmation = () => {
	const { order } = useOrder();
	// The route only renders this view when the order is present (OrderConfirmationApp shows the
	// not-found otherwise); this guard narrows the type for the render below.
	if (!order) {
		return null;
	}
	const channel = DefaultChannelSlug;

	const shippingAddress = order.shippingAddress;
	const billingAddress = order.billingAddress;
	const email = order.userEmail || "";

	return (
		<div className="bg-secondary min-h-screen">
			{/* Header - same as checkout */}
			<CheckoutHeader step={4} onStepClick={() => {}} />

			{/* Main content - same layout as checkout */}
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{/* Two column layout: ~70% Content + ~30% Summary */}
				<div className="flex flex-col gap-8 md:flex-row">
					{/* Left column: Confirmation content (~70%) */}
					<div className="order-2 min-w-0 flex-1 md:order-1">
						<div className="border-border bg-card rounded-lg border p-6 md:p-8">
							{/* Same content as ConfirmationStep */}
							<div className="space-y-8">
								{/* Success Header */}
								<div className="space-y-4 text-center">
									<div className="flex justify-center">
										<div className="relative">
											<div className="absolute inset-0 animate-ping rounded-full bg-green-400/30" />
											<CheckCircle className="relative h-16 w-16 text-green-500" />
										</div>
									</div>
									<div>
										<p className="text-muted-foreground">Order #{order.number}</p>
										<h1 className="mt-1 text-2xl font-semibold">Thank you for your order!</h1>
									</div>
								</div>

								{/* Order Confirmation Card */}
								<div className="border-border overflow-hidden rounded-lg border">
									<div className="bg-secondary/50 border-border border-b p-4">
										<h2 className="font-semibold">Your order is confirmed</h2>
										<p className="text-muted-foreground mt-1 text-sm">
											You&apos;ll receive a confirmation email at {email}
										</p>
									</div>

									{/* Order Details */}
									<div className="space-y-4 p-4">
										<div className="flex items-start gap-3">
											<Mail className="text-muted-foreground mt-0.5 h-5 w-5" />
											<div>
												<p className="text-sm font-medium">Confirmation email sent</p>
												<p className="text-muted-foreground text-sm">{email}</p>
											</div>
										</div>
										{shippingAddress && (
											<div className="flex items-start gap-3">
												<MapPin className="text-muted-foreground mt-0.5 h-5 w-5" />
												<div>
													<p className="text-sm font-medium">Shipping address</p>
													<p className="text-muted-foreground text-sm">{formatAddress(shippingAddress)}</p>
												</div>
											</div>
										)}
										{billingAddress && (
											<div className="flex items-start gap-3">
												<CreditCard className="text-muted-foreground mt-0.5 h-5 w-5" />
												<div>
													<p className="text-sm font-medium">Billing address</p>
													<p className="text-muted-foreground text-sm">{formatAddress(billingAddress)}</p>
												</div>
											</div>
										)}
									</div>
								</div>

								{/* Actions */}
								<div className="flex flex-col gap-4 sm:flex-row">
									<Link
										href={marketHref(channel || "sk")}
										className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-12 flex-1 items-center justify-center rounded-md border bg-transparent px-4 text-sm font-medium transition-colors"
									>
										Continue shopping
									</Link>
								</div>
							</div>
						</div>
					</div>

					{/* Right column: Summary (~30%, max 380px) */}
					<div className="order-1 md:order-2 md:shrink-0 md:basis-[30%]">
						<div className="border-border bg-card overflow-hidden rounded-lg border md:sticky md:top-8">
							<OrderSummary order={order} editable={false} />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};
