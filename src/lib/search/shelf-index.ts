import { codeKey, codeKeys, fuzzyGrade, isNumberWord, searchWords, wordGrade } from "./words";

/**
 * The shop's own search over the products that are found by what they are called.
 *
 * ## Why the shop searches these itself (measured on the live shop, 2026-11-27)
 *
 * Saleor's `search` reads the base-language (Slovak) text only, name and description alike, and
 * has no order by relevance that this shop could use:
 *
 *   - abroad a word in the market's own language finds nothing: "Dachträger", "Fahrradträger",
 *     "Schneeketten", "střešní box", "bagażnik dachowy" all answered 0;
 *   - in Slovakia "strešný box" answered 22 642 products, a rubber profile first and roof-rack sets
 *     after it, because every set's description mentions a roof box.
 *
 * The catalogue has two very different halves. Some 28 600 products in Slovakia (22 300 abroad) are
 * roof-rack SETS, one per car, roof and bar: nobody finds those by typing, they are found by the
 * car (`vehicle-intent.ts` sends such a search to the car's page). Everything else, the roof boxes,
 * carriers, chains, fridges, bars, feet, kits and accessories, is under a thousand products per
 * market. That half is small enough to hold in memory in the market's own language and to rank
 * properly, and this module is that index.
 *
 * PURE: it is given documents and answers questions. Where the documents come from is
 * `shelf-source.ts`.
 *
 * ## How a product is ranked
 *
 * Every word asked for must be found in the product (in its name, its maker, its category, the
 * other words the trade uses for that category, a parameter, or as a code). Where it was found
 * decides the weight, how well it matched (`wordGrade`) scales it, and an accessory or spare part
 * ranks below the thing it belongs to: "strešný box" lists roof boxes, then the bags and covers
 * for one.
 *
 * When the words name a shelf ("strešný box", "Fahrradträger"), the caller passes that shelf and its
 * products come first: a bike carrier "na strešný nosič" also carries both words of "strešný
 * nosič", and it is not what was asked for.
 */

export interface ShelfDoc {
	/** Saleor product id. */
	readonly id: string;
	/** In the market's language. */
	readonly name: string;
	readonly brand?: string | null;
	/** Base slug of the product's own category. */
	readonly categorySlug?: string | null;
	/** Base slug of the top-level shelf the category stands on ("nosice-bicyklov"). */
	readonly rootCategorySlug?: string | null;
	/** The category's name and its ancestors', nearest first, in the market's language. */
	readonly categoryNames?: readonly string[];
	/** Other words for the category and its ancestors (`synonyms.ts`). */
	readonly synonyms?: readonly string[];
	/** Public codes: the variants' codes and the EAN. */
	readonly codes?: readonly string[];
	/** Short parameter values in the market's language ("čierny", "na ťažné zariadenie"). */
	readonly attributes?: readonly string[];
	/** An accessory or spare part of something else on the shelf. */
	readonly accessory?: boolean;
	readonly purchasable?: boolean;
	readonly price?: number | null;
	/** ISO date the product was created. */
	readonly created?: string | null;
}

export type ShelfMatchMode = "all" | "corrected" | "most";

export interface ShelfHit {
	readonly doc: ShelfDoc;
	readonly score: number;
}

export interface ShelfAnswer {
	readonly hits: readonly ShelfHit[];
	/**
	 * `all`: every word was found. `corrected`: only after a spelling mistake was forgiven.
	 * `most`: no product carries every word; these carry most of them.
	 */
	readonly mode: ShelfMatchMode;
}

interface Posting {
	readonly doc: number;
	readonly weight: number;
}

export interface ShelfIndex {
	readonly language: string;
	readonly docs: readonly ShelfDoc[];
	/** Word → the products that carry it, each with the heaviest place it stands in. */
	readonly words: ReadonlyMap<string, readonly Posting[]>;
	/** Code → the products it names. */
	readonly codes: ReadonlyMap<string, readonly number[]>;
}

const WEIGHT = {
	name: 10,
	/** Added for a word among the first three of the name: what a product IS comes first. */
	nameLead: 2,
	brand: 9,
	category: 6,
	parentCategory: 4,
	synonym: 5,
	attribute: 2,
	code: 40,
	codePrefix: 15,
} as const;

/** An accessory's score against the product it belongs to. */
const ACCESSORY_FACTOR = 0.7;
/** A product the market cannot buy right now ranks just below one it can. */
const UNAVAILABLE_FACTOR = 0.9;

