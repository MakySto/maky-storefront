"use client";

import { LayoutGridIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AllCategoriesTrigger() {
  const t = useTranslations("nav");

  return (
    <button
      type="button"
      aria-label={t("allCategories")}
      className="inline-flex h-10 items-center gap-2 rounded-sm bg-copper-600 px-4 text-sm font-medium text-white transition-colors hover:bg-copper-700"
    >
      <LayoutGridIcon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{t("allCategories")}</span>
      <ChevronDownIcon className="h-3.5 w-3.5 opacity-80" aria-hidden />
    </button>
  );
}
