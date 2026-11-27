/**
 * How the search reads text: what a word is, and when two words mean the same thing.
 *
 * PURE: no I/O and nothing of the server, so the index, the vehicle reader and their tests share
 * one definition. Both sides of every comparison go through `foldText`, the catalogue's words when
 * the index is built and the customer's when they ask, so a rule here can only ever make the two
 * meet more often, never apart.
 *
 * The comparison is graded, because "the same word" is not one thing:
 *
 *   1.00  the same letters                               box / box
 *   0.90  the same stem with another ending              boxy / box, Dachboxen / Dachbox, kol / kola
 *   0.70  the first part of a longer word                Fahrrad / Fahrradträger, wing / WingBar
 *   0.60  a later part of a compound                     Kühlbox / Autokühlboxen, chladnička / autochladnička
 *   0.45  one or two letters wrong (asked for apart)     tule / thule, octvia / octavia
 *
 * A number is never graded: 30 is not 300, and 2019 is not 2018.
 */

/** Words that say nothing about what is wanted, in every language the shop speaks. */
const STOP_WORDS: ReadonlySet<string> = new Set(
	(
		"a aj i na pre pri do od ku ke k s so z zo ze v vo pro u o " +
		"fur fuer furs fuers mit und von fuers im am an auf der die das den dem ein eine " +
		"for the and with of to in on " +
		"dla do na i z ze w od " +
		"per di da il la le lo un una e con su " +
		"pour de du des et avec sur le la les un une au aux " +
		"para de del el la los las y con en un una " +
		"pentru de la si cu pe din un o " +
		"es a az egy hoz " +
		"ks pcs stk szt db"
	).split(" "),
);

/** Units that follow a number and are not themselves asked for: `30 l`, `127 cm`. */
const UNITS: ReadonlySet<string> = new Set(["l", "cm", "mm", "m", "kg", "g", "w", "v", "ah"]);

export function isGermanic(language: string): boolean {
	return language.toLowerCase().startsWith("de");
}

/**
 * Lower case, no diacritics. German also folds the written-out umlauts (`kuehlboxen` is how the
 * address spells "Kühlboxen", and how a customer without the key types it), so both spellings meet.
 */
export function foldText(text: string, language: string): string {
	let folded = text
		.toLowerCase()
		.replace(/ß/g, "ss")
		.replace(/ł/g, "l")
		.replace(/đ/g, "d")
		.replace(/ø/g, "o")
		.replace(/æ/g, "ae")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "");
	if (isGermanic(language)) {
		folded = folded.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
	}
	return folded;
}

/** Every run of letters and digits, folded: nothing dropped, unlike `searchWords`. */
export function foldedTokens(text: string, language: string): string[] {
	return foldText(text, language)
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

const IS_NUMBER = /^\d+$/;
const HAS_DIGIT = /\d/;

export function isNumberWord(word: string): boolean {
	return IS_NUMBER.test(word);
}

/**
 * The words of a text, in order: runs of letters and digits, without the words that say nothing.
 *
 * `30l` and `127cm` are a number and its unit, so they are read as the number. A single letter is
 * no word (the `l` of `400 l`); a single digit is (`2 bicykle`).
 */
export function searchWords(text: string, language: string): string[] {
	const out: string[] = [];
	for (const run of foldText(text, language).split(/[^a-z0-9]+/)) {
		if (!run) continue;
		const measured = /^(\d+)([a-z]{1,2})$/.exec(run);
		if (measured && UNITS.has(measured[2]!)) {
			out.push(measured[1]!);
			continue;
		}
		if (STOP_WORDS.has(run) || UNITS.has(run)) continue;
		if (run.length === 1 && !IS_NUMBER.test(run)) continue;
		out.push(run);
	}
	return out;
}

/**
 * A product code as it is compared: letters and digits only, lower case (`PZ-859` → `pz859`,
 * `g329.14` → `g32914`, `CX-5` → `cx5`). Empty when the text holds no digit: a code has one.
 */
export function codeKey(text: string): string {
	const key = text.toLowerCase().replace(/[^a-z0-9]+/g, "");
	return /\d/.test(key) ? key : "";
}

/** The code-like pieces of what was typed: each blank-separated piece that holds a digit. */
export function codeKeys(text: string): string[] {
	const out = new Set<string>();
	for (const piece of text.trim().split(/\s+/)) {
		const key = codeKey(piece.replace(/^[([{]+|[)\]},.;:]+$/g, ""));
		if (key.length >= 3) out.add(key);
	}
	return [...out];
}

function commonPrefix(a: string, b: string): number {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
	return i;
}

const BARE_ENDINGS: ReadonlySet<string> = new Set(["n", "s", "m", "x", "ch", "k", "t"]);

/** The same stem with another ending: boxy / box, dachowy / dachowe, Dachbox / Dachboxen. */
function sameStem(a: string, b: string): boolean {
	const shorter = Math.min(a.length, b.length);
	if (shorter < 3 || Math.abs(a.length - b.length) > 3) return false;
	const shared = commonPrefix(a, b);
	// Short words keep all but their last letter (kol / kola, box / boxy); long ones may lose two
	// (nosiče / nosičov, Fahrradträger / Fahrradträgern), and the endings left over stay short.
	const need = shorter <= 4 ? Math.max(3, shorter - 1) : shorter - 2;
	if (shared < need || Math.max(a.length, b.length) - shared > 3) return false;
	// One word is the other plus a tail: an ending has a vowel in it (kol / kola, Box / Boxen) or is
	// one of the few bare consonants languages inflect with. "stan" is not "stand".
	if (shared === shorter) {
		const tail = (a.length > b.length ? a : b).slice(shared);
		// A short word with three letters more is another word: "Dach" is not "Dachbox".
		if (shorter <= 4 && tail.length > 2) return false;
		return /[aeiouy]/.test(tail) || BARE_ENDINGS.has(tail);
	}
	return true;
}

/**
 * How well the word the customer typed stands for a word of the catalogue: 0 (not at all) to 1.
 * Spelling mistakes are not forgiven here; `fuzzyGrade` does that, and only when asked.
 */
export function wordGrade(asked: string, named: string): number {
	if (asked === named) return 1;
	// A number, or a word with a digit in it (FG2, N21041), is itself or nothing: FG2 is not FG3.
	if (HAS_DIGIT.test(asked) || HAS_DIGIT.test(named)) return 0;
	if (sameStem(asked, named)) return 0.9;
	if (asked.length >= 3 && named.startsWith(asked)) return 0.7;
	if (asked.length >= 5) {
		// By its stem, so that the ending the customer typed need not be the compound's.
		const stem = asked.slice(0, Math.max(5, asked.length - 2));
		if (named.includes(stem)) return 0.6;
	}
	return 0;
}

/** Optimal-string-alignment distance, cut off once it passes `limit`. */
function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	let prevPrev: number[] = [];
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		let best = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let value = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, prevPrev[j - 2]! + 1);
			}
			row.push(value);
			if (value < best) best = value;
		}
		if (best > limit) return limit + 1;
		prevPrev = prev;
		prev = row;
	}
	return prev[b.length]!;
}

/**
 * The grade of a misspelt word: one letter wrong in a word of four to seven, two in a longer one.
 * Shorter words are one letter from too much, and a number is never a misspelling of another.
 */
export function fuzzyGrade(asked: string, named: string): number {
	if (asked.length < 4 || HAS_DIGIT.test(asked) || HAS_DIGIT.test(named)) return 0;
	const limit = asked.length <= 7 ? 1 : 2;
	return editDistance(asked, named, limit) <= limit ? 0.45 : 0;
}
