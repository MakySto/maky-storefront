/**
 * A misspelt maker, corrected — only for a search that found nothing.
 *
 * Checked on production 2026-09-26: "tule" and "jakima" found nothing while "thule" and "yakima"
 * found 58 and 8 products; diacritics and word stems were already handled by Saleor ("stresny" =
 * "strešný", "nordriv" = 177). Real searches are few — 27 from people in two weeks of logs — so
 * this is deliberately small: the makers the shop sells, typed as one word, no search engine.
 *
 * Only the words that are close to a maker change; everything else is kept exactly as typed.
 * The caller runs this only after an empty answer, and shows the shopper that it did.
 */

/** From `HOMEPAGE_BRAND_SLUGS`: the one-word makers long enough to correct safely. */
const BRANDS = ["thule", "yakima", "menabo", "nordrive", "peruzzo", "spinder", "snowdrive"] as const;
const IS_BRAND: ReadonlySet<string> = new Set(BRANDS);

const fold = (word: string) =>
	word
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

/** Optimal-string-alignment distance: insertions, deletions, substitutions and one swap of neighbours. */
function distance(a: string, b: string): number {
	const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
		Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	);
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			}
		}
	}
	return d[a.length][b.length];
}

/** The query with misspelt makers corrected, or `null` when no word is a near-miss of one. */
export function correctBrandTypos(query: string): string | null {
	let changed = false;
	const words = query
		.trim()
		.split(/\s+/)
		.map((word) => {
			const folded = fold(word);
			// Four letters and up: "tule" is one edit from "thule", but shorter words are
			// one edit from too much.
			if (folded.length < 4 || IS_BRAND.has(folded)) return word;
			const limit = folded.length <= 5 ? 1 : 2;
			let best: string | null = null;
			let bestDistance = limit + 1;
			for (const brand of BRANDS) {
				const d = distance(folded, brand);
				if (d < bestDistance) {
					best = brand;
					bestDistance = d;
				}
			}
			if (!best) return word;
			changed = true;
			return best;
		});
	return changed ? words.join(" ") : null;
}
