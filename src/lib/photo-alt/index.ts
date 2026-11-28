import "server-only";

import dictionary from "./data/photo_alt_dictionary.json";

/**
 * Alt text of a gallery photo in a foreign market.
 *
 * Saleor holds one alt per medium and CFM writes it in Slovak as `name – tail` (the tail is the photo's
 * description, its type, or `fotka N`). A foreign route never shows Slovak, so it cannot use that alt as it is.
 * CFM ships a dictionary (`maky-photo-alt-dictionary/1`, `data/photo_alt_dictionary.json`) that maps every Slovak
 * tail it writes to the tail in each of 9 languages, and this module builds the alt from it:
 *
 *   1. the first photo (`index === 0`) is the translated product name, as before;
 *   2. otherwise the tail is the text after the last separator of the Slovak alt; when the dictionary knows it, the
 *      alt is `translated name – translated tail`;
 *   3. `fotka N` becomes `<photo word> N`, and `<tail> N` with a known tail becomes `<translated tail> N`;
 *   4. anything else (a hand-written alt, an annotation, an empty alt, a tail that is not in the dictionary)
 *      becomes `translated name – <photo word> <position>`. The Slovak text is never read as content.
 *
 * The language is the first part of the market code (`de-AT` and `DE_AT` read `de`, `en-CA` reads `en`): the market
 * is not the language. A language that is not in the dictionary gets no alt (`null`), which is what the shop did
 * before.
 *
 * The pattern is CFM's `localize_alt` (`backend/apps/saleor_sync/maky_alt_foreign.py`); keep the two the same.
 * Server-only: the dictionary is 446 KB and no client component may import it. A newer dictionary is copied in
 * the same way as the tyre-size lists (see `data/PROVENANCE.json`).
 */

type LanguageEntry = { photo_word: string; tails: Record<string, string> };

const LANGUAGES = dictionary.languages as Record<string, LanguageEntry>;
const SEPARATOR = dictionary.separator;
const SOURCE_PHOTO_WORD = dictionary.source_photo_word;
const NUMBERED = /^(.+) ([0-9]+)$/;

function known(tails: Record<string, string>, key: string): string | undefined {
	// Own keys only: a tail called "constructor" must not find a function on the prototype.
	return Object.hasOwn(tails, key) ? tails[key] : undefined;
}

function languageOf(locale: string): LanguageEntry | undefined {
	const code = locale.split(/[-_]/)[0]?.toLowerCase() ?? "";
	return Object.hasOwn(LANGUAGES, code) ? LANGUAGES[code] : undefined;
}

function localizedTail(tail: string, language: LanguageEntry): string | undefined {
	const direct = known(language.tails, tail);
	if (direct !== undefined) return direct;
	const numbered = NUMBERED.exec(tail);
	if (!numbered) return undefined;
	const [, base, n] = numbered;
	if (base === SOURCE_PHOTO_WORD) return `${language.photo_word} ${n}`;
	const translated = known(language.tails, base);
	return translated !== undefined ? `${translated} ${n}` : undefined;
}

/**
 * @param alt        the Slovak alt Saleor holds for this medium (read only for its tail)
 * @param localName  the product's translated name
 * @param index      position in the gallery, 0 is the main photo
 * @param locale     the market's locale (`de-AT`, `en-CA`, `DE_AT`, …)
 */
export function localizedPhotoAlt(
	alt: string | null | undefined,
	localName: string,
	index: number,
	locale: string,
): string | null {
	if (index === 0) return localName;
	const language = languageOf(locale);
	if (!language) return null;
	const source = alt ?? "";
	const cut = source.lastIndexOf(SEPARATOR);
	const tail = cut >= 0 ? source.slice(cut + SEPARATOR.length) : null;
	const local =
		(tail !== null ? localizedTail(tail, language) : undefined) ?? `${language.photo_word} ${index + 1}`;
	return `${localName}${SEPARATOR}${local}`;
}
