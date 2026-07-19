import { type ReactNode } from "react";

import { brandConfig, formatPageTitle } from "@/config/brand";

// Static metadata: the layout prerenders as part of the PPR static shell, where request data
// (cookies/headers → market locale) must not be read. The store-default (sk-SK) tab title is a
// known cosmetic limitation for other markets — the page content itself localizes via the RSC
// loaders once the checkout's channel is known.
export const metadata = {
	title: formatPageTitle("Pokladňa"),
	description: brandConfig.description,
};

// AuthProvider is now installed inside CheckoutApp (co-located with the checkout client tree),
// so the checkout layout is a plain nested layout under the shared root — no second <html> root
// (variant C: no dual-root), no route group.
export default function CheckoutLayout(props: { children: ReactNode }) {
	return <main>{props.children}</main>;
}
