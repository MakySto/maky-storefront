import "server-only";

import { revalidatePath } from "next/cache";
import { REVERSE_MAP } from "@/lib/channel-map";

/**
 * MAKY adaptation of the upstream module (B.4.5): upstream iterates configured locales over
 * `/{locale}/{channel}` paths; MAKY variant C serves a friendly market prefix (`/sk`) that maps
 * to the Saleor channel (`sk-eur`) via CHANNEL_MAP, plus the raw `/{channel}` dynamic route.
 * Both prefixes are busted.
 */

/** Bust a cached browse page for a channel (friendly market + raw channel prefixes). */
export function revalidateStorefrontBrowsePath(channel: string, suffix: string) {
	const market = REVERSE_MAP[channel];
	if (market) {
		revalidatePath(`/${market}${suffix}`);
	}
	revalidatePath(`/${channel}${suffix}`);
}

/**
 * Invalidate cached storefront chrome after session or cart changes (PPR-safe).
 * Busts the channel layout (header user menu + cart badge) and the checkout shell.
 * Server actions / route handlers only — not during RSC render.
 */
export function revalidateStorefrontChrome(channel?: string | null) {
	if (channel) {
		const market = REVERSE_MAP[channel];
		if (market) {
			revalidatePath(`/${market}`, "layout");
		}
		revalidatePath(`/${channel}`, "layout");
	}
	revalidatePath("/checkout");
}
