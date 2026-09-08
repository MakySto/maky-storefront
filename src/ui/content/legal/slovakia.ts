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
 * market profile. These two have no profile object — Polish and Hungarian share nothing
 * with each other beyond the company itself, so a profile would be a layer with one
 * inhabitant apiece.
 */

export const SLOVAKIA_PL = "Słowacja";
export const SLOVAKIA_HU = "Szlovákia";
