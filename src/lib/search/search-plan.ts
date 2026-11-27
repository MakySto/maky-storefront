import { foldedTokens } from "./words";

/**
 * The small decisions of a search that need no server: which page of which answer a link asks
 * for, and which words of the query belong to what. PURE, so they are tested without one.
 */

/** Results on a page, the same number the page always showed. */
export const SEARCH_PAGE_SIZE = 20;

/**
 * Which of Saleor's searches a later page continues. The first page decides between them by what
 * found something; a later page must ask the same one, and cannot decide again from a cursor.
 *
 *   full     the words as typed
 *   racks    the words without the roof racks' own name ("Dachträger Thule Golf" → "Thule Golf"):
 *            the sets are found by Slovak text, and every one of them is a roof rack
 *   vehicle  only the words that name the car ("Montagekit Golf" → "Golf")
 *   brand    the words with a misspelt maker corrected (`brand-typos.ts`)
 */
export type SaleorVariant = "full" | "racks" | "vehicle" | "brand";

export type SearchCursor =
	| { readonly kind: "start" }
	/** A page of the shop's own index, from this position. */
	| { readonly kind: "shelf"; readonly offset: number }
	| { readonly kind: "saleor"; readonly variant: SaleorVariant; readonly cursor: string };

const VARIANT_LETTER: Readonly<Record<SaleorVariant, string>> = {
	full: "f",
	racks: "r",
	vehicle: "v",
	brand: "b",
};
const LETTER_VARIANT: Readonly<Record<string, SaleorVariant>> = {
	f: "full",
	r: "racks",
	v: "vehicle",
	b: "brand",
};

export function shelfCursor(offset: number): string {
	return `shelf.${Math.max(0, Math.floor(offset))}`;
}

export function saleorCursor(variant: SaleorVariant, cursor: string): string {
	return `${VARIANT_LETTER[variant]}.${cursor}`;
}

/**
 * The `cursor` of the address, read back. Saleor's own cursors are base64 and hold no dot, so the
 * prefix cannot be mistaken; a bare one (a link from before this change) continues the words as typed.
 */
export function parseSearchCursor(raw: string | null | undefined): SearchCursor {
	if (!raw) return { kind: "start" };
	const shelf = /^shelf\.(\d{1,6})$/.exec(raw);
	if (shelf) return { kind: "shelf", offset: Number(shelf[1]) };
	const saleor = /^([frvb])\.(.+)$/.exec(raw);
	if (saleor) return { kind: "saleor", variant: LETTER_VARIANT[saleor[1]!]!, cursor: saleor[2]! };
	return { kind: "saleor", variant: "full", cursor: raw };
}

/**
 * A tyre size written inside a search ("reťaze 205/55 R16", "205 55 16", "2055516"), and the
 * search without it. Only the shape is read here; whether it is a size the shop knows is
 * `resolveTyreText`'s answer.
 */
export function findTyreText(query: string): { readonly text: string; readonly rest: string } | null {
	const match = /(?<![\d/])\d{3}\s*[/\s.-]?\s*\d{2}\s*(?:[/\s-]\s*)?(?:z?r)?\s*\d{2}(?![\d/])/i.exec(query);
	if (!match) return null;
	const rest = `${query.slice(0, match.index)} ${query.slice(match.index + match[0].length)}`
		.replace(/\s+/g, " ")
		.trim();
	return { text: match[0].trim(), rest };
}

function pieces(query: string): string[] {
	return query.trim().split(/\s+/).filter(Boolean);
}

/** Does every word of this typed piece belong to `words`? A piece with no word in it does not. */
function within(piece: string, words: ReadonlySet<string>, language: string): boolean {
	const tokens = foldedTokens(piece, language);
	return tokens.length > 0 && tokens.every((token) => words.has(token));
}

/** The query without the pieces that are wholly `words` ("nosič bicyklov octavia" without the car). */
export function withoutWords(query: string, words: ReadonlySet<string>, language: string): string {
	return pieces(query)
		.filter((piece) => !within(piece, words, language))
		.join(" ");
}

/** Only the pieces that are wholly `words`, as they were typed ("Montagekit Golf" → "Golf"). */
export function onlyWords(query: string, words: ReadonlySet<string>, language: string): string {
	return pieces(query)
		.filter((piece) => within(piece, words, language))
		.join(" ");
}
