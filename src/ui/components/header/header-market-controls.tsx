"use client";

import { useTranslations } from "next-intl";
import { GlobeIcon, ChevronDownIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { LOCALE_MAP } from "@/config/locale";

export function HeaderMarketControls() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const localeConfig = LOCALE_MAP[locale as keyof typeof LOCALE_MAP];

  const languageLabel = localeConfig?.label?.split(" ")[0] || String(locale).split("-")[0].toUpperCase();
  const currencyCode = localeConfig?.currency || "EUR";

  return (
    <div className="hidden items-center gap-1.5 lg:flex">
      <button
        type="button"
        aria-label={t("language")}
        className="inline-flex h-9 items-center gap-1.5 rounded-xs border border-sand-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-sand-300 hover:text-gray-900"
      >
        <GlobeIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{languageLabel}</span>
        <ChevronDownIcon className="h-3 w-3 opacity-50" aria-hidden />
      </button>

      <button
        type="button"
        aria-label={t("currency")}
        className="inline-flex h-9 items-center gap-1.5 rounded-xs border border-sand-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-sand-300 hover:text-gray-900"
      >
        <span>{currencyCode}</span>
        <ChevronDownIcon className="h-3 w-3 opacity-50" aria-hidden />
      </button>
    </div>
  );
}