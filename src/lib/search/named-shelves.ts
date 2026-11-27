import { searchWords, wordGrade } from "./words";

/**
 * The shelves a search NAMES, as opposed to the shelves it could be about.
 *
 * `category-shortcuts.ts` offers links, and is generous on purpose: "nosič" offers every shelf of
 * carriers. What is decided from a named shelf is not a link: its products are listed first, a car
 * beside it is read as "for this shelf, not for a roof rack", and the roof racks named alone offer
 * to choose a car. Read generously, that went wrong on the live shop the day it shipped
 * (2026-11-27): "strešný box" offered to choose a car for a roof rack, "strešný nosič" listed bike
 * carriers first, and "nosič Kuga" dropped the car and listed 541 carriers of every kind, because
 * "nosič" was read as the bike carriers ("cyklonosič").
 *
 * So a shelf is named only when the words hold one of its names WHOLE: every word of the name, as
 * the same word or the same stem ("strešný box" names "Strešné boxy"; "nosič" names nothing, and
 * neither does a part of a compound). Two words typed apart count as the compound they make
 * ("dach box" names "Dachbox").
 *
 * PURE, like the rest of what the search reads words with.
 */

export interface ShelfNames {
	/** Saleor base slug: the identity. */
	readonly slug: string;
	/** The menu's label, the address in this market, and the other words customers use. */
	readonly names: readonly string[];
}

/** The same word, or the same stem with another ending (`wordGrade` 0.9 and up). */
const SAME = 0.9;

/** The words of `asked` that make up `named`: one word, or two typed apart. Empty when none do. */
function metBy(asked: readonly string[], named: string): string[] {
	const same = asked.filter((word) => wordGrade(word, named) >= SAME);
	if (same.length > 0) return same;
	// Typed apart: "dach box" for "Dachbox", with the ending the compound may carry.
	for (let i = 0; i + 1 < asked.length; i++) {
		const joined = asked[i]! + asked[i + 1]!;
		if (named === joined || (named.startsWith(joined) && named.length - joined.length <= 2)) {
			return [asked[i]!, asked[i + 1]!];
		}
	}
	return [];
}

/** The words of `asked` that hold `name` whole; empty when a word of the name is missing. */
function wordsOfName(asked: readonly string[], name: string, language: string): string[] {
	const words = searchWords(name, language);
	if (words.length === 0) return [];
	const used: string[] = [];
	for (const named of words) {
		const met = metBy(asked, named);
		if (met.length === 0) return [];
		used.push(...met);
	}
	return used;
}

function namingWords(asked: readonly string[], shelf: ShelfNames, language: string): Set<string> {
	const used = new Set<string>();
	for (const name of shelf.names) for (const word of wordsOfName(asked, name, language)) used.add(word);
	return used;
}

/** Base slugs of the shelves `query` names, in the order they were given. */
export function namedShelves(query: string, language: string, shelves: readonly ShelfNames[]): string[] {
	const asked = searchWords(query, language);
	if (asked.length === 0) return [];
	return shelves.filter((shelf) => namingWords(asked, shelf, language).size > 0).map((shelf) => shelf.slug);
}

/**
 * The words by which `query` names `shelf` ("Dachträger" of "Dachträger Thule Golf"): what a search
 * of that shelf's own products may leave out, since the shelf is already the answer. Empty when the
 * query does not name it.
 */
export function wordsNaming(query: string, language: string, shelf: ShelfNames): string[] {
	return [...namingWords(searchWords(query, language), shelf, language)];
}
