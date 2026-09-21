import { type ReactNode } from "react";

import { brandConfig, formatPageTitle } from "@/config/brand";

// Static metadata: the layout prerenders as part of the PPR static shell, where request data
// (cookies/headers → market locale) must not be read. The store-default (sk-SK) tab title is a
// known cosmetic limitation for other markets — the page content itself localizes via the RSC
// loaders once the checkout's channel is known.
export const metadata = {
	// Store-default title in the static shell; CheckoutDocumentTitle swaps in the market-locale
	// title (checkout.meta.title) client-side after hydration.
	title: formatPageTitle("Pokladňa"),
	description: brandConfig.description,
	/**
	 * `noindex, follow`, the same as the cart and the order list.
	 *
	 * Both checkout routes declared `index, follow` until 2026-09-21 — inherited from the root
	 * metadata, because they sit outside `[channel]` and so never saw the market layout's
	 * robots. `robots.txt` does carry `Disallow: /checkout`, and that is the wrong tool on its
	 * own: a URL a crawler may not fetch can never be re-crawled, so it can never be dropped
	 * either. The Disallow keeps it from being spent crawl budget; this is what keeps it out of
	 * the index. `follow`, not `nofollow`, for the same reason the cart uses it — the page links
	 * back into the catalogue.
	 *
	 * Covers `/checkout/complete` too: no child overrides `robots`.
	 */
	robots: { index: false, follow: true },
};

// AuthProvider is now installed inside CheckoutApp (co-located with the checkout client tree),
// so the checkout layout is a plain nested layout under the shared root — no second <html> root
// (variant C: no dual-root), no route group.
export default function CheckoutLayout(props: { children: ReactNode }) {
	return <main>{props.children}</main>;
}
