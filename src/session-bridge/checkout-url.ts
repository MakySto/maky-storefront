export type BuildCheckoutPathOptions = {
	checkoutId: string;
	step?: string;
	/**
	 * Browse locale to sync to checkout via `?locale=`.
	 * MAKY is variant C: there is NO `[locale]` URL segment — do NOT source this from the URL.
	 * When needed, derive it from the checkout's channel:
	 * `CHANNEL_MAP[REVERSE_MAP[saleorSlug]].locale` (see `@/lib/channel-map`).
	 * Current call sites pass none, so no `?locale=` is emitted (path stays `/checkout?checkout=<id>`).
	 */
	browseLocale?: string;
};

export type BuildOrderConfirmationPathOptions = {
	orderId: string;
};

/** Query keys as they appear in the browser URL (not internal mapped names). */
const urlQueryKeys = {
	checkout: "checkout",
	order: "order",
	step: "step",
	locale: "locale",
} as const;

/**
 * Relative checkout path (same-origin Paper deploy).
 */
export function buildCheckoutPath({ checkoutId, step, browseLocale }: BuildCheckoutPathOptions): string {
	const params = new URLSearchParams();
	params.set(urlQueryKeys.checkout, checkoutId);

	if (step) {
		params.set(urlQueryKeys.step, step);
	}

	if (browseLocale) {
		params.set(urlQueryKeys.locale, browseLocale);
	}

	return `/checkout?${params.toString()}`;
}

/**
 * Order confirmation path — separate route from active checkout (`/checkout?checkout=`).
 */
export function buildOrderConfirmationPath({ orderId }: BuildOrderConfirmationPathOptions): string {
	const params = new URLSearchParams();
	params.set(urlQueryKeys.order, orderId);
	return `/checkout/complete?${params.toString()}`;
}

/**
 * Origin for checkout links. Empty NEXT_PUBLIC_CHECKOUT_URL → same deploy (relative paths).
 */
export function getCheckoutOrigin(): string | undefined {
	const configured = process.env.NEXT_PUBLIC_CHECKOUT_URL?.replace(/\/$/, "");
	return configured || undefined;
}

/**
 * Absolute or relative checkout URL for cart → checkout handoff.
 */
export function buildCheckoutUrl(options: BuildCheckoutPathOptions): string {
	const path = buildCheckoutPath(options);
	const origin = getCheckoutOrigin();

	if (!origin) {
		return path;
	}

	return `${origin}${path}`;
}

/**
 * Absolute or relative order confirmation URL.
 */
export function buildOrderConfirmationUrl(options: BuildOrderConfirmationPathOptions): string {
	const path = buildOrderConfirmationPath(options);
	const origin = getCheckoutOrigin();

	if (!origin) {
		return path;
	}

	return `${origin}${path}`;
}
