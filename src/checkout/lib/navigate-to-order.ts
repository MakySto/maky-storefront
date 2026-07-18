import { buildOrderConfirmationPath } from "@/session-bridge";

/**
 * Client navigation to the dedicated order-confirmation route `/checkout/complete?order=`
 * (Track B.4.3, MIGRATION step 5).
 *
 * Uses `window.location.replace` (a HARD navigation), not `router.replace`: `/checkout/complete`
 * is a separate RSC route that fetches the order server-side, and a soft App Router navigation
 * from the post-payment callback does not reliably unmount the checkout SPA. `replace` (not
 * `push`) keeps the confirmed order out of the browser Back history.
 *
 * Placed outside `lib/payment/` on purpose: it is payment-agnostic (session-bridge only) so it
 * does not couple to the payment registry (B.4.4).
 *
 * The checkout cookie is NOT cleared here (client side) — `runCheckoutCompleteAction` clears it
 * server-side in `after()` together with the cart/chrome revalidation (B.4.5), after the client
 * has already left `/checkout?checkout=…`.
 */
export function navigateToOrderConfirmation(orderId: string) {
	window.location.replace(buildOrderConfirmationPath({ orderId }));
}
