import { type ReactNode } from "react";

import { brandConfig, formatPageTitle } from "@/config/brand";

export const metadata = {
	title: formatPageTitle("Checkout"),
	description: brandConfig.description,
};

// AuthProvider is now installed inside CheckoutApp (co-located with the checkout client tree),
// so the checkout layout is a plain nested layout under the shared root — no second <html> root
// (variant C: no dual-root), no route group.
export default function CheckoutLayout(props: { children: ReactNode }) {
	return <main>{props.children}</main>;
}
