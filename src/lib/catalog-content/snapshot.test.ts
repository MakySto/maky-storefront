import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadCatalogContent, resetCatalogContentCache } from "./snapshot";

/**
 * The loader, with real files on disk.
 *
 * Worth testing against the filesystem rather than a mock: the things that can go wrong
 * here are a path built from a placeholder, a hash compared against the wrong artifact,
 * and a snapshot handed to a market it does not belong to. A stubbed `readFile` would
 * prove none of them.
 */

let dir: string;

function snapshotFor(language: string, pages = 1) {
	return {
		artifact: "CATALOG_CONTENT_SNAPSHOT",
		schemaVersion: "1.0.0",
		generatedAt: "2026-09-12T13:06:29.526422+00:00",
		language,
		assortment: "roof_racks",
		pages: Array.from({ length: pages }, (_, i) => ({
			publicId: `pg:${language}:${i}`,
			kind: "vehicle_make",
			urlPath: `/stresne-nosice/make-${i}`,
			hasEditorialText: true,
			state: "published",
			indexable: true,
			intro: { blocks: [] },
			top: [],
			body: [],
		})),
	};
}

/** Writes the artifact and returns its transport digest, the way CFM's manifest records it. */
function write(language: string): { file: string; sha256: string } {
	const file = join(dir, `maky_catalog_content_1.0.0-${language}-20260912.json`);
	const bytes = Buffer.from(JSON.stringify(snapshotFor(language)), "utf8");
	writeFileSync(file, bytes);
	return { file, sha256: createHash("sha256").update(bytes).digest("hex") };
}

const ENV = [
	"MAKY_CATALOG_CONTENT_PATH",
	"MAKY_CATALOG_CONTENT_URL",
	"MAKY_CATALOG_CONTENT_SHA256",
	"MAKY_CATALOG_CONTENT_SHA256SUMS",
] as const;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "catalog-snapshot-"));
	for (const key of ENV) delete process.env[key];
	resetCatalogContentCache();
});

afterEach(() => {
	for (const key of ENV) delete process.env[key];
	resetCatalogContentCache();
	rmSync(dir, { recursive: true, force: true });
});

describe("locale-aware loading", () => {
	it("substitutes {lang} and gives each market its own artifact", async () => {
		write("sk");
		write("de");
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_1.0.0-{lang}-20260912.json");

		expect((await loadCatalogContent("sk")).snapshot?.language).toBe("sk");
		expect((await loadCatalogContent("de")).snapshot?.language).toBe("de");
	});

	/**
	 * The mistake this prevents is the expensive one: German text is not the problem,
	 * SLOVAK text under a German market is — wrong copy beneath the right hreflang, which
	 * `market-state.ts` calls a cost to the whole domain rather than one page.
	 */
	it("refuses to hand a fixed artifact to a market it does not belong to", async () => {
		const { file } = write("sk");
		process.env.MAKY_CATALOG_CONTENT_PATH = file;

		expect((await loadCatalogContent("sk")).snapshot?.language).toBe("sk");

		const de = await loadCatalogContent("de");
		expect(de.snapshot).toBeNull();
		expect(de.status.unavailableReason).toContain('snapshot is "sk", not "de"');
	});

	it("reports a missing language as unavailable, not as an empty catalogue", async () => {
		write("sk");
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_1.0.0-{lang}-20260912.json");

		const hu = await loadCatalogContent("hu");
		expect(hu.snapshot).toBeNull();
		expect(hu.status.unavailableReason).toMatch(/unreadable/);
	});

	/**
	 * The language reaches a FILE PATH. It comes from CHANNEL_MAP today and so cannot be
	 * steered from a URL — but "cannot" should be a property of this function, not of who
	 * happens to call it.
	 */
	it("refuses anything that is not two lower-case letters", async () => {
		write("sk");
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_1.0.0-{lang}-20260912.json");

		for (const bad of ["../sk", "sk/../..", "SK", "sk-SK", "", "s", "sko"]) {
			const load = await loadCatalogContent(bad);
			expect(load.snapshot, bad).toBeNull();
			expect(load.status.unavailableReason, bad).toContain("unsupported language");
		}
	});
});

