import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cache } from "react";
import { type CatalogContentPage, type CatalogContentSnapshot, parseContentSnapshot } from "./contract";

/**
 * Loading the catalogue-content snapshot, once per process rather than per request.
 *
 * The artifact is 9.68 MB and the fitment one beside it is 7.9 MB. `src/lib/fitment/provider.ts`
 * already learned what that costs: Next's data cache refuses any entry over 2 MB, so
 * `next: { revalidate }` silently does nothing and every request re-downloads. The fix
 * there was an in-process memo plus in-flight de-duplication, and this mirrors it rather
 * than inventing a second approach.
 *
 * Sources, in order of preference:
 *
 *   MAKY_CATALOG_CONTENT_PATH   a file on disk — how a release pins an exact artifact
 *   MAKY_CATALOG_CONTENT_URL    fetched once per process
 *
 * Neither set means the feature is off, which is the safe default: no source, no pages.
 *
 * `MAKY_CATALOG_CONTENT_SHA256` pins the TRANSPORT bytes. It is deliberately not the
 * snapshot's own `selfSha256`: that one is computed by the exporter over a canonical form
 * and cannot be checked without first parsing the very bytes whose integrity is in
 * question. Checking the transport hash is the part a consumer can actually do.
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

let memo: { key: string; load: CatalogContentLoad; expiresAt: number } | null = null;
let inflight: { key: string; promise: Promise<CatalogContentLoad> } | null = null;

/** Exported for tests only — a module-level memo cannot be observed any other way. */
export function resetCatalogContentCache(): void {
	memo = null;
	inflight = null;
}

function source(): { mode: "file" | "http"; key: string } | null {
	const path = process.env.MAKY_CATALOG_CONTENT_PATH?.trim();
	if (path) return { mode: "file", key: `file:${path}` };
	const url = process.env.MAKY_CATALOG_CONTENT_URL?.trim();
	if (url) return { mode: "http", key: `http:${url}` };
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

async function readBytes(mode: "file" | "http"): Promise<Buffer> {
	if (mode === "file") {
		return readFile(process.env.MAKY_CATALOG_CONTENT_PATH!.trim());
	}
	const url = process.env.MAKY_CATALOG_CONTENT_URL!.trim();
	const response = await fetch(url, { cache: "no-store" });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

async function loadOnce(mode: "file" | "http"): Promise<CatalogContentLoad> {
	let bytes: Buffer;
	try {
		bytes = await readBytes(mode);
	} catch (error) {
		return unavailable(mode, `unreadable: ${error instanceof Error ? error.message : "unknown"}`);
	}

	const sha256 = createHash("sha256").update(bytes).digest("hex");
	const expected = process.env.MAKY_CATALOG_CONTENT_SHA256?.trim().toLowerCase();
	if (expected && expected !== sha256) {
		// A snapshot that is not the one the release pinned must not become the one
		// being served. Refusing keeps the previous good memo in place.
		return unavailable(
			mode,
			`sha256 mismatch: expected ${expected.slice(0, 12)}…, got ${sha256.slice(0, 12)}…`,
		);
	}

	let snapshot: CatalogContentSnapshot;
	try {
		snapshot = parseContentSnapshot(JSON.parse(bytes.toString("utf8")));
	} catch (error) {
		return unavailable(mode, `invalid: ${error instanceof Error ? error.message : "unknown"}`);
	}

	return {
		snapshot,
		status: {
			mode,
			unavailableReason: null,
			language: snapshot.language,
			generatedAt: snapshot.generatedAt,
			pageCount: snapshot.pages.length,
			sha256,
		},
	};
}

async function loadWithMemo(): Promise<CatalogContentLoad> {
	const from = source();
	if (!from) return unavailable("disabled", "no MAKY_CATALOG_CONTENT_PATH or MAKY_CATALOG_CONTENT_URL");

	const now = Date.now();
	if (memo && memo.key === from.key && memo.expiresAt > now) return memo.load;
	if (inflight && inflight.key === from.key) return inflight.promise;

	const promise = loadOnce(from.mode).then((load) => {
		// A failed refresh must not evict a good snapshot: keep serving the last one
		// that parsed, and let the next request try again.
		if (load.snapshot === null && memo && memo.key === from.key) {
			inflight = null;
			return memo.load;
		}
		memo = { key: from.key, load, expiresAt: Date.now() + TTL_MS };
		inflight = null;
		return load;
	});

	inflight = { key: from.key, promise };
	return promise;
}

/**
 * Wrapped in React `cache()` so the several places that need it during one render
 * share a single load.
 */
export const loadCatalogContent = cache(async function loadCatalogContent(): Promise<CatalogContentLoad> {
	return loadWithMemo();
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
