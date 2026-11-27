import { LOCALE_MAP } from "@/config/locale";

/**
 * The `<html lang>` of a checkout page: the market's BCP 47 tag, the same value the market
 * layout writes (`app/[channel]/layout.tsx`).
 *
 * The checkout sits outside `[channel]`, so its document is prerendered with the store default
 * and learns its market only when the session is read. A locale the map does not know is passed
 * through: it came from the same resolver that chose the messages, so it names the language the
 * page is actually written in.
 */
export function documentLangFor(locale: string): string {
	return LOCALE_MAP[locale]?.locale ?? locale;
}
