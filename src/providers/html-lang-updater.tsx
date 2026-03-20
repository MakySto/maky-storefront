"use client";

import { useEffect } from "react";
import { useLocale } from "@/providers/locale-provider";

/**
 * Updates <html lang> client-side to match the current market.
 * Root layout is static (lang="sk"), this corrects it for /de, /cz, etc.
 * When we add next-intl later, this will be handled natively.
 */
export function HtmlLangUpdater() {
	const { htmlLang } = useLocale();

	useEffect(() => {
		document.documentElement.lang = htmlLang;
	}, [htmlLang]);

	return null;
}