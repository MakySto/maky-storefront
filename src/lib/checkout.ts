import { cookies } from "next/headers";
import { CheckoutCreateDocument, CheckoutFindDocument } from "@/gql/graphql";
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

export async function find(checkoutId: string) {
	if (!checkoutId) {
		return null;
	}

	const result = await executeAuthenticatedGraphQL(CheckoutFindDocument, {
		variables: { id: checkoutId },
		cache: "no-cache",
	});

	// Return null on error or if checkout not found
	return result.ok ? result.data.checkout : null;
}

export async function findOrCreate({ channel, checkoutId }: { checkoutId?: string; channel: string }) {
	if (!checkoutId) {
		const result = await create({ channel });
		return result.ok ? result.data.checkoutCreate?.checkout : null;
	}

	const checkout = await find(checkoutId);
	if (checkout) {
		return checkout;
	}

	const result = await create({ channel });
	return result.ok ? result.data.checkoutCreate?.checkout : null;
}

export const create = ({ channel }: { channel: string }) =>
	executeAuthenticatedGraphQL(CheckoutCreateDocument, { cache: "no-cache", variables: { channel } });
