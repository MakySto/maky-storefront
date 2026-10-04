import { createHash } from "node:crypto";

import { isSupportedContentSchema } from "@/lib/catalog-content/contract";

/**
 * The release manifest CFM publishes, parsed at the boundary.
 *
 * Contract: `backend/docs/contracts/MAKY_RELEASE_MANIFEST_CONTRACT.md` in CarFitManager-4, with its
 * JSON Schema and examples. This file is the CONSUMER half of it and is deliberately pure — bytes in,
 * a verdict out — so that every rule that can reject a manifest is testable without a network.
 *
 * A manifest is refused as a whole when anything the consumer relies on is wrong. A half-trusted
 * manifest is worse than none: the process keeps what it already serves and says why.
 */

export const MANIFEST_ARTIFACT = "MAKY_RELEASE_MANIFEST";
export const SUPPORTED_MANIFEST_MAJOR = "1";
export const CONTENT_ARTIFACT = "CATALOG_CONTENT_SNAPSHOT";

/** The pointer is a few KB. Anything near this is not a manifest. */
export const MANIFEST_MAX_BYTES = 1_048_576;

/** A content file is ~10 MB and the fitment dataset ~8 MB; this is the ceiling, not an expectation. */
export const FILE_MAX_BYTES = 64 * 1_048_576;

/**
 * Why a manifest, a file or a target was refused. The codes are the contract's (section 8) and
 * travel to CFM in the status document, where the admin shows them next to the target.
 */
export type ReleaseErrorCode =
	| "manifest_unreachable"
	| "manifest_invalid"
	| "manifest_schema_unsupported"
	| "manifest_downgrade"
	| "manifest_conflict"
	| "manifest_origin"
	| "target_unknown"
	| "file_unreachable"
	| "file_size_mismatch"
	| "file_hash_mismatch"
	| "file_invalid"
	| "file_language_mismatch"
	| "fitment_hash_mismatch"
	| "fitment_invalid";

export type ReleaseFault = { readonly code: ReleaseErrorCode; readonly message: string };

/** One market's content file. `release` is that market's own approved-version counter. */
export type ContentEntry = {
	readonly market: string;
	readonly language: string;
	readonly file: string;
	readonly sha256: string;
	readonly bytes: number;
	readonly release: number;
	/** How many pages the file holds, when CFM says; checked against the parsed file. */
	readonly pages: number | null;
};

export type FitmentEntry = {
	readonly file: string;
	readonly sha256: string;
	readonly bytes: number;
	readonly release: number;
	readonly schemaVersion: string;
	readonly datasetVersion: string;
	/** The SEMANTIC hash, which this process must recompute from the text rather than trust. */
	readonly datasetHash: string;
};

export type ReleaseManifest = {
	readonly manifestVersion: number;
	readonly generatedAt: string;
	/** HTTPS, same origin as the pointer, ends in a slash. A file is `base + file`. */
	readonly base: string;
	readonly contentContract: { readonly artifact: string; readonly schemaVersion: string };
	/** Keyed by market code. */
	readonly content: Readonly<Record<string, ContentEntry>>;
	readonly fitment: FitmentEntry | null;
	readonly selfSha256: string;
};

export type ManifestParse =
	| { readonly ok: true; readonly manifest: ReleaseManifest; readonly sha256: string }
	| { readonly ok: false; readonly fault: ReleaseFault };

const SHA256_RE = /^[0-9a-f]{64}$/;
/** One file name, no slash: the name carries the content hash, and a path would be a way out of `base`. */
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const MARKET_RE = /^[a-z][a-z0-9_-]{0,7}$/;
const LANGUAGE_RE = /^[A-Za-z][A-Za-z0-9-]{1,7}$/;

/** What the manifest says about how it must be consumed. A different answer is a different contract. */
const EXPECTED_RULES = {
	activation: "per-target",
	contentSelection: "by-target",
	contentAndFitment: "independent",
	sharedFiles: "identical-bytes-share-one-file",
} as const;

/** A refusal that carries its contract code, so the status document can say exactly why. */
export class ReleaseFailure extends Error {
	readonly fault: ReleaseFault;
	constructor(code: ReleaseErrorCode, message: string) {
		super(message);
		this.fault = { code, message };
	}
}

