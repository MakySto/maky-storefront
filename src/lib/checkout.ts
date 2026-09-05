import { cookies } from "next/headers";
import {
	CheckoutCreateDocument,
	CheckoutFindDocument,
	type CheckoutCreateMutation,
	type CheckoutFindQuery,
} from "@/gql/graphql";
import { checkoutGraphqlLocaleVariables, resolveCheckoutLocale } from "@/lib/checkout-locale";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { checkoutIdCookieName } from "@/session-bridge";

export async function getIdFromCookies(channel: string) {
	try {
		const cookieName = checkoutIdCookieName(channel);
		const checkoutId = (await cookies()).get(cookieName)?.value || "";
		return checkoutId;
	} catch {
		// During static generation, cookies() throws - return empty string
		return "";
	}
}

/**
 * Channel slug from cart cookies when the checkout channel is not yet known (e.g. an
 * empty checkout, or `/checkout` opened without `?checkout=`). Checkout lives at
 * `/checkout` (no `[channel]` segment) but cart cookies are per channel: the default
 * channel (`NEXT_PUBLIC_DEFAULT_CHANNEL`, `sk-eur`) wins, else the pick is deterministic
 * (alphabetical) across channels.
 */
export async function getChannelSlugFromCartCookies(): Promise<string | null> {
	try {
		const cartCookies = (await cookies())
			.getAll()
			.filter((cookie) => cookie.name.startsWith("checkoutId-") && cookie.value);

		if (cartCookies.length === 0) {
			return null;
		}

		const channelFromCookie = (name: string) => name.slice(checkoutIdCookieName("").length);

		const defaultChannel = process.env.NEXT_PUBLIC_DEFAULT_CHANNEL;
		if (defaultChannel) {
			const preferred = cartCookies.find((cookie) => cookie.name === checkoutIdCookieName(defaultChannel));
			if (preferred) {
				return channelFromCookie(preferred.name);
			}
		}

		return channelFromCookie([...cartCookies].sort((a, b) => a.name.localeCompare(b.name))[0].name);
	} catch {
		return null;
	}
}

/** Cart checkout id when `/checkout` has no `?checkout=` param (default channel wins). */
export async function getFirstCheckoutIdFromCartCookies(): Promise<string | null> {
	try {
		const cartCookies = (await cookies())
			.getAll()
			.filter((cookie) => cookie.name.startsWith("checkoutId-") && cookie.value);

		if (cartCookies.length === 0) {
			return null;
		}

		const defaultChannel = process.env.NEXT_PUBLIC_DEFAULT_CHANNEL;
		if (defaultChannel) {
			const preferred = cartCookies.find((cookie) => cookie.name === checkoutIdCookieName(defaultChannel));
			if (preferred) {
				return preferred.value;
			}
		}

		return [...cartCookies].sort((a, b) => a.name.localeCompare(b.name))[0].value;
	} catch {
		return null;
	}
}

export async function saveIdToCookie(channel: string, checkoutId: string) {
	const shouldUseHttps =
		process.env.NEXT_PUBLIC_STOREFRONT_URL?.startsWith("https") || !!process.env.NEXT_PUBLIC_VERCEL_URL;
	const cookieName = checkoutIdCookieName(channel);
	(await cookies()).set(cookieName, checkoutId, {
		sameSite: "lax",
		secure: shouldUseHttps,
	});
}

export async function clearCheckoutCookie(channel: string) {
	const cookieName = checkoutIdCookieName(channel);
	(await cookies()).delete(cookieName);
}

/** Remove any channel cookie that points at a stale checkout id (checkout not found). */
export async function clearCheckoutCookieByValue(checkoutId: string) {
	if (!checkoutId) {
		return;
	}

	try {
		const cookieStore = await cookies();
		for (const cookie of cookieStore.getAll()) {
			if (cookie.name.startsWith("checkoutId-") && cookie.value === checkoutId) {
				cookieStore.delete(cookie.name);
			}
		}
	} catch {
		// Ignore in static contexts
	}
}

/**
 * Why a checkout lookup did not return a checkout.
 *
 * `null` used to mean both "Saleor says this checkout does not exist" and "we
 * could not ask" — and `findOrCreate` treated the second as the first, so a few
 * seconds of Saleor being unreachable made the storefront issue a NEW checkout
 * and overwrite the cookie. The customer's basket was not deleted; the pointer
 * to it was. From their side it is the same thing.
 *
 * `not-found` is a claim, and only a definitive answer earns it: Saleor replied,
 * and the checkout is not there. A timeout, a 5xx, a transport failure or a
 * GraphQL error are all `upstream-error` — we learned nothing.
 *
 * `checkout-session-loader.tsx` has always drawn this distinction (`loadState`
 * "error" vs "not_found", and it clears the cookie only for the latter). This
 * brings the cart path to the same standard.
 */
