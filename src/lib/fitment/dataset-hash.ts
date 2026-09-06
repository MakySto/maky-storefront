/**
 * The dataset's semantic hash — recomputed here, never taken on trust.
 *
 * CFM states a `datasetHash` in every export. Until now this build only checked that the
 * field was a non-empty string, which is not a check: a payload carrying an invented
 * hash, or the hash of a different document, passed exactly like a correct one. The
 * point of the field is to prove that the bytes we validated are the bytes CFM built and
 * counted, so it has to be recomputed and compared.
 *
 * The convention is CFM's, and it is bilateral — both sides must produce the same string
 * from the same document:
 *
 *     SHA-256( UTF-8 canonical JSON: keys sorted, separators "," and ":",
 *              non-ASCII emitted raw (Python `ensure_ascii=False`),
 *              with top-level `datasetHash` AND `generatedAt` removed )
 *
 * `generatedAt` is excluded deliberately, so that a rebuild from unchanged data yields a
 * recognisably identical dataset rather than a new one every night.
 *
 * ⚠️ This is the SEMANTIC hash. The SHA-256 of the exact bytes of the delivered file is a
 * different number and a different job (transport integrity). CFM reports both; they are
 * never interchangeable. `transportChecksum` below is the second one, kept beside this
 * one so that the distinction is impossible to lose.
 *
 * Two places where a naive JavaScript implementation silently disagrees with Python, and
 * what is done about each:
 *
 *   - **Whole-valued floats.** Python writes `1.0`; `JSON.stringify` writes `1`. The
 *     3.0.0 schema has two non-integer number fields (`evidence.confidence` and
 *     `validity.staleAfterDays`), and `confidence: 1.0` is an entirely ordinary value for
 *     a manufacturer application — so this is not a theoretical divergence. When the raw
 *     text is available, numbers are re-emitted from their ORIGINAL source token
 *     (Node 24's `JSON.parse` reviver exposes it), which reproduces Python byte for byte
 *     and, as a free side effect, survives integers too large for a JS double.
 *   - **Key order.** Python sorts by code point; `Array.prototype.sort` sorts by UTF-16
 *     code unit. They agree across the whole BMP and disagree only once an astral
 *     character meets one in U+E000–U+FFFF. Vehicle names are unlikely to contain either,
 *     which is precisely why this would be found by a customer and not by us. Sorted by
 *     code point explicitly.
 */

import { createHash } from "node:crypto";

/** A number that must be re-emitted exactly as the document wrote it. */
class SourceNumber {
	readonly source: string;
	constructor(source: string) {
		this.source = source;
	}
}

type Reviver = (this: unknown, key: string, value: unknown, context?: { source?: string }) => unknown;

const preserveNumberSource: Reviver = function (_key, value, context) {
	if (typeof value === "number" && typeof context?.source === "string") {
		return new SourceNumber(context.source);
	}
	return value;
};

/** Compare by Unicode code point, the way Python's `sorted()` does. */
function byCodePoint(a: string, b: string): number {
	const left = Array.from(a);
	const right = Array.from(b);
	const shared = Math.min(left.length, right.length);
	for (let i = 0; i < shared; i += 1) {
		const diff = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
		if (diff !== 0) return diff;
	}
	return left.length - right.length;
}

/**
 * Canonical JSON, in the exact shape Python's
 * `json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":"))` produces.
 *
 * `JSON.stringify` already agrees with Python on string escaping (same short forms, same
 * lower-case `\uXXXX` for control characters, non-ASCII left raw), so strings are handed
 * to it rather than re-escaped by hand.
 */
export function canonicalJson(value: unknown): string {
	if (value instanceof SourceNumber) return value.source;
	if (value === null || typeof value !== "object") {
		if (typeof value === "number" && !Number.isFinite(value)) {
			// Python would emit `NaN`/`Infinity`, which is not JSON at all. Refuse rather
			// than hash a document neither side can round-trip.
			throw new Error("canonicalJson: non-finite number");
		}
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		// `undefined` is not representable in JSON and Python has no equivalent; a key
		// holding it would be dropped by `JSON.stringify` too, so drop it consistently.
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => byCodePoint(a, b));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** The document as it is hashed: everything except the two excluded top-level fields. */
function withoutExcludedFields(value: unknown): unknown {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
	const { datasetHash: _hash, generatedAt: _generated, ...rest } = value as Record<string, unknown>;
	return rest;
}

/**
 * The semantic hash of a dataset given as a parsed value.
 *
 * Use this only when the raw text genuinely does not exist — a JSON module imported at
 * build time, or a test fixture built in memory. Prefer {@link datasetHashFromText}: it
 * is the one that reproduces Python for whole-valued floats.
 */
export function datasetHashFromValue(value: unknown): string {
	return createHash("sha256")
		.update(canonicalJson(withoutExcludedFields(value)), "utf8")
		.digest("hex");
}

/**
 * The semantic hash of a dataset given as the text that was delivered.
 *
 * This is the accurate path and the one the HTTP provider uses, because it re-emits every
 * number exactly as the document wrote it.
 */
export function datasetHashFromText(text: string): string {
	const parsed: unknown = JSON.parse(text, preserveNumberSource as (k: string, v: unknown) => unknown);
	return createHash("sha256")
		.update(canonicalJson(withoutExcludedFields(parsed)), "utf8")
		.digest("hex");
}

/**
 * The SHA-256 of the exact delivered bytes.
 *
 * Not the same number as the semantic hash and not a substitute for it: this one changes
 * when the whitespace changes, and it is what proves the transfer was not truncated or
 * altered. CFM reports it separately, and so do we.
 */
export function transportChecksum(bytes: Uint8Array | string): string {
	return createHash("sha256")
		.update(typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes)
		.digest("hex");
}