function refuse(code: ReleaseErrorCode, message: string): never {
	throw new ReleaseFailure(code, message);
}

function record(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		refuse("manifest_invalid", `${what} is not an object`);
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, what: string): string {
	if (typeof value !== "string" || value.length === 0) refuse("manifest_invalid", `${what} is not a string`);
	return value;
}

function whole(value: unknown, what: string, min: number): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
		refuse("manifest_invalid", `${what} is not an integer >= ${min}`);
	}
	return value;
}

function hash(value: unknown, what: string): string {
	if (typeof value !== "string" || !SHA256_RE.test(value))
		refuse("manifest_invalid", `${what} is not a SHA-256`);
	return value;
}

function fileName(value: unknown, what: string): string {
	if (typeof value !== "string" || !FILE_NAME_RE.test(value)) {
		refuse("manifest_invalid", `${what} is not a plain file name`);
	}
	return value;
}

function size(value: unknown, what: string): number {
	const bytes = whole(value, what, 1);
	if (bytes > FILE_MAX_BYTES) refuse("manifest_invalid", `${what} exceeds ${FILE_MAX_BYTES} bytes`);
	return bytes;
}

/**
 * The manifest's own digest, by the exporter's convention: SHA-256 of the body WITHOUT `selfSha256`,
 * written as JSON with one-space indentation and non-ASCII left alone.
 *
 * `JSON.parse` keeps key order for every key that is not an integer, and no key in a manifest is —
 * market codes start with a letter — so re-serialising reproduces the bytes Python wrote.
 */
export function manifestSelfSha256(document: Record<string, unknown>): string {
	const { selfSha256: _omitted, ...body } = document;
	return createHash("sha256")
		.update(JSON.stringify(body, null, 1), "utf8")
		.digest("hex");
}

/** One target's entry, as the manifest writes it. Exported because the restart cache keeps entries in the same shape. */
export function parseContentEntry(market: string, raw: unknown): ContentEntry {
	const entry = record(raw, `content.targets.${market}`);
	if (entry.market !== undefined && entry.market !== market) {
		refuse("manifest_invalid", `content.targets.${market} names market ${JSON.stringify(entry.market)}`);
	}
	const language = text(entry.language, `content.targets.${market}.language`);
	if (!LANGUAGE_RE.test(language))
		refuse("manifest_invalid", `content.targets.${market}.language is malformed`);
	const pages = entry.pages;
	if (pages !== null && pages !== undefined) whole(pages, `content.targets.${market}.pages`, 0);
	return {
		market,
		language,
		file: fileName(entry.file, `content.targets.${market}.file`),
		sha256: hash(entry.sha256, `content.targets.${market}.sha256`),
		bytes: size(entry.bytes, `content.targets.${market}.bytes`),
		release: whole(entry.release, `content.targets.${market}.release`, 1),
		pages: typeof pages === "number" ? pages : null,
	};
}

/** The `fitment` entry, as the manifest writes it (the schema version sits under `contract`). */
export function parseFitmentEntry(raw: unknown): FitmentEntry {
	const entry = record(raw, "fitment");
	const contract = record(entry.contract, "fitment.contract");
	return {
		file: fileName(entry.file, "fitment.file"),
		sha256: hash(entry.sha256, "fitment.sha256"),
		bytes: size(entry.bytes, "fitment.bytes"),
		release: whole(entry.release, "fitment.release", 1),
		schemaVersion: text(contract.schemaVersion, "fitment.contract.schemaVersion"),
		datasetVersion: text(entry.datasetVersion, "fitment.datasetVersion"),
		datasetHash: hash(entry.datasetHash, "fitment.datasetHash"),
	};
}

