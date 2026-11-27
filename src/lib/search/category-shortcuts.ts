/**
 * Category shortcuts for a search: "Dachbox" should offer the roof-box shelf.
 *
 * Why this exists (audit of the live store, 2026-11-27). The search asks Saleor, and Saleor's
 * `search` reads the base-language (Slovak) product text only. Abroad a customer who types what
 * they want in their own language gets nothing: "Dachträger", "Dachbox", "Fahrradträger",
 * "střešní box", "bagażnik dachowy", "barre portatutto", "barres de toit", "roof rack" all
 * answered 0 results, in a shop whose menu sells exactly those. In Slovakia the same words
 * answer with twenty thousand results in no useful order ("strešný box": 22 642, a rubber
 * profile first). In both cases the shelf the customer named is one click away and the page did
 * not say so.
 *
 * So the search page also compares the words with the names of the shelves this market links
 * from its menu, and offers the ones that fit above the results, or in place of "nothing found".
 * This is a signpost, not a search: it knows the menu's shelves and nothing else, and it does not
 * change what Saleor is asked or answers.
 *
 * Matching is by word, tolerant of the endings a customer does not type the way the menu does
 * (Dachbox / Dachboxen, strešný box / Strešné boxy, bagażnik dachowy / Bagażniki dachowe) and of
 * missing diacritics. A shelf is offered when
 *
 *   - every word of one of its names is among the words asked for ("Dachträger Golf" names the
 *     roof racks, "nosič na bicykle" the bike carriers), or
 *   - every word asked for belongs to one of its names ("box", "nosič", "Träger": the customer
 *     named a kind of thing, and each shelf of that kind is offered).
 *
 * A shelf has two names: its label in the menu and its address in this market
 * (`barre-portatutto` beside the label "Portapacchi da tetto"), which is the other word the
 * trade uses for it and costs nothing to know.
 */

export interface ShortcutCandidate {
	/** Saleor base slug: the identity. */
	readonly slug: string;
	/** The shelf's name in the menu, in the market's language. */
	readonly label: string;
	/** Other names: the localized URL segment, hyphens and all. */
	readonly aliases?: readonly string[];
}

/** Words that say nothing about which shelf is meant. */
const STOP_WORDS: ReadonlySet<string> = new Set([
	"fur",
	"fuer",
	"furs",
	"fuers",
	"pour",
	"para",
	"per",
	"for",
	"pre",
	"pro",
	"dla",
	"und",
	"and",
	"von",
	"the",
	"auto",
	"autos",
	"car",
	"cars",
	"coche",
	"voiture",
]);

/** At most this many shelves are offered above the results. */
export const MAX_CATEGORY_SHORTCUTS = 4;

/**
 * Lower case, no diacritics, words only. German also folds the written-out umlauts
 * (`kuehlboxen` is the address of "Kühlboxen"), so both spellings meet.
 */
export function shortcutWords(text: string, locale: string): string[] {
	let folded = text
		.toLowerCase()
		.replace(/ß/g, "ss")
		.replace(/ł/g, "l")
		.replace(/đ/g, "d")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "");
	if (locale.toLowerCase().startsWith("de")) {
		folded = folded.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
	}
	return folded
		.split(/[^a-z0-9]+/)
		.filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function commonPrefix(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
	return i;
}

/** Does the word the customer typed mean the word in the shelf's name? */
export function sameWord(asked: string, named: string): boolean {
	if (asked === named) return true;
	const shorter = Math.min(asked.length, named.length);
	// The same stem with another ending: boxy / box, dachowy / dachowe, Dachbox / Dachboxen.
	if (Math.abs(asked.length - named.length) <= 3 && commonPrefix(asked, named) >= Math.max(3, shorter - 2)) {
		return true;
	}
	// The first part of a compound: Dach / Dachträger, ski / Skiträger, Fahrrad / Fahrradträger.
	if (named.startsWith(asked)) return true;
	// A later part of a compound, by its stem: Kühlbox / Autokühlboxen, chladnička / Autochladničky.
	return asked.length >= 5 && named.includes(asked.slice(0, Math.max(5, asked.length - 2)));
}

/**
 * The shelves the query names, best first: those whose whole name was asked for, then those the
 * query is a part of, each group in the order it was given (the menu's).
 */
export function matchCategoryShortcuts<T extends ShortcutCandidate>(
	query: string,
	candidates: readonly T[],
	locale: string,
): T[] {
	const asked = shortcutWords(query, locale);
	if (asked.length === 0) return [];

	const whole: T[] = [];
	const part: T[] = [];
	for (const candidate of candidates) {
		const names = [candidate.label, ...(candidate.aliases ?? [])]
			.map((name) => shortcutWords(name, locale))
			.filter((words) => words.length > 0);
		if (names.some((words) => words.every((named) => asked.some((word) => sameWord(word, named))))) {
			whole.push(candidate);
		} else if (names.some((words) => asked.every((word) => words.some((named) => sameWord(word, named))))) {
			part.push(candidate);
		}
	}
	return [...whole, ...part].slice(0, MAX_CATEGORY_SHORTCUTS);
}
