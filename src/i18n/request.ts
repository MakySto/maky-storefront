import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_MAP } from "@/config/locale";

export default getRequestConfig(async ({ requestLocale }) => {
  const rawLocale = (await requestLocale) || DEFAULT_LOCALE;
  const locale = rawLocale in LOCALE_MAP ? rawLocale : DEFAULT_LOCALE;

  let messages;
  try {
    messages = (await import(`./messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`./messages/${DEFAULT_LOCALE}.json`)).default;
  }

  return { locale, messages };
});