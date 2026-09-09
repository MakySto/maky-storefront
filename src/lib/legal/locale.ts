import { REVERSE_MAP } from "@/lib/channel-map";

/**
 * Which language a market's legal pages are written in.
 *
 * This is NOT `CHANNEL_MAP[...].locale`, and the difference is deliberate. That field
 * says which message catalogue the UI chrome loads; this one says which reviewed legal
 * text a market has. A market can perfectly well have a UI translation and no approved
 * legal copy — most markets are in exactly that position today — and serving it a
 * machine-translated warranty clause because a locale string existed would be worse
 * than serving it nothing.
 *
 * So the map is opt-in, listing only markets whose copy a human has approved. Anything
 * absent gets `null`, and the routes turn that into `notFound()`.
 *
 * Adding a market here is a legal decision, not a translation one: the body has to say
 * true things about THAT market's currency, carriers and dispute bodies, not just be
 * written in its language.
 *
 * ## Why `de` and `deAt` are two entries and not one
 *
 * They are the same language. They are not the same legal text, and the entries here
 * are legal texts. Germany and Austria transposed the same directives at different
 * dates and under different names — a withdrawal is a *Widerruf* in Germany and a
 * *Rücktritt* in Austria, cookie consent runs off § 25 TDDDG in one and § 165(3)
 * TKG 2021 in the other, and the supervisory authority differs. Folding both into a
 * single `de` entry and branching inside the bodies on `channel` would put those
 * differences somewhere no type and no test can see them. Two entries make each
 * difference a value the compiler tracks and `legal-route.test.ts` enforces.
 *
 * The customer-facing locales are untouched: `CHANNEL_MAP` still says `de-DE` and
 * `de-AT`. This name is internal.
 *
 * ## Why `enUs` and `enCa` are two entries for the same reason
 *
 * The same argument, in English. Most of the delivered US and Canadian prose is word for
 * word identical — the seller, the carriers, the customs undertaking, the 14/30-day
 * benefit — and that is fine. What differs is law, and it differs in both directions: the
 * FTC Mail, Internet, or Telephone Order Merchandise Rule and its 30-day default shipment
 * period bind us in one country and not the other; the FTC three-day Cooling-Off Rule does
 * NOT reach purchases made entirely online, which is a sentence the US page must carry and
 * the Canadian page must not; and Canada's mandatory provincial and territorial rights,
 * including Quebec's reasonable-durability rule and its statutory distance-contract
 * cancellation, have no US counterpart. Currency differs too — USD one side, CAD the other.
 *
 * One `en` entry branching on `channel` inside the bodies would put all of that somewhere
 * no type and no test can see it. Two entries make each difference a value the compiler
 * tracks, exactly as for Germany and Austria.
 */
export const LEGAL_LOCALES = [
	"sk",
	"cs",
	"de",
	"deAt",
	"pl",
	"hu",
	"it",
	"fr",
	"es",
	"ro",
	"enUs",
	"enCa",
] as const;

export type LegalLocale = (typeof LEGAL_LOCALES)[number];

/** Friendly market slug → the approved legal language for it. */
const APPROVED_COPY: Readonly<Record<string, LegalLocale>> = {
	sk: "sk",
	cz: "cs",
	de: "de",
	at: "deAt",
	pl: "pl",
	hu: "hu",
	it: "it",
	fr: "fr",
	es: "es",
	ro: "ro",
	us: "enUs",
	ca: "enCa",
};

/**
 * The exported body name for each legal language, e.g. `deAt` → `DeAt`.
 *
 * Kept next to the list rather than derived at the call site, because the derivation
 * is not the obvious one: `deAt` capitalises to `DeAt`, not `Deat`. `legal-route.test.ts`
 * reads this to know which export to demand from every content module.
 */
export const LEGAL_BODY_NAMES: Readonly<Record<LegalLocale, string>> = {
	sk: "Sk",
	cs: "Cs",
	de: "De",
	deAt: "DeAt",
	pl: "Pl",
	hu: "Hu",
	it: "It",
	fr: "Fr",
	es: "Es",
	ro: "Ro",
	enUs: "Us",
	enCa: "Ca",
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
