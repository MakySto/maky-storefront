import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_MAP } from "@/config/locale";

export default getRequestConfig(async () => {
  const headersList = await headers();
  const rawLocale = headersList.get("x-locale") || DEFAULT_LOCALE;
  const locale = rawLocale in LOCALE_MAP ? rawLocale : DEFAULT_LOCALE;

  let messages;
  try {
    messages = (await import(`./messages/${locale}.json`)).default;
  } catch {
    // Fallback to Slovak if message file missing
    messages = (await import(`./messages/${DEFAULT_LOCALE}.json`)).default;
  }

  return { locale, messages };
});
