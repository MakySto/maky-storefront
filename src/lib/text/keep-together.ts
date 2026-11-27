/**
 * Which parts of a product name must not be split across two lines.
 *
 * A browser may break a line after a hyphen and after a slash, so a long product name wrapped
 * inside a model designation: "Mazda CX-" at the end of one line and "60 KH" at the start of the
 * next, on the product page's main heading (audit of the live store, 2026-11-27). The same goes
 * for "T-Roc", "C-HR", "e-tron", "Pro-USER" and a tyre size such as "205/55".
 *
 * The text itself is not touched: no non-breaking hyphen and no invisible joiner goes into a name
 * that is copied, searched and read by crawlers. The name is cut into parts and the page wraps
 * the marked ones in an element that does not wrap (`KeepTogether`).
 *
 * Only SHORT tokens are kept whole. A long hyphenated compound ("Fahrradträger-Befestigungssatz")
 * is wider than a phone's line at heading size, and keeping it together would push it out of its
 * box; the hyphen is the right place to break it.
 */

/** Longest token that is kept on one line: "Pro-USER" is 8, "205/55" is 6, "e-tron" is 6. */
export const KEEP_TOGETHER_MAX_LENGTH = 12;

export interface TextPart {
	readonly text: string;
	/** True when the part is one token that a line break must not divide. */
	readonly keep: boolean;
}

/** A hyphen or slash with a letter or digit on both sides: the places a browser would break. */
const INNER_BREAK = /[\p{L}\p{N}][-/][\p{L}\p{N}]/u;

function isKeptToken(token: string): boolean {
	return token.length <= KEEP_TOGETHER_MAX_LENGTH && INNER_BREAK.test(token);
}

/**
 * Cuts `text` into parts that, joined, give `text` back exactly. Whitespace stays inside the
 * parts that may wrap, so the kept tokens never carry a leading or trailing space.
 */
export function keepTogetherParts(text: string): TextPart[] {
	const parts: TextPart[] = [];
	let loose = "";
	for (const piece of text.split(/(\s+)/)) {
		if (piece && isKeptToken(piece)) {
			if (loose) parts.push({ text: loose, keep: false });
			loose = "";
			parts.push({ text: piece, keep: true });
		} else {
			loose += piece;
		}
	}
	if (loose) parts.push({ text: loose, keep: false });
	return parts;
}
