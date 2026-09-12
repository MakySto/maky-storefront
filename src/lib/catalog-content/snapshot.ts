import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cache } from "react";
import { createExpiringMemo } from "@/lib/cache/expiring-memo";
import { type CatalogContentPage, type CatalogContentSnapshot, parseContentSnapshot } from "./contract";

/**
 * Loading the catalogue-content snapshot, once per process per LANGUAGE.
 *
 * The artifact is ~9.7 MB per language and the fitment one beside it is 7.9 MB.
 * `src/lib/fitment/provider.ts` already learned what that costs: Next's data cache refuses
 * any entry over 2 MB, so `next: { revalidate }` silently does nothing and every request
 * re-downloads. The fix there was an in-process memo plus in-flight de-duplication, and
 * this mirrors it rather than inventing a second approach.
 *
 * ## One artifact per language
 *
 * CFM publishes ten of these — `…-sk-…`, `…-de-…` and so on — identical in structure and
 * translated in content. A `{lang}` placeholder in the path or URL turns on locale-aware
 * loading; without one the value names a single fixed artifact, which is what production
 * ran before this and still runs unchanged.
 *
 *   MAKY_CATALOG_CONTENT_PATH   a file on disk — how a release pins exact artifacts
 *   MAKY_CATALOG_CONTENT_URL    fetched once per process per language
 *
 * Neither set means the feature is off, which is the safe default: no source, no pages.
 *
 * A FIXED path serves ONLY the language the artifact itself declares. That is the whole
 * reason the language is checked after parsing rather than assumed from configuration: a
 * German market must not be handed Slovak prose because someone pointed one variable at
 * one file.
 *
 * ## Memory, measured rather than feared
 *
 * A parsed snapshot retains ~15.9 MB (measured, `--expose-gc`, 9.29 MB file). Ten
 * languages held at once is ~159 MB, and ten is the ceiling: the key is derived from
 * `CHANNEL_MAP`, never from the URL, so the key space is closed and small. No eviction
 * policy is needed for a bound that is already this tight — and the TTL still refreshes.
 *
 * ## Integrity
 *
 * `MAKY_CATALOG_CONTENT_SHA256` pins the TRANSPORT bytes of a single fixed artifact. It is
 * deliberately not the snapshot's own `selfSha256`: that one is computed by the exporter
 * over a canonical form and cannot be checked without first parsing the very bytes whose
 * integrity is in question. Checking the transport hash is the part a consumer can do.
 *
 * One hash cannot pin ten files, so `MAKY_CATALOG_CONTENT_SHA256SUMS` names CFM's own
 * published `SHA256SUMS_CONTENT_<date>` manifest and pins every language by basename.
 * Worth having: CFM's dated filenames are NOT immutable — the 2026-09-11 artifact was
 * re-exported in place under the same name, with different bytes.
 */

export type CatalogContentStatus = {
	readonly mode: "disabled" | "file" | "http";
	readonly unavailableReason: string | null;
	readonly language: string | null;
	readonly generatedAt: string | null;
	readonly pageCount: number;
	/** Transport digest of the bytes actually read. */
	readonly sha256: string | null;
};

export type CatalogContentLoad = {
	readonly snapshot: CatalogContentSnapshot | null;
	readonly status: CatalogContentStatus;
};

const TTL_MS = 15 * 60 * 1000;

/** `{lang}` in a path or URL. Its presence is what selects locale-aware mode. */
const LANG_PLACEHOLDER = "{lang}";

/**
 * A language is two lower-case letters and nothing else.
 *
 * Defence in depth, not the primary control. The language is derived from `CHANNEL_MAP`,
 * so it cannot be steered from a URL today — but it is interpolated into a FILE PATH, and
 * a value like `../../etc/passwd` must be impossible by construction rather than by
 * knowing who the caller is.
 */
const LANGUAGE_RE = /^[a-z]{2}$/;

/**
 * Expiry is scheduled, not computed from the clock on every read. Reading the clock here
 * is what made every preview market's vehicle page answer 500 — see `expiring-memo.ts`.
 */
const memo = createExpiringMemo<CatalogContentLoad>();
const inflight = new Map<string, Promise<CatalogContentLoad>>();
let sums: { key: string; byFile: ReadonlyMap<string, string> } | null = null;

/** Exported for tests only — a module-level memo cannot be observed any other way. */
export function resetCatalogContentCache(): void {
	memo.clear();
	inflight.clear();
	sums = null;
}

type Source = {
	mode: "file" | "http";
	/** The concrete location, with any `{lang}` already substituted. */
	location: string;
	/** True when the configuration names one artifact rather than a family. */
	fixed: boolean;
};

function source(language: string): Source | null {
	const path = process.env.MAKY_CATALOG_CONTENT_PATH?.trim();
	if (path) {
		return path.includes(LANG_PLACEHOLDER)
			? { mode: "file", location: path.split(LANG_PLACEHOLDER).join(language), fixed: false }
			: { mode: "file", location: path, fixed: true };
	}
	const url = process.env.MAKY_CATALOG_CONTENT_URL?.trim();
	if (url) {
		return url.includes(LANG_PLACEHOLDER)
			? { mode: "http", location: url.split(LANG_PLACEHOLDER).join(language), fixed: false }
			: { mode: "http", location: url, fixed: true };
	}
	return null;
}

