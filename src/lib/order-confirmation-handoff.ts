import { NextResponse, type NextRequest } from "next/server";

/**
 * The order id leaves the URL before any page can load.
 *
 * `/checkout/complete?order=<id>` used to be the confirmation URL, and the order id is the
 * credential: `fetchOrderOnServer` reads the order by id alone, and the page shows the
 * customer e-mail, both addresses and the phone number. Every page loads the tag manager, so
 * the automatic page_view sent that URL to GA4 and to Google Ads as `page_location` (with and
 * without consent: cookieless pings carry it too), and the next page sent it again as
 * `page_referrer`. Measured on a production build, 2026-09-23.
 *
 * So the proxy answers any GET to `/checkout` or `/checkout/complete` that carries `order`
 * with a 303 to `/checkout/complete` (every other parameter kept) and hands the id over in a
 * cookie instead. The document that loads analytics never has the id in its URL, so there is
 * nothing for a page_view, a consent ping or the referrer of the next page to pick up. Whatever
 * produces the old URL keeps working unchanged: `navigateToOrderConfirmation()` after payment,
 * and any saved or mailed link that carries the id.
 *
 * The cookie:
 * - `HttpOnly`: no script on the page (the tag manager included) can read it.
 * - `Path=/checkout/complete`: the browser sends it to the confirmation page and nowhere else.
 * - `SameSite=Lax`: a link opened from a mail client is a top-level cross-site GET, which Lax
 *   allows.
 * - `Secure`: the site is HTTPS only. Browsers treat http://localhost as secure too, so local
 *   previews work.
 * - 30 minutes. Long enough to reload the confirmation, print it or come back to the tab a
 *   little later; short enough that a shared computer does not go on showing the name, address
 *   and phone of the previous customer. A link that carries the id does not depend on it: every
 *   click issues a fresh cookie. The window runs from the last time such a link was opened.
 *   Reloads do not extend it, because only the proxy sets the cookie.
 */
export const ORDER_CONFIRMATION_PATH = "/checkout/complete";
export const ORDER_CONFIRMATION_COOKIE = "maky-order-confirmation";
export const ORDER_CONFIRMATION_COOKIE_MAX_AGE = 30 * 60;

const HANDOFF_PATHS = new Set(["/checkout", ORDER_CONFIRMATION_PATH]);

/**
 * Saleor order ids are base64 of `Order:<uuid>`, so every one of them starts with the base64
 * of `Order:`. Checked before the value is stored, so a crafted link cannot plant arbitrary
 * text in a cookie, and again when the page reads it.
 */
const ORDER_ID_PREFIX = "T3JkZXI6";
const ORDER_ID_SHAPE = /^[A-Za-z0-9+/_-]{8,128}={0,2}$/;

export function isOrderId(value: unknown): value is string {
	return typeof value === "string" && value.startsWith(ORDER_ID_PREFIX) && ORDER_ID_SHAPE.test(value);
}

const cookieAttributes = {
	httpOnly: true,
	secure: true,
	sameSite: "lax",
	path: ORDER_CONFIRMATION_PATH,
} as const;

/**
 * The proxy step. Returns null for every request it does not own.
 *
 * GET and HEAD only: a server action posts to the URL of the page it runs on, and a redirect
 * would drop its body. A value that is not an order id still leaves the URL, and it clears
 * any earlier cookie, so a link always shows what it names and never the previous order.
 */
export function orderConfirmationHandoff(request: NextRequest): NextResponse | null {
	const { pathname, searchParams } = request.nextUrl;
	if (!HANDOFF_PATHS.has(pathname) || !searchParams.has("order")) return null;
	if (request.method !== "GET" && request.method !== "HEAD") return null;

	const orderId = searchParams.get("order");
	const target = request.nextUrl.clone();
	target.pathname = ORDER_CONFIRMATION_PATH;
	target.searchParams.delete("order");

	const res = NextResponse.redirect(target, 303);
	res.headers.set("cache-control", "no-store");
	if (isOrderId(orderId)) {
		res.cookies.set(ORDER_CONFIRMATION_COOKIE, orderId, {
			...cookieAttributes,
			maxAge: ORDER_CONFIRMATION_COOKIE_MAX_AGE,
		});
	} else {
		res.cookies.set(ORDER_CONFIRMATION_COOKIE, "", { ...cookieAttributes, maxAge: 0 });
	}
	return res;
}

/** The order id the confirmation page renders, or null. Never read from the URL. */
export function readOrderConfirmationId(cookies: {
	get(name: string): { value: string } | undefined;
}): string | null {
	const value = cookies.get(ORDER_CONFIRMATION_COOKIE)?.value;
	return isOrderId(value) ? value : null;
}
