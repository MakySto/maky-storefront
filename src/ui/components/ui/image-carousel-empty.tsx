"use client";

import { useTranslations } from "next-intl";

export function ImageCarouselEmpty() {
  const t = useTranslations("product");

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-border-default bg-gradient-to-br from-surface-secondary to-surface-muted p-6">
      <div className="flex max-w-[18rem] flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle bg-surface-card shadow-sm">
          <svg
            className="h-8 w-8 text-text-tertiary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-text-primary">
            {t("noImageAvailable")}
          </p>
        </div>
      </div>
    </div>
  );
}