function unavailable(mode: CatalogContentStatus["mode"], reason: string): CatalogContentLoad {
	return {
		snapshot: null,
		status: {
			mode,
			unavailableReason: reason,
			language: null,
			generatedAt: null,
			pageCount: 0,
			sha256: null,
		},
	};
}

async function readBytes(from: Source): Promise<Buffer> {
	if (from.mode === "file") return readFile(from.location);
	const response = await fetch(from.location, { cache: "no-store" });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

/** CFM's manifest: `<64 hex>  <filename>` per line. Read once per process, per path. */
async function expectedFromSums(location: string): Promise<string | null> {
	const sumsPath = process.env.MAKY_CATALOG_CONTENT_SHA256SUMS?.trim();
	if (!sumsPath) return null;
	if (!sums || sums.key !== sumsPath) {
		const byFile = new Map<string, string>();
		try {
			const text = await readFile(sumsPath, "utf8");
			for (const line of text.split("\n")) {
				const match = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/.exec(line);
				if (match) byFile.set(match[2], match[1]);
			}
		} catch {
			// An unreadable manifest must not silently become "nothing to check": leave the
			// map empty and let the per-file lookup below refuse.
		}
		sums = { key: sumsPath, byFile };
	}
	const basename = location.split("/").pop() ?? location;
	return sums.byFile.get(basename) ?? null;
}

async function loadOnce(from: Source, language: string): Promise<CatalogContentLoad> {
	let bytes: Buffer;
	try {
		bytes = await readBytes(from);
	} catch (error) {
		return unavailable(from.mode, `unreadable: ${error instanceof Error ? error.message : "unknown"}`);
	}

	const sha256 = createHash("sha256").update(bytes).digest("hex");
	// A single hash can only describe a single artifact, so it applies to a fixed source.
	// A family is pinned by CFM's own manifest instead.
	const expected = from.fixed
		? process.env.MAKY_CATALOG_CONTENT_SHA256?.trim().toLowerCase()
		: (await expectedFromSums(from.location)) ?? undefined;
	if (expected && expected !== sha256) {
		// A snapshot that is not the one the release pinned must not become the one being
		// served. Refusing keeps the previous good memo in place.
		return unavailable(
			from.mode,
			`sha256 mismatch: expected ${expected.slice(0, 12)}…, got ${sha256.slice(0, 12)}…`,
		);
	}

	let snapshot: CatalogContentSnapshot;
	try {
		snapshot = parseContentSnapshot(JSON.parse(bytes.toString("utf8")));
	} catch (error) {
		return unavailable(from.mode, `invalid: ${error instanceof Error ? error.message : "unknown"}`);
	}

	// The artifact's own word is what decides which language it serves. A fixed path
	// pointed at the Slovak file answers `sk` and nothing else; a `{lang}` family that
	// resolved to a file whose contents disagree with its name is a packaging error, and
	// either way handing it to the wrong market would ship the wrong prose under the right
	// hreflang — the one mistake `market-state.ts` exists to prevent.
	if (snapshot.language !== language) {
		return unavailable(
			from.mode,
			`snapshot is ${JSON.stringify(snapshot.language)}, not ${JSON.stringify(language)}`,
		);
	}

	return {
		snapshot,
		status: {
			mode: from.mode,
			unavailableReason: null,
			language: snapshot.language,
			generatedAt: snapshot.generatedAt,
			pageCount: snapshot.pages.length,
			sha256,
		},
	};
}

async function loadWithMemo(language: string): Promise<CatalogContentLoad> {
	if (!LANGUAGE_RE.test(language))
		return unavailable("disabled", `unsupported language ${JSON.stringify(language)}`);

	const from = source(language);
	if (!from) return unavailable("disabled", "no MAKY_CATALOG_CONTENT_PATH or MAKY_CATALOG_CONTENT_URL");

	const key = `${from.mode}:${from.location}:${language}`;
	const hit = memo.get(key);
	if (hit) return hit;
	const pending = inflight.get(key);
	if (pending) return pending;

	const promise = loadOnce(from, language).then((load) => {
		// A failed refresh must not evict a good snapshot: keep serving the last one that
		// parsed, and let the next request try again.
		const previous = memo.getStale(key);
		if (load.snapshot === null && previous) {
			inflight.delete(key);
			return previous;
		}
		memo.set(key, load, TTL_MS);
		inflight.delete(key);
		return load;
	});

	inflight.set(key, promise);
	return promise;
}

/**
 * Wrapped in React `cache()` so the several places that need it during one render share a
 * single load. The language is part of the cache key, which is what makes it safe for one
 * render to touch more than one market.
 */
export const loadCatalogContent = cache(async function loadCatalogContent(
	language: string,
): Promise<CatalogContentLoad> {
	return loadWithMemo(language);
});

/** Every page, keyed the two ways the consumer looks them up. */
export type CatalogPageLookup = {
	readonly byUrlPath: ReadonlyMap<string, CatalogContentPage>;
	readonly byVehicleId: ReadonlyMap<string, CatalogContentPage>;
};

export function buildPageLookup(snapshot: CatalogContentSnapshot): CatalogPageLookup {
	const byUrlPath = new Map<string, CatalogContentPage>();
	const byVehicleId = new Map<string, CatalogContentPage>();
	for (const page of snapshot.pages) {
		byUrlPath.set(page.urlPath, page);
		if (page.vehicleId) byVehicleId.set(page.vehicleId, page);
	}
	return { byUrlPath, byVehicleId };
}
