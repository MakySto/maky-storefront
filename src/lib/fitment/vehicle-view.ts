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

/** The orders a vehicle page can be read in, named as the category listing names them (`?sort=`). */
export const VIEW_SORTS = ["price_asc", "price_desc"] as const;
export type ViewSort = (typeof VIEW_SORTS)[number];

export type VehicleView = {
	year: number | null;
	roof: RoofType | null;
	/** The maker the list is narrowed to, as `brandKey` spells it. Absent and null are the same: every maker. */
	brand?: string | null;
	/** Absent and null are the same: the page's own order. */
	sort?: ViewSort | null;
};

/** What a page parameter can arrive as (`searchParams`). */
export type ViewSearch = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The production years of the generation the page is about. */
export type ProductionSpan = { from?: number | null; to?: number | null };

const first = (value: string | readonly string[] | undefined): string | undefined =>
	typeof value === "string" ? value : value?.[0];

/**
 * A maker's name as the address spells it: "Green Valley" is `green-valley`, "Pro-USER" is
 * `pro-user`. Made from the name the catalogue gives the set, so a maker needs no table here.
 */
export function brandKey(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const BRAND_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The last year a generation still in production is asked about: next year, as in the selector. */
export function lastYearOf(span: ProductionSpan, currentYear: number): number {
	return span.to ?? currentYear + 1;
}

/**
 * Read `?year=`, `?roof=`, `?brand=` and `?sort=`. Anything that is not a year of this generation, not a
 * roof type the dataset knows, not spelled like a maker or not an order the page has is dropped without a
 * word: a mistyped address shows the whole page, never an error and never an empty list for a year the
 * car was not built in. Whether the page HAS a set of that maker is the list's to say: it knows the sets.
 */
export function parseVehicleView(search: ViewSearch, span: ProductionSpan, currentYear: number): VehicleView {
	const rawYear = first(search.year);
	const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
	const rawRoof = first(search.roof);
	const inSpan =
		year !== null && (span.from == null || year >= span.from) && year <= lastYearOf(span, currentYear);
	const rawBrand = first(search.brand) ?? "";
	const rawSort = first(search.sort);
	return {
		year: inSpan ? year : null,
		roof: (ROOF_TYPES as readonly string[]).includes(rawRoof ?? "") ? (rawRoof as RoofType) : null,
		brand: rawBrand.length <= 40 && BRAND_KEY.test(rawBrand) ? rawBrand : null,
		sort: (VIEW_SORTS as readonly string[]).includes(rawSort ?? "") ? (rawSort as ViewSort) : null,
	};
}

/** The query string of a view, always in one order (year, roof, brand, sort): "" for the whole page. */
export function vehicleViewQuery(view: VehicleView): string {
	const params = new URLSearchParams();
	if (view.year !== null) params.set("year", String(view.year));
	if (view.roof !== null) params.set("roof", view.roof);
	if (view.brand) params.set("brand", view.brand);
	if (view.sort) params.set("sort", view.sort);
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
