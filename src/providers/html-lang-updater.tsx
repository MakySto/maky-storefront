"use client";

import { useEffect } from "react";
import { useLocale } from "@/providers/locale-provider";

/**
 * Corrects `<html lang>` to the market actually being viewed.
 *
 * The root layout owns `<html>` and has no `params` — `[channel]` sits below it — so the
 * served markup carries the store default for all twelve markets. Measured 2026-09-20 on
 * production: `/at`, `/cz` and `/us` are all served `lang="sk"`, and a rendering crawler
 * reads `de`, `cs` and `en` once this has run. Fixing the SERVED value needs `<html>` to
 * move under `[channel]`, which is a second root layout — see the decision recorded in
 * `src/app/checkout/layout.tsx` and the proxy's dependence on `/_not-found` staying static.
 *
 * The full BCP 47 locale, not the bare language. `LOCALE_MAP[...].htmlLang` is two letters,
 * so Austria and Germany both claimed `de` and the US and Canada both claimed `en` — the
 * same collision that hreflang already avoids by annotating with the market's locale
 * (see `src/lib/seo/hreflang.ts`). `de-AT` and `de-DE` are what tell a screen reader which
 * pronunciation to use and a translation tool which variant it is looking at.
 */
export function HtmlLangUpdater() {
	const { locale } = useLocale();

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	return null;
}
