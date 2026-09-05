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
	/** False for provisional / year-hold / conflict rows, which must not read as verified. */
	verified: boolean;
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