export function buildShelfIndex(docs: readonly ShelfDoc[], language: string): ShelfIndex {
	const words = new Map<string, Posting[]>();
	const codes = new Map<string, number[]>();

	docs.forEach((doc, index) => {
		const heaviest = new Map<string, number>();
		const note = (word: string, weight: number) => {
			if ((heaviest.get(word) ?? 0) < weight) heaviest.set(word, weight);
		};

		searchWords(doc.name, language).forEach((word, position) =>
			note(word, WEIGHT.name + (position < 3 ? WEIGHT.nameLead : 0)),
		);
		for (const word of searchWords(doc.brand ?? "", language)) note(word, WEIGHT.brand);
		(doc.categoryNames ?? []).forEach((name, depth) => {
			for (const word of searchWords(name, language)) {
				note(word, depth === 0 ? WEIGHT.category : WEIGHT.parentCategory);
			}
		});
		for (const synonym of doc.synonyms ?? []) {
			for (const word of searchWords(synonym, language)) note(word, WEIGHT.synonym);
		}
		for (const value of doc.attributes ?? []) {
			for (const word of searchWords(value, language)) note(word, WEIGHT.attribute);
		}
		for (const [word, weight] of heaviest) {
			const list = words.get(word);
			if (list) list.push({ doc: index, weight });
			else words.set(word, [{ doc: index, weight }]);
		}

		// A code is what the label says (`N21041`, `PZ-859`), each part of a set's code, the EAN, and
		// the code-like pieces of the name (the "(N21041)" a kit carries in its title).
		const own = new Set<string>();
		for (const code of doc.codes ?? []) {
			for (const part of code.split(/[|+×]/)) {
				const key = codeKey(part);
				if (key.length >= 3) own.add(key);
			}
		}
		for (const key of codeKeys(doc.name)) own.add(key);
		for (const key of own) {
			const list = codes.get(key);
			if (list) list.push(index);
			else codes.set(key, [index]);
		}
	});

	return { language, docs, words, codes };
}

/** One blank-separated piece of what was typed: its words, and the code it may be. */
interface Piece {
	readonly words: readonly string[];
	readonly code: string | null;
}

function piecesOf(query: string, language: string): Piece[] {
	const pieces: Piece[] = [];
	for (const raw of query.trim().split(/\s+/)) {
		const words = searchWords(raw, language);
		const [code] = codeKeys(raw);
		if (words.length === 0 && !code) continue;
		pieces.push({ words, code: code ?? null });
	}
	return pieces;
}

type Grader = (asked: string, named: string) => number;

/** Per product, the best weighted grade each asked word reaches in it. */
function gradeWord(index: ShelfIndex, asked: string, grade: Grader): Map<number, number> {
	const best = new Map<number, number>();
	for (const [named, postings] of index.words) {
		const g = grade(asked, named);
		if (g <= 0) continue;
		for (const { doc, weight } of postings) {
			const value = g * weight;
			if ((best.get(doc) ?? 0) < value) best.set(doc, value);
		}
	}
	return best;
}

function gradeCode(index: ShelfIndex, code: string): Map<number, number> {
	const best = new Map<number, number>();
	for (const [key, docs] of index.codes) {
		const value =
			key === code ? WEIGHT.code : code.length >= 4 && key.startsWith(code) ? WEIGHT.codePrefix : 0;
		if (value === 0) continue;
		for (const doc of docs) if ((best.get(doc) ?? 0) < value) best.set(doc, value);
	}
	return best;
}

/** Per product, what each piece is worth in it: its words together, or the code it is. */
/** The joined word is the catalogue's word, give or take a plural: nothing looser, or "strešný box" is "strešných". */
function joinedGrade(joined: string, named: string): number {
	return named === joined || (named.startsWith(joined) && named.length - joined.length <= 2) ? 1 : 0;
}

function gradePieces(index: ShelfIndex, pieces: readonly Piece[], grade: Grader): Map<number, number>[] {
	const graded = gradeEachPiece(index, pieces, grade);
	// Two words typed apart that the catalogue writes as one: "dach box" is the "Dachbox", "auto
	// chladnička" the "autochladnička". The joined word counts for both, half each.
	for (let i = 0; i + 1 < pieces.length; i++) {
		const [left, right] = [pieces[i]!, pieces[i + 1]!];
		if (left.words.length !== 1 || right.words.length !== 1) continue;
		const [a, b] = [left.words[0]!, right.words[0]!];
		if (isNumberWord(a) || isNumberWord(b) || a.length < 3 || b.length < 3) continue;
		for (const [doc, value] of gradeWord(index, a + b, joinedGrade)) {
			for (const side of [graded[i]!, graded[i + 1]!]) {
				if ((side.get(doc) ?? 0) < value / 2) side.set(doc, value / 2);
			}
		}
	}
	return graded;
}

