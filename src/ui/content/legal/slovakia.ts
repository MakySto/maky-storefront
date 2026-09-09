/**
 * The seller's country, written in each legal language.
 *
 * A postal address is not translated — `Stará Vajnorská 11` is the same string in every
 * language, because that is what the Slovak post office reads. The country line is the
 * one exception: it is prose telling the reader which country the parcel goes to, and a
 * Polish reader should see `Słowacja`, not `Slovenská republika`.
 *
 * The shared address components in `kontakt.tsx` take this as an optional parameter with
 * a Slovak default, so adding a language here cannot change what Slovak or Czech renders.
 *
 * `SLOVAKIA_DE` lives in `german-market.tsx` instead, next to the rest of the German
 * market profile. These seven have no profile object — Polish, Hungarian, Italian, French,
 * Spanish, Romanian and English share nothing with each other beyond the company itself,
 * so a profile would be a layer with one inhabitant apiece.
 *
 * `SLOVAKIA_EN` serves both English markets, and that is not an oversight. The country is
 * called `Slovakia` in American and Canadian English alike; giving `us` and `ca` separate
 * constants holding the same seven letters would imply a difference that does not exist.
 * Where the two markets genuinely differ — tax identifiers, carriers, consumer statutes —
 * they have separate bodies saying separate things.
 */

export const SLOVAKIA_PL = "Słowacja";
export const SLOVAKIA_HU = "Szlovákia";
export const SLOVAKIA_IT = "Slovacchia";
export const SLOVAKIA_FR = "Slovaquie";
export const SLOVAKIA_ES = "Eslovaquia";
export const SLOVAKIA_RO = "Slovacia";
export const SLOVAKIA_EN = "Slovakia";