describe("integrity", () => {
	it("serves a fixed artifact whose transport hash matches, and refuses one that does not", async () => {
		const { file, sha256 } = write("sk");
		process.env.MAKY_CATALOG_CONTENT_PATH = file;

		process.env.MAKY_CATALOG_CONTENT_SHA256 = sha256;
		expect((await loadCatalogContent("sk")).snapshot?.language).toBe("sk");

		resetCatalogContentCache();
		process.env.MAKY_CATALOG_CONTENT_SHA256 = "0".repeat(64);
		const bad = await loadCatalogContent("sk");
		expect(bad.snapshot).toBeNull();
		expect(bad.status.unavailableReason).toContain("sha256 mismatch");
	});

	/**
	 * One hash cannot pin ten files, so a family is pinned by CFM's own published manifest.
	 * This matters more than it looks: CFM's dated filenames are not immutable — the
	 * 2026-09-11 artifact was re-exported in place, same name, different bytes.
	 */
	it("pins a {lang} family from CFM's SHA256SUMS manifest, per language", async () => {
		const sk = write("sk");
		const de = write("de");
		const sums = join(dir, "SHA256SUMS_CONTENT_20260912");
		writeFileSync(
			sums,
			`${sk.sha256}  ${sk.file.split("/").pop()}\n${"0".repeat(64)}  ${de.file.split("/").pop()}\n`,
		);
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_1.0.0-{lang}-20260912.json");
		process.env.MAKY_CATALOG_CONTENT_SHA256SUMS = sums;

		expect((await loadCatalogContent("sk")).snapshot?.language).toBe("sk");

		const tampered = await loadCatalogContent("de");
		expect(tampered.snapshot).toBeNull();
		expect(tampered.status.unavailableReason).toContain("sha256 mismatch");
	});
});

describe("the memo", () => {
	it("keeps languages apart rather than serving whichever was asked for first", async () => {
		write("sk");
		write("de");
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_1.0.0-{lang}-20260912.json");

		// Interleaved, and repeated: a single-slot memo would answer the second call with
		// the first language and this would catch it.
		const [a, b, c, d] = await Promise.all([
			loadCatalogContent("sk"),
			loadCatalogContent("de"),
			loadCatalogContent("sk"),
			loadCatalogContent("de"),
		]);
		expect([a, b, c, d].map((l) => l.snapshot?.language)).toEqual(["sk", "de", "sk", "de"]);
	});

	/**
	 * Expiry is SCHEDULED, so the fake clock has to be installed before the load that
	 * schedules it — otherwise a real timer is already pending, advancing does nothing, the
	 * memo answers from cache and the test passes without ever exercising a reload.
	 */
	it("keeps serving the last good snapshot when a refresh goes bad", async () => {
		vi.useFakeTimers();
		try {
			const { file, sha256 } = write("sk");
			process.env.MAKY_CATALOG_CONTENT_PATH = file;
			process.env.MAKY_CATALOG_CONTENT_SHA256 = sha256;
			expect((await loadCatalogContent("sk")).snapshot?.language).toBe("sk");

			vi.advanceTimersByTime(16 * 60 * 1000);
			// Now stale, and the reload will fail its hash.
			process.env.MAKY_CATALOG_CONTENT_SHA256 = "1".repeat(64);

			const stale = await loadCatalogContent("sk");
			expect(stale.snapshot?.language, "the good snapshot must survive a failed refresh").toBe("sk");
		} finally {
			vi.useRealTimers();
		}
	});

	/** The same mechanism in reverse: once stale, a GOOD reload is taken. */
	it("does re-read once the TTL has passed", async () => {
		vi.useFakeTimers();
		try {
			const { file } = write("sk");
			process.env.MAKY_CATALOG_CONTENT_PATH = file;
			expect((await loadCatalogContent("sk")).snapshot?.pages).toHaveLength(1);

			// Rewrite the same path with more pages; only a real re-read can see them.
			writeFileSync(file, JSON.stringify(snapshotFor("sk", 3)));
			expect((await loadCatalogContent("sk")).snapshot?.pages, "still fresh").toHaveLength(1);

			vi.advanceTimersByTime(16 * 60 * 1000);
			expect((await loadCatalogContent("sk")).snapshot?.pages, "stale, so re-read").toHaveLength(3);
		} finally {
			vi.useRealTimers();
		}
	});
});