function parseBase(value: unknown, pointerUrl: string): string {
	const base = text(value, "base");
	let parsed: URL;
	try {
		parsed = new URL(base);
	} catch {
		return refuse("manifest_origin", "base is not a URL");
	}
	if (parsed.protocol !== "https:") refuse("manifest_origin", "base is not https");
	if (!base.endsWith("/") || parsed.search !== "" || parsed.hash !== "") {
		refuse("manifest_origin", "base must end in a slash and carry no query or fragment");
	}
	// The pointer was read from the one address this deploy was configured with. Files may only come
	// from that origin: a manifest must not be able to send the process somewhere else for its bytes.
	if (parsed.origin !== new URL(pointerUrl).origin) {
		refuse("manifest_origin", `base is on ${parsed.origin}, the pointer on ${new URL(pointerUrl).origin}`);
	}
	return base;
}

function parseDocument(document: Record<string, unknown>, pointerUrl: string): ReleaseManifest {
	if (document.artifact !== MANIFEST_ARTIFACT) {
		refuse("manifest_invalid", `unexpected artifact ${JSON.stringify(document.artifact)}`);
	}
	const schemaVersion = text(document.schemaVersion, "schemaVersion");
	if (schemaVersion.split(".")[0] !== SUPPORTED_MANIFEST_MAJOR) {
		refuse(
			"manifest_schema_unsupported",
			`unsupported manifest schemaVersion ${JSON.stringify(schemaVersion)}`,
		);
	}
	const manifestVersion = whole(document.manifestVersion, "manifestVersion", 1);
	const selfSha256 = hash(document.selfSha256, "selfSha256");
	if (manifestSelfSha256(document) !== selfSha256) {
		refuse("manifest_invalid", "selfSha256 does not match the body (truncated or mixed response)");
	}

	const rules = record(document.rules, "rules");
	for (const [name, expected] of Object.entries(EXPECTED_RULES)) {
		if (rules[name] !== expected) {
			refuse(
				"manifest_schema_unsupported",
				`rule ${name} is ${JSON.stringify(rules[name])}, expected ${expected}`,
			);
		}
	}

	const base = parseBase(document.base, pointerUrl);
	const content = record(document.content, "content");
	const contract = record(content.contract, "content.contract");
	if (contract.artifact !== CONTENT_ARTIFACT) {
		refuse("manifest_invalid", `content.contract.artifact is ${JSON.stringify(contract.artifact)}`);
	}
	const contentVersion = text(contract.schemaVersion, "content.contract.schemaVersion");
	if (!isSupportedContentSchema(contentVersion)) {
		refuse(
			"manifest_schema_unsupported",
			`unsupported content schemaVersion ${JSON.stringify(contentVersion)}`,
		);
	}

	const targets: Record<string, ContentEntry> = {};
	for (const [market, raw] of Object.entries(record(content.targets, "content.targets"))) {
		if (!MARKET_RE.test(market))
			refuse("manifest_invalid", `market code ${JSON.stringify(market)} is malformed`);
		targets[market] = parseContentEntry(market, raw);
	}

	return {
		manifestVersion,
		generatedAt: text(document.generatedAt, "generatedAt"),
		base,
		contentContract: { artifact: CONTENT_ARTIFACT, schemaVersion: contentVersion },
		content: targets,
		fitment: document.fitment === null ? null : parseFitmentEntry(document.fitment),
		selfSha256,
	};
}

/**
 * Bytes of the pointer → a manifest this process may act on, or the reason it may not.
 *
 * `sha256` is the digest of the exact bytes, which is what the status document reports back and what
 * CFM stores for the version.
 */
export function parseManifest(bytes: Uint8Array, pointerUrl: string): ManifestParse {
	let document: unknown;
	try {
		document = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return { ok: false, fault: { code: "manifest_invalid", message: "the pointer is not JSON" } };
	}
	try {
		const manifest = parseDocument(record(document, "the manifest"), pointerUrl);
		return { ok: true, manifest, sha256: createHash("sha256").update(bytes).digest("hex") };
	} catch (error) {
		if (error instanceof ReleaseFailure) return { ok: false, fault: error.fault };
		throw error;
	}
}

/** Where a file lives. The name was already checked to be one path segment, so this cannot leave `base`. */
export function fileUrl(base: string, file: string): string {
	const url = new URL(file, base).toString();
	if (!url.startsWith(base)) throw new Error(`file ${JSON.stringify(file)} resolves outside ${base}`);
	return url;
}
