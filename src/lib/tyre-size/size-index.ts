import "server-only";

import rawIndex from "./data/velkosti_20261105.json";

import type { TyreCondition, TyrePickerData, TyreSizeIndex, TyreSizeProduct, TyreSizeRow } from "./types";

/**
 * The tyre sizes of the snow-chain and snow-sock codes (CFM's `velkosti_20261105.json`, copied in verbatim).
 *
 * One product on this shop is one manufacturer's code, and one code fits dozens to hundreds of tyre sizes (5 324
 * rows over 145 codes). The size the customer chose is not a variant of the product; it is data on the cart line.
 * This list is what decides, on the page and again on the server when the line is added, whether a size belongs to
 * a code: a size is never converted, never rounded to a neighbour, and the condition on a tyre make or model that
 * the list attaches to some sizes never disappears.
 *
 * Server-only on purpose. A client component that imported this would put the whole list in the browser; the page
 * hands the picker only the rows of the one code it shows (`tyrePickerData`).
 */

const SCHEMA = "maky.tyre-size-index/1";

const fail = (message: string): never => {
	throw new Error(`tyre-size index: ${message}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/**
 * Check the list's shape and its own bookkeeping, and return it typed.
 *
 * Strict because everything downstream trusts it: an unknown source, a condition key that does not exist, a size
 * twice in one code or a count that does not add up means the file is not the one that was meant to ship, and the
 * add-to-cart check must not run on it. Exported for the test; the module checks its own copy once, at load.
 */
export function parseTyreSizeIndex(raw: unknown): TyreSizeIndex {
	if (!isRecord(raw)) return fail("the list is not an object");
	if (raw.schema !== SCHEMA) return fail(`schema ${String(raw.schema)} is not ${SCHEMA}`);
	if (!isText(raw.id)) return fail("no id");
	if (!isRecord(raw.conditions) || !isRecord(raw.sources) || !isRecord(raw.products)) {
		return fail("conditions, sources and products must be objects");
	}

	const conditions: Record<string, TyreCondition> = {};
	for (const [key, value] of Object.entries(raw.conditions)) {
		if (!isRecord(value)) return fail(`condition ${key} is not an object`);
		const { mode, raw: words, tyres } = value;
		if (mode !== "only" && mode !== "not") return fail(`condition ${key} has mode ${String(mode)}`);
		if (!isText(words)) return fail(`condition ${key} has no text`);
		if (!Array.isArray(tyres) || tyres.length === 0 || !tyres.every(isText)) {
			return fail(`condition ${key} names no tyres`);
		}
		conditions[key] = { mode, raw: words, tyres: [...tyres] };
	}

	for (const [key, value] of Object.entries(raw.sources)) {
		if (!isRecord(value) || !isText(value.label)) return fail(`source ${key} has no label`);
	}

	const products: Record<string, TyreSizeProduct> = {};
	let sizes = 0;
	const conditional = new Set<string>();
	for (const [code, value] of Object.entries(raw.products)) {
		if (!isRecord(value)) return fail(`product ${code} is not an object`);
		if (typeof value.source !== "string" || !Object.hasOwn(raw.sources, value.source)) {
			return fail(`product ${code} has an unknown source`);
		}
		if (!Array.isArray(value.sizes) || value.sizes.length === 0) return fail(`product ${code} has no sizes`);
		const seen = new Set<string>();
		const rows: TyreSizeRow[] = [];
		for (const row of value.sizes) {
			if (!Array.isArray(row) || row.length !== 3)
				return fail(`product ${code} has a row that is not a triple`);
			const [label, rim, conditionKey] = row as unknown[];
			if (!isText(label) || !isText(rim) || typeof conditionKey !== "string") {
				return fail(`product ${code} has a malformed row`);
			}
			if (label !== label.trim()) return fail(`product ${code}: size ${label} has stray whitespace`);
			if (conditionKey !== "" && !Object.hasOwn(conditions, conditionKey)) {
				return fail(`product ${code}: size ${label} names the unknown condition ${conditionKey}`);
			}
			if (seen.has(label)) return fail(`product ${code}: size ${label} appears twice`);
			seen.add(label);
			if (conditionKey !== "") conditional.add(code);
			rows.push([label, rim, conditionKey]);
		}
		sizes += rows.length;
		products[code] = { source: value.source, sizes: rows };
	}

	const counts = raw.counts;
	if (
		!isRecord(counts) ||
		counts.products !== Object.keys(products).length ||
		counts.sizes !== sizes ||
		counts.conditions !== Object.keys(conditions).length ||
		counts.conditional_products !== conditional.size
	) {
		return fail("the counts do not match the content");
	}
	if (!isRecord(raw.origin) || !isText(raw.self_sha256)) return fail("no origin or seal");

	return raw as unknown as TyreSizeIndex;
}

const INDEX: TyreSizeIndex = parseTyreSizeIndex(rawIndex);

/** The list's own id ("snehove-retaze-20261105"): written on the cart line so a later reader knows which list it was checked against. */
export const TYRE_SIZE_LIST_ID: string = INDEX.id;

export function tyreSizeIndex(): TyreSizeIndex {
	return INDEX;
}

/**
 * The sizes of a public product code, or `null` when the code is not one of the size-controlled ones.
 *
 * `Object.hasOwn`, not a property read: a code is attacker-shaped text, and `"constructor"` or `"__proto__"` must
 * not be answered by the object's prototype.
 */
export function tyreSizeProduct(code: string | null | undefined): TyreSizeProduct | null {
	if (typeof code !== "string" || code === "") return null;
	return Object.hasOwn(INDEX.products, code) ? INDEX.products[code] : null;
}

export function isTyreSizeControlled(code: string | null | undefined): boolean {
	return tyreSizeProduct(code) !== null;
}

/** The manufacturer's own list, as against the previous shop's cards: the customer is told which one it is. */
const MANUFACTURER_SOURCE = /^manufacturer_list/;

const numeric = (rim: string): number => Number.parseFloat(rim);

/** The rows of one code, grouped by rim in ascending order, for the picker. `null` for a code that is not size-controlled. */
export function tyrePickerData(code: string | null | undefined): TyrePickerData | null {
	const product = tyreSizeProduct(code);
	if (!product || !code) return null;

	const byRim = new Map<string, { label: string; conditionKey: string }[]>();
	const usedConditions: Record<string, { mode: TyreCondition["mode"]; tyres: readonly string[] }> = {};
	for (const [label, rim, conditionKey] of product.sizes) {
		const group = byRim.get(rim) ?? [];
		group.push({ label, conditionKey });
		byRim.set(rim, group);
		if (conditionKey !== "") {
			const condition = INDEX.conditions[conditionKey];
			usedConditions[conditionKey] = { mode: condition.mode, tyres: [...condition.tyres] };
		}
	}

	return {
		code,
		fromManufacturerList: MANUFACTURER_SOURCE.test(product.source),
		rims: [...byRim.entries()]
			.sort(([a], [b]) => numeric(a) - numeric(b))
			.map(([rim, sizes]) => ({ rim, sizes })),
		conditions: usedConditions,
	};
}
