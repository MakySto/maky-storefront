"use client";

import { useTranslations } from "next-intl";

export function NewsletterCTA() {
  const t = useTranslations("footer");

  return (
    <section className="bg-gray-900 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t("newsletter")}
          </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <input
              type="email"
              placeholder={t("newsletterPlaceholder")}
              className="min-w-0 flex-auto rounded-lg border-0 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-400 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-amber-500 sm:text-sm"
            />
            <button
              type="button"
              className="rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              {t("subscribe")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
