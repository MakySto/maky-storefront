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
 * B.4.3 reduced port (variant C): the checkout cookie is intentionally NOT cleared here — MAKY's
 * `checkoutCompleteAction` performs no cookie clear / chrome revalidation today (that lands in
 * B.4.5), so there is nothing to defer via `after()`.
 */
export function navigateToOrderConfirmation(orderId: string) {
	window.location.replace(buildOrderConfirmationPath({ orderId }));
}
