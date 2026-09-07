import { REVERSE_MAP } from "@/lib/channel-map";

/**
 * Which language a market's legal pages are written in.
 *
 * This is NOT `CHANNEL_MAP[...].locale`, and the difference is deliberate. That field
 * says which message catalogue the UI chrome loads; this one says which reviewed legal
 * text a market has. A market can perfectly well have a UI translation and no approved
 * legal copy — every market except SK and CZ is in exactly that position today — and
 * serving it a machine-translated warranty clause because a locale string existed would
 * be worse than serving it nothing.
 *
 * So the map is opt-in, listing only markets whose copy a human has approved. Anything
 * absent gets `null`, and the routes turn that into `notFound()`.
 *
 * Adding a market here is a legal decision, not a translation one: the body has to say
 * true things about THAT market's currency, carriers and dispute bodies, not just be
 * written in its language.
 */
export const LEGAL_LOCALES = ["sk", "cs"] as const;

export type LegalLocale = (typeof LEGAL_LOCALES)[number];

/** Friendly market slug → the approved legal language for it. */
const APPROVED_COPY: Readonly<Record<string, LegalLocale>> = {
	sk: "sk",
	cz: "cs",
};

/**
 * The legal language for a Saleor channel, or `null` when that market has none.
 *
 * Takes the Saleor slug (`sk-eur`), because that is what the route params carry.
 */
export function legalLocaleFor(channel: string): LegalLocale | null {
	const market = REVERSE_MAP[channel];
	return market ? APPROVED_COPY[market] ?? null : null;
}

/** Markets with approved legal copy, as friendly slugs. For tests and sitemaps. */
export function marketsWithLegalCopy(): readonly string[] {
	return Object.keys(APPROVED_COPY);
}
