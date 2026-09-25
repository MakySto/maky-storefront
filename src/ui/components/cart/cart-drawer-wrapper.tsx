import * as Checkout from "@/lib/checkout";
import { resolveCheckoutLocale } from "@/lib/checkout-locale";
import { cartLineFitments } from "@/ui/components/fitment/cart-line-fitment";
import { CartDrawer } from "./cart-drawer-content";

interface CartDrawerWrapperProps {
	channel: string;
}

export async function CartDrawerWrapper({ channel }: CartDrawerWrapperProps) {
	const checkoutId = await Checkout.getIdFromCookies(channel);
	const lookup = await Checkout.lookup(checkoutId, { locale: resolveCheckoutLocale(channel) });
	const checkout = lookup.status === "found" ? lookup.checkout : null;
	// Each line's fit with the saved car, as its product page states it — silence where that page
	// would be silent, and never a reason for the drawer not to open.
	const fitments = await cartLineFitments(
		channel,
		(checkout?.lines ?? []).map((line) => line.variant.product.id),
	);

	return (
		<CartDrawer
			checkoutId={checkoutId || null}
			lines={checkout?.lines ?? []}
			totalPrice={checkout?.totalPrice ?? null}
			subtotalPrice={checkout?.subtotalPrice ?? null}
			shippingPrice={checkout?.shippingPrice ?? null}
			channel={channel}
			fitments={fitments}
			// An empty drawer and an unreachable one are different statements. Only
			// one of them is about the shopper's basket.
			loadFailed={lookup.status === "upstream-error"}
		/>
	);
}
