/**
 * Types and constants for the product-applications list.
 *
 * Kept out of `application-actions.ts` for the same reason as `selector-types.ts`:
 * a `"use server"` module may export only async functions.
 */

export const APPLICATIONS_PAGE_SIZE = 25;

export type ApplicationRow = {
	applicationId: string;
	makeName: string;
	modelName: string;
	generationName: string;
	yearFrom: number;
	yearTo: number | null;
	roofTypes: string[] | null;
	bodyTypes: string[] | null;
	doors: number[] | null;
	conditionCodes: string[];
	/**
	 * The SOURCE accepted this row for this product. False for held, unreviewed,
	 * conflicting or rejected rows, which must not read as confirmed.
	 *
	 * It is not a claim that anybody checked the car: nothing in the catalogue is
	 * `cfm-verified` today, and this list must not imply that it is.
	 */
	accepted: boolean;
};

export type ApplicationPage = {
	rows: ApplicationRow[];
	total: number;
	hasMore: boolean;
	unavailable: boolean;
	isFixture: boolean;
};

export const EMPTY_APPLICATION_PAGE: ApplicationPage = {
	rows: [],
	total: 0,
	hasMore: false,
	unavailable: true,
	isFixture: false,
};
