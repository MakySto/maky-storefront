import { type ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { resolveFallbackLocale } from "@/checkout/lib/server/resolve-fallback-locale";
import { brandConfig, formatPageTitle } from "@/config/brand";

// Layouts see no searchParams, so the market-cookie fallback (→ store default) is the best
// locale signal here; the channel-derived locale is only known inside the RSC loaders.
export async function generateMetadata() {
	const locale = await resolveFallbackLocale();
	const t = await getTranslations({ locale, namespace: "checkout" });
	return {
		title: formatPageTitle(t("title")),
		description: brandConfig.description,
	};
}

// AuthProvider is now installed inside CheckoutApp (co-located with the checkout client tree),
// so the checkout layout is a plain nested layout under the shared root — no second <html> root
// (variant C: no dual-root), no route group.
export default function CheckoutLayout(props: { children: ReactNode }) {
	return <main>{props.children}</main>;
}
