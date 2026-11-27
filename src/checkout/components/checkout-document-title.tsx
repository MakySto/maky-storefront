"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatPageTitle } from "@/config/brand";
import { documentLangFor } from "@/checkout/lib/document-lang";

/**
 * Sets the localized browser-tab title and the document language after hydration. The /checkout
 * layout prerenders inside the PPR static shell where request data (market locale) must not be
 * read, so the server-rendered title and `<html lang>` are the store default (sk) — this client
 * effect replaces both once the checkout tree has locale context.
 *
 * The language matters more than the title: a German checkout announced `lang="sk-SK"`, so a
 * screen reader read German with Slovak pronunciation and the browser offered to translate the
 * page "from Slovak" (audit of the live store, 2026-11-27).
 */
export function CheckoutDocumentTitle() {
	const t = useTranslations("checkout.meta");
	const locale = useLocale();
	const title = formatPageTitle(t("title"));
	const lang = documentLangFor(locale);

	useEffect(() => {
		document.title = title;
	}, [title]);

	useEffect(() => {
		const root = document.documentElement;
		if (root.lang === lang) return;
		root.lang = lang;
		// Nothing to restore on unmount: leaving the checkout for a market page is a full
		// document load (the two live under different root layouts), and that document
		// carries its own language.
	}, [lang]);

	return null;
}
