import { createHash } from "node:crypto";

import type { TyreCondition, TyreSizeIndex, TyreSizeProduct, TyreSizeRow } from "./types";

/**
 * The tyre-size list as a FILE: what its shape must be and what its seal is. Bytes in, a verdict out, and nothing
 * here knows which list the shop is serving (`active-lists.ts` does), so the copy that ships with the build and a
 * list CFM publishes later go through the very same checks.
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

	// Which sizes have a page is CFM's to say, and optional. What it names must be sizes of this very list, once.
	if (raw.pages !== undefined) {
		if (!Array.isArray(raw.pages) || !raw.pages.every(isText)) return fail("pages is not a list of sizes");
		const listed = new Set(
			Object.values(products).flatMap((product) => product.sizes.map(([label]) => label)),
		);
		const named = new Set<string>();
		for (const label of raw.pages as string[]) {
			if (!listed.has(label)) return fail(`pages names ${label}, which no product of the list has`);
			if (named.has(label)) return fail(`pages names ${label} twice`);
			named.add(label);
		}
	}

	return raw as unknown as TyreSizeIndex;
}

/** CFM's `canonical_json`: sorted keys, no whitespace, text as written. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/**
 * The seal a list must carry: the SHA-256 of its content without the `self_sha256` field, written the way CFM
 * writes it. A list whose seal is not this was changed after it was sealed, or cut short on the way.
 */
export function tyreSizeIndexSeal(raw: unknown): string {
	if (!isRecord(raw)) return fail("the list is not an object");
	const { self_sha256: _seal, ...body } = raw;
	return createHash("sha256").update(canonical(body), "utf8").digest("hex");
}
