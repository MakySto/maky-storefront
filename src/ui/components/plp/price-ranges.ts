/**
 * The price filter's bands, from the prices a listing actually holds.
 *
 * The filter used to offer four fixed bands, "Under $50", "$50 - $100", "$100 - $200" and
 * "$200+" — English, in dollars, on every market, and useless for roof boxes, most of which
 * cost more than all four bands put together. The bands are now cut where this listing's own
 * prices fall, rounded to numbers a person would pick, and named in the market's language and
 * currency. The URL keeps its old shape, `?price=<min>-<max>` in the channel's currency, which
 * `buildFilterVariables` sends to Saleor as a gross range — the amounts shown on the cards.
 */

export interface PriceRangeOption {
	/** `?price=` value: `0-50`, `50-200`, `500-` (open-ended). */
	readonly value: string;
	readonly label: string;
}

export interface PriceFilter {
	readonly currency: string;
	readonly ranges: readonly PriceRangeOption[];
}

/** Four bands: enough to be useful, few enough to read at a glance. */
const BANDS = 4;
/** Below this many priced products a price filter is noise. */
const MIN_PRICED = 8;

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10] as const;

/**
 * The nearest "round" amount — 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5 or 8 times a power of ten, and
 * a whole number below ten ("Do 8 €", not "Do 7,5 €").
 */
export function niceRound(amount: number): number {
	if (!(amount > 0)) return 0;
	const scale = 10 ** Math.floor(Math.log10(amount));
	const step = NICE_STEPS.reduce((best, candidate) =>
		Math.abs(candidate * scale - amount) < Math.abs(best * scale - amount) ? candidate : best,
	);
	const nice = Number((step * scale).toPrecision(6));
	return nice < 10 ? Math.max(1, Math.round(nice)) : nice;
}

/** Round, strictly increasing and strictly inside (lowest, highest) — or nothing. */
function usable(candidates: readonly number[], lowest: number, highest: number): number[] {
	const boundaries: number[] = [];
	for (const candidate of candidates.map(niceRound)) {
		if (candidate > lowest && candidate < highest && candidate > (boundaries.at(-1) ?? 0)) {
			boundaries.push(candidate);
		}
	}
	return boundaries;
}

/** Cut points at the quartiles of the prices a listing holds. */
export function priceBoundaries(prices: readonly number[]): number[] {
	const sorted = prices.filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
	if (sorted.length < MIN_PRICED) return [];
	const quartiles = Array.from(
		{ length: BANDS - 1 },
		(_, k) => sorted[Math.floor(((k + 1) * sorted.length) / BANDS)]!,
	);
	return usable(quartiles, sorted[0]!, sorted.at(-1)!);
}

/**
 * Cut points spread geometrically between the cheapest and the dearest product — for a listing
 * too large to read every price of (the 9 157 roof-rack sets).
 */
export function spanBoundaries(lowest: number, highest: number): number[] {
	if (!(lowest > 0) || !(highest > lowest)) return [];
	const ratio = highest / lowest;
	const points = Array.from({ length: BANDS - 1 }, (_, k) => lowest * ratio ** ((k + 1) / BANDS));
	return usable(points, lowest, highest);
}

export interface PriceRangeWords {
	under: (max: string) => string;
	between: (min: string, max: string) => string;
	over: (min: string) => string;
}

export function parsePriceRange(value: string): { min: number; max: number | null } | null {
	const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)?$/.exec(value);
	if (!match) return null;
	return { min: Number(match[1]), max: match[2] === undefined ? null : Number(match[2]) };
}

/** "Do 50 €", "50 € – 200 €", "Od 500 €" — for any `?price=` value, offered or typed. */
export function priceRangeLabel(
	value: string,
	format: (amount: number) => string,
	words: PriceRangeWords,
): string {
	const range = parsePriceRange(value);
	if (!range) return value;
	if (range.max === null) return words.over(format(range.min));
	if (range.min === 0) return words.under(format(range.max));
	return words.between(format(range.min), format(range.max));
}

export function priceRangeOptions(
	boundaries: readonly number[],
	format: (amount: number) => string,
	words: PriceRangeWords,
): PriceRangeOption[] {
	if (boundaries.length === 0) return [];
	const values = [
		`0-${boundaries[0]}`,
		...boundaries.slice(1).map((boundary, i) => `${boundaries[i]}-${boundary}`),
		`${boundaries.at(-1)}-`,
	];
	return values.map((value) => ({ value, label: priceRangeLabel(value, format, words) }));
}

/** Whole amounts in the market's currency: a band edge has no cents. */
export function priceBandFormatter(locale: string, currency: string): (amount: number) => string {
	const format = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
	return (amount) => format.format(amount);
}
