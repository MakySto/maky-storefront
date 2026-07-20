"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { formatPageTitle } from "@/config/brand";

/**
 * Sets the localized browser-tab title after hydration. The /checkout layout metadata
 * prerenders inside the PPR static shell where request data (market locale) must not be
 * read, so the server-rendered title is the store default (sk) — this client effect
 * replaces it with the market-locale title once the checkout tree has locale context.
 */
export function CheckoutDocumentTitle() {
	const t = useTranslations("checkout.meta");
	const title = formatPageTitle(t("title"));

	useEffect(() => {
		document.title = title;
	}, [title]);

	return null;
}
