"use client";

import type { useRouter } from "next/navigation";

import { revalidateStorefrontChromeAction } from "@/app/actions";
import { markAuthSurfaceHardNav } from "@/lib/auth/auth-surface-nav";

type Router = ReturnType<typeof useRouter>;

export type SyncAuthSurfacesAfterSignInOptions = {
	/** Full navigation after cache bust — reliable once BFF Set-Cookie has landed. */
	redirectTo?: string;
	/** Skip router.refresh() when client UI must stay mounted (e.g. password-reset success screen). */
	skipRefresh?: boolean;
};

/**
 * Bust cached auth UI and refresh RSC after BFF sign-in (cookies already set by the API route).
 * MAKY adaptation (B.4.5): upstream's `navigateToStorefrontHome` locale helper is not adopted —
 * MAKY navigation goes through `marketHref`; only the sync path has a consumer here.
 */
export async function syncAuthSurfacesAfterSignIn(
	channel: string,
	router: Router,
	options?: SyncAuthSurfacesAfterSignInOptions,
): Promise<void> {
	if (!channel) {
		throw new Error("syncAuthSurfacesAfterSignIn requires a channel slug");
	}

	await revalidateStorefrontChromeAction(channel);

	if (options?.redirectTo) {
		// Hard navigation: avoids router.refresh() racing on the login page and guarantees
		// cookies + invalidated layout are picked up on the destination.
		markAuthSurfaceHardNav();
		window.location.assign(options.redirectTo);
		return;
	}

	if (!options?.skipRefresh) {
		router.refresh();
	}
}
