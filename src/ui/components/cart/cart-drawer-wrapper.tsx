import * as Checkout from "@/lib/checkout";
import { CartDrawer } from "./cart-drawer";

interface CartDrawerWrapperProps {
	channel: string;
}

export async function CartDrawerWrapper({ channel }: CartDrawerWrapperProps) {
	const checkoutId = await Checkout.getIdFromCookies(channel);
	const lookup = await Checkout.lookup(checkoutId);
	const checkout = lookup.status === "found" ? lookup.checkout : null;

	return (
		<CartDrawer
			checkoutId={checkoutId || null}
			lines={checkout?.lines ?? []}
			totalPrice={checkout?.totalPrice ?? null}
			channel={channel}
			// An empty drawer and an unreachable one are different statements. Only
			// one of them is about the shopper's basket.
			loadFailed={lookup.status === "upstream-error"}
		/>
	);
}