export type CheckoutLookup<T> =
	| { status: "found"; checkout: T }
	| { status: "not-found" }
	| { status: "upstream-error"; reason: string };

/**
 * Ask Saleor about a checkout, and say honestly which of the three answers came
 * back. Callers that may WRITE — replace a cookie, create a replacement, clear a
 * session — must use this rather than `find`.
 */
export async function lookup(
	checkoutId: string,
	/**
	 * `signal` bounds the whole call — queue wait, auth path, response and body.
	 * `retry: false` matters when a caller is holding a deadline: this is a query,
	 * so it otherwise keeps the transport's three attempts with exponential
	 * backoff, and a single lookup can then outlast the budget on its own.
	 */
	options?: { signal?: AbortSignal; retry?: boolean },
): Promise<CheckoutLookup<FoundCheckout>> {
	if (!checkoutId) {
		// No pointer at all is not an outage; there is genuinely nothing to find.
		return { status: "not-found" };
	}

	const result = await executeAuthenticatedGraphQL(CheckoutFindDocument, {
		variables: { id: checkoutId },
		cache: "no-cache",
		...options,
	});

	if (!result.ok) {
		return { status: "upstream-error", reason: result.error.message };
	}

	return result.data.checkout ? { status: "found", checkout: result.data.checkout } : { status: "not-found" };
}

/** The checkout exactly as `CheckoutFind` returns it. */
export type FoundCheckout = NonNullable<CheckoutFindQuery["checkout"]>;

/**
 * The checkout as `CheckoutCreate` returns it — a genuinely different shape:
 * the create mutation does not select the variant attribute lists. Keeping the
 * union honest is better than widening one to the other, because callers that
 * need attributes must not silently receive a checkout that has none.
 */
export type CreatedCheckout = NonNullable<NonNullable<CheckoutCreateMutation["checkoutCreate"]>["checkout"]>;

/**
 * Read-only convenience wrapper: the checkout, or `null` for any reason.
 *
 * Kept for surfaces that only DISPLAY — they cannot destroy anything, so
 * collapsing the two failures is survivable there. It must not be used on a
 * write or session path; `lookup` exists because that collapse is exactly the
 * defect.
 */
export async function find(checkoutId: string) {
	const result = await lookup(checkoutId);
	return result.status === "found" ? result.checkout : null;
}

/** What `findOrCreate` settled on, and whether a new checkout was issued. */
export type EnsuredCheckout<T> =
	| { status: "ready"; checkout: T; created: boolean }
	| { status: "unavailable"; reason: string };

/**
 * The existing checkout when there is one, a new one only when we KNOW there is
 * not.
 *
 * The `upstream-error` arm is the point of this function: it returns
 * `unavailable` rather than quietly minting a replacement. Nothing is written,
 * the cookie keeps pointing at the basket the customer still has, and the caller
 * reports a clean failure — which is honest, because nothing was attempted.
 */
export async function findOrCreate({
	channel,
	checkoutId,
}: {
	checkoutId?: string;
	channel: string;
}): Promise<EnsuredCheckout<FoundCheckout | CreatedCheckout>> {
	if (checkoutId) {
		const existing = await lookup(checkoutId);
		if (existing.status === "found") {
			return { status: "ready", checkout: existing.checkout, created: false };
		}
		if (existing.status === "upstream-error") {
			// Do NOT create a replacement. We do not know that the old one is gone.
			return { status: "unavailable", reason: existing.reason };
		}
		// `not-found`: Saleor answered, so a new checkout is the right response.
	}

	const result = await create({ channel });
	if (!result.ok) {
		return { status: "unavailable", reason: result.error.message };
	}

	const created = result.data.checkoutCreate?.checkout;
	if (!created) {
		return { status: "unavailable", reason: "checkoutCreate returned no checkout" };
	}

	return { status: "ready", checkout: created, created: true };
}

// The checkout is born with the market's language (central market config, krok 2): the
// languageCode set here flows to the order and the transactional e-mail.
export const create = ({ channel }: { channel: string }) =>
	executeAuthenticatedGraphQL(CheckoutCreateDocument, {
		cache: "no-cache",
		variables: { channel, ...checkoutGraphqlLocaleVariables(resolveCheckoutLocale(channel)) },
	});