function gradeEachPiece(index: ShelfIndex, pieces: readonly Piece[], grade: Grader): Map<number, number>[] {
	return pieces.map((piece) => {
		const perWord = piece.words.map((word) => gradeWord(index, word, grade));
		const byWords = new Map<number, number>();
		if (perWord.length > 0) {
			// The piece is found where ALL its words are ("pz-859" is "pz" and "859").
			for (const [doc, value] of perWord[0]!) {
				let sum = value;
				for (let i = 1; i < perWord.length && sum > 0; i++) {
					const other = perWord[i]!.get(doc);
					sum = other === undefined ? 0 : sum + other;
				}
				if (sum > 0) byWords.set(doc, sum);
			}
		}
		if (!piece.code) return byWords;
		for (const [doc, value] of gradeCode(index, piece.code)) {
			if ((byWords.get(doc) ?? 0) < value) byWords.set(doc, value);
		}
		return byWords;
	});
}

function collect(
	index: ShelfIndex,
	graded: readonly Map<number, number>[],
	needed: number,
	preferRoots: ReadonlySet<string>,
): ShelfHit[] {
	const hits: ShelfHit[] = [];
	index.docs.forEach((doc, docIndex) => {
		let found = 0;
		let score = 0;
		for (const piece of graded) {
			const value = piece.get(docIndex);
			if (value !== undefined) {
				found += 1;
				score += value;
			}
		}
		if (found < needed) return;
		if (doc.accessory) score *= ACCESSORY_FACTOR;
		if (doc.purchasable === false) score *= UNAVAILABLE_FACTOR;
		hits.push({ doc, score });
	});
	const preferred = (doc: ShelfDoc) =>
		doc.rootCategorySlug && preferRoots.has(doc.rootCategorySlug) ? 0 : 1;
	return hits.sort(
		(a, b) =>
			preferred(a.doc) - preferred(b.doc) ||
			b.score - a.score ||
			Number(a.doc.accessory ?? false) - Number(b.doc.accessory ?? false) ||
			a.doc.name.localeCompare(b.doc.name, index.language, { numeric: true }),
	);
}

export interface ShelfSearchOptions {
	/**
	 * `exact` (the default): every word as typed. `closest`: with a spelling mistake forgiven, and
	 * failing that the products that carry most of the words. The caller asks for `closest` only when
	 * nothing else answered, and says so on the page: a guess is not presented as the answer.
	 */
	readonly match?: "exact" | "closest";
	/**
	 * Base slugs of the shelves the words name. Their products are listed first, and when only most
	 * of the words can be met, nothing from another shelf is offered.
	 */
	readonly preferRoots?: ReadonlySet<string>;
}

const NO_ROOTS: ReadonlySet<string> = new Set();

/** The products that answer `query`, best first. */
export function searchShelf(index: ShelfIndex, query: string, options: ShelfSearchOptions = {}): ShelfAnswer {
	const pieces = piecesOf(query, index.language);
	if (pieces.length === 0) return { hits: [], mode: "all" };
	const preferRoots = options.preferRoots ?? NO_ROOTS;

	if (options.match !== "closest") {
		const exact = gradePieces(index, pieces, wordGrade);
		return { hits: collect(index, exact, pieces.length, preferRoots), mode: "all" };
	}

	const forgiving: Grader = (asked, named) => wordGrade(asked, named) || fuzzyGrade(asked, named);
	const fuzzy = gradePieces(index, pieces, forgiving);
	const corrected = collect(index, fuzzy, pieces.length, preferRoots);
	if (corrected.length > 0) return { hits: corrected, mode: "corrected" };

	// Most of the words, and at least two of them: one word out of three is not "the closest".
	if (pieces.length >= 2) {
		const needed = Math.max(Math.ceil(pieces.length / 2), pieces.length >= 3 ? 2 : 1);
		let most = collect(index, fuzzy, needed, preferRoots);
		// The words name a shelf: only that shelf can be close to them. "střešní box" in a market
		// with no roof box is not answered with everything else that goes on a roof.
		if (preferRoots.size > 0) {
			most = most.filter((hit) => hit.doc.rootCategorySlug && preferRoots.has(hit.doc.rootCategorySlug));
		}
		if (most.length > 0) return { hits: most, mode: "most" };
	}
	return { hits: [], mode: "all" };
}

export type ShelfSort = "relevance" | "price-asc" | "price-desc" | "name" | "newest";

/** The hits in the order the shopper chose. Relevance is the order they arrived in. */
export function sortShelfHits(hits: readonly ShelfHit[], sort: ShelfSort, language: string): ShelfHit[] {
	const list = [...hits];
	const price = (hit: ShelfHit, missing: number) => hit.doc.price ?? missing;
	switch (sort) {
		case "price-asc":
			return list.sort((a, b) => price(a, Infinity) - price(b, Infinity));
		case "price-desc":
			return list.sort((a, b) => price(b, -Infinity) - price(a, -Infinity));
		case "name":
			return list.sort((a, b) => a.doc.name.localeCompare(b.doc.name, language, { numeric: true }));
		case "newest":
			return list.sort((a, b) => (b.doc.created ?? "").localeCompare(a.doc.created ?? ""));
		default:
			return list;
	}
}
