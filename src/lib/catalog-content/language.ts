import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";

/**
 * Which catalogue language a market reads.
 *
 * The market's own locale, cut to its language: `sk` reads `sk-SK` → `sk`, `at` reads
 * `de-AT` → `de`, `cz` reads `cs-CZ` → `cs`. Two markets sharing a language share an
 * artifact, which is why `us` and `ca` both read `en` — CFM publishes one English text,
 * not one per country.
 *
 * Returns `null` for a market nobody has mapped, and the caller then serves no pages.
 * Guessing would be worse: it is the difference between "this market has no catalogue"
 * and "this market has someone else's".
 *
 * A module of its own, free of `server-only`, because the proxy needs the same answer: a
 * retired page's redirect is looked up by the language its market reads, and a second
 * derivation there could disagree with the one that picks the artifact.
 */
export function catalogLanguageForMarket(market: string): string | null {
	const locale = CHANNEL_MAP[market]?.locale;
	if (!locale) return null;
	return locale.split("-")[0]?.toLowerCase() || null;
}

/** Same, from the Saleor channel (`sk-eur`) rather than the market segment (`sk`). */
export function catalogLanguageForChannel(channel: string): string | null {
	return catalogLanguageForMarket(REVERSE_MAP[channel] ?? channel);
}
