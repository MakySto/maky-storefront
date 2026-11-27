/**
 * The year and the roof a vehicle page is narrowed to, carried in its ADDRESS.
 *
 * `/sk/stresne-nosice/ford/kuga/dfk?year=2024&roof=flush-rails` shows the sets of that generation
 * made for 2024 and for flush rails, to whoever opens it: the address is the whole state, so it can
 * be saved, sent to somebody and opened in another browser (owner, 2026-11-27). Nothing here reads
 * the visitor's garage. The page without parameters stays what it was and stays the canonical one;
 * the parameters only choose which of its sets are shown.
 *
 * This narrows a LIST. It is not the resolver's verdict on anybody's car: the facts it reads are the
 * application's own window and roof, the same two a card prints, and the comparison of the window is
 * the resolver's (`matchWindow`), so a year the selector offered a roof for is a year this view has
 * sets for.
 *
 * Pure and free of `server-only`: the page, the selector's destination and the tests share it.
 */

import { ROOF_TYPES, matchWindow, type FitmentApplication, type RoofType } from "./contract";

export type VehicleView = { year: number | null; roof: RoofType | null };

/** What a page parameter can arrive as (`searchParams`). */
export type ViewSearch = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The production years of the generation the page is about. */
export type ProductionSpan = { from?: number | null; to?: number | null };

const first = (value: string | readonly string[] | undefined): string | undefined =>
	typeof value === "string" ? value : value?.[0];

/** The last year a generation still in production is asked about: next year, as in the selector. */
export function lastYearOf(span: ProductionSpan, currentYear: number): number {
	return span.to ?? currentYear + 1;
}

/**
 * Read `?year=` and `?roof=`. Anything that is not a year of this generation, or not a roof type the
 * dataset knows, is dropped without a word: a mistyped address shows the whole page, never an error
 * and never an empty list for a year the car was not built in.
 */
export function parseVehicleView(search: ViewSearch, span: ProductionSpan, currentYear: number): VehicleView {
	const rawYear = first(search.year);
	const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
	const rawRoof = first(search.roof);
	const inSpan =
		year !== null && (span.from == null || year >= span.from) && year <= lastYearOf(span, currentYear);
	return {
		year: inSpan ? year : null,
		roof: (ROOF_TYPES as readonly string[]).includes(rawRoof ?? "") ? (rawRoof as RoofType) : null,
	};
}

/** The query string of a view, `year` first: "" for the whole page. */
export function vehicleViewQuery(view: VehicleView): string {
	const params = new URLSearchParams();
	if (view.year !== null) params.set("year", String(view.year));
	if (view.roof !== null) params.set("roof", view.roof);
	const query = params.toString();
	return query ? `?${query}` : "";
}

/**
 * The applications a year leaves: every row whose window the year is not outside of. A boundary year
 * whose month decides stays in, as it does in the selector's roof question (`roofChoicesOnOffer`):
 * that set is still shown, and its page says which month it starts in.
 *
 * A negative row is kept whatever its window. It names no set of its own, and what it says about a
 * product is the resolver's business on the product page.
 */
export function applicationsForYear<T extends Pick<FitmentApplication, "window" | "negative">>(
	applications: readonly T[],
	year: number | null,
): T[] {
	if (year === null) return [...applications];
	return applications.filter(
		(application) => application.negative || matchWindow(application.window, year) !== "out",
	);
}

/**
 * The years the page offers to narrow to, newest first: the years of the generation in which at
 * least one of its positive applications is on offer. A year with nothing is not offered, so the
 * control cannot lead to an empty list by itself.
 */
export function yearsOnOffer(
	applications: readonly Pick<FitmentApplication, "window" | "negative">[],
	span: ProductionSpan,
	currentYear: number,
): number[] {
	const positive = applications.filter((application) => !application.negative);
	if (positive.length === 0) return [];
	const from = span.from ?? Math.min(...positive.map((application) => application.window.from.year));
	const years: number[] = [];
	for (let year = lastYearOf(span, currentYear); year >= from; year -= 1) {
		if (positive.some((application) => matchWindow(application.window, year) !== "out")) years.push(year);
	}
	return years;
}
