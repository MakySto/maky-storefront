import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type Harness,
	arrangeRelease,
	contentFile,
	fitmentFile,
	respond,
	status as httpStatus,
} from "./fixtures/fake-cfm";
import failingExample from "./fixtures/status.failing.example.json";
import example from "./fixtures/status.example.json";
import { STATUS_ARTIFACT, STATUS_SCHEMA_VERSION, type LegacyPeek, buildCatalogStatus } from "./status";
import { __resetReleaseState, inspectRelease, releaseSyncOnce } from "./sync";

/**
 * What this process tells CFM about the catalogue it is serving.
 *
 * CFM confirms an adoption from this document and from nothing else, so what matters here is that it
 * never claims more than the process holds: `active` only for the verified file the manifest names,
 * `stale` for anything older, and a `source` that keeps a file held through the older settings from ever
 * being mistaken for the release.
 */

let world: Harness;

beforeEach(() => {
	world = arrangeRelease();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	world.restore();
});

const NOTHING_OLDER: LegacyPeek = { content: () => null, fitment: () => null };

const iso = (ms: number): string => new Date(ms).toISOString();

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Every key the document has, with the entries of `content.targets` collapsed to one and errors left as leaves. */
function shape(value: unknown, at = ""): string[] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
	const keys: string[] = [];
	for (const [key, child] of Object.entries(value)) {
		const path = at ? `${at}.${key}` : key;
		keys.push(path);
		if (path === "content.targets") {
			keys.push(...shape(Object.values(child as object)[0], "content.targets.*"));
		} else if (key !== "error") {
			keys.push(...shape(child, path));
		}
	}
	return keys.sort();
}

const de = contentFile("de");
const sk = contentFile("sk");
const en = contentFile("en");
const fit = fitmentFile("3.0.0-test.1");

/** The manifest of CFM's own example: DE and AT on one file, SK, US, and a dataset. */
function publishExample() {
	return world.cfm.publish({
		version: 7,
		targets: {
			at: { file: de, release: 2 },
			de: { file: de, release: 3 },
			sk: { file: sk, release: 5 },
			us: { file: en, release: 1 },
		},
		fitment: { file: fit, release: 2 },
	});
}

describe("a process that has verified everything the manifest names", () => {
	it("says so, target by target, with the file in use and the release CFM approved for it", async () => {
		const manifest = publishExample();
		await releaseSyncOnce();

		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(document).toMatchObject({
			artifact: STATUS_ARTIFACT,
			schemaVersion: STATUS_SCHEMA_VERSION,
			capabilities: { contentByTarget: true },
			manifest: {
				version: 7,
				sha256: sha256(JSON.stringify(manifest, null, 1)),
				outcome: "new",
				error: null,
				checkedAt: iso(world.clock.now),
			},
		});
		expect(Object.keys(document.content.targets)).toEqual(["at", "de", "sk", "us"]);
		expect(document.content.targets.de).toEqual({
			file: de.name,
			sha256: de.sha256,
			release: 3,
			language: "de",
			pages: 3,
			state: "active",
			source: "manifest",
			activatedAt: iso(world.clock.now),
			error: null,
		});
		// One file under two targets: the same bytes, and each target's own release. Austria's line says
		// nothing about Germany's, and Germany's nothing about Austria's.
		expect(document.content.targets.at).toMatchObject({ sha256: de.sha256, release: 2, state: "active" });
		expect(document.fitment).toEqual({
			file: fit.name,
			sha256: fit.sha256,
			datasetHash: fit.datasetHash,
			datasetVersion: "3.0.0-test.1",
			release: 2,
			state: "active",
			source: "manifest",
			activatedAt: iso(world.clock.now),
			error: null,
		});
	});

	it("has the same keys as the example that ships beside the contract, so CFM's schema accepts it", async () => {
		publishExample();
		await releaseSyncOnce();

		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: true });

		expect(shape(document)).toEqual(shape(example));
		expect(Object.keys(document.content.targets.de ?? {}).sort()).toEqual(
			Object.keys(example.content.targets.de).sort(),
		);
		expect(Object.keys(document.fitment ?? {}).sort()).toEqual(Object.keys(example.fitment).sort());
	});

	it("identifies the process to an operator and to nobody else", async () => {
		publishExample();
		await releaseSyncOnce();

		const open = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });
		const operator = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: true });

		expect(Object.keys(open.process)).toEqual(["bootId"]);
		expect(operator.process).toMatchObject({ bootId: open.process.bootId, pid: process.pid });
		expect(operator.process.startedAt).toBe(iso(inspectRelease().startedAt));
	});
});

describe("a process that holds something older than the manifest names", () => {
	it("calls a target stale, reports the file in USE, and says why the newer one was not taken", async () => {
		publishExample();
		await releaseSyncOnce();

		const next = contentFile("sk", "next");
		world.cfm.override(next.name, () => respond(next.bytes.slice(0, -3)));
		world.cfm.publish({
			version: 8,
			targets: {
				at: { file: de, release: 2 },
				de: { file: de, release: 3 },
				sk: { file: next, release: 6 },
				us: { file: en, release: 1 },
			},
			fitment: { file: fit, release: 2 },
		});
		await releaseSyncOnce();

		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(document.content.targets.sk).toMatchObject({
			file: sk.name,
			sha256: sk.sha256,
			release: 5,
			state: "stale",
			source: "manifest",
			error: { code: "file_size_mismatch" },
		});
		// Everything else is untouched by it.
		expect(document.content.targets.de).toMatchObject({ state: "active", error: null });
		expect(document.content.targets.us).toMatchObject({ state: "active", error: null });
		expect(document.fitment).toMatchObject({ state: "active" });
	});

	it("calls the dataset stale, and reports the one in use, when the newer one did not verify", async () => {
		publishExample();
		await releaseSyncOnce();

		const next = fitmentFile("3.0.0-test.2");
		world.cfm.override(next.name, () => respond(next.bytes.slice(0, -4)));
		world.cfm.publish({
			version: 8,
			targets: {
				at: { file: de, release: 2 },
				de: { file: de, release: 3 },
				sk: { file: sk, release: 5 },
				us: { file: en, release: 1 },
			},
			fitment: { file: next, release: 3 },
		});
		await releaseSyncOnce();

		const { fitment } = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(fitment).toMatchObject({
			file: fit.name,
			sha256: fit.sha256,
			datasetHash: fit.datasetHash,
			datasetVersion: "3.0.0-test.1",
			release: 2,
			state: "stale",
			source: "manifest",
			error: { code: "file_size_mismatch" },
		});
	});

	it("says `legacy` for a file held through the older settings, which is never the release", async () => {
		const bad = contentFile("en", "bad");
		world.cfm.override(bad.name, () => respond(new Uint8Array(bad.bytes.byteLength)));
		world.cfm.publish({
			version: 7,
			targets: { sk: { file: sk, release: 5 }, us: { file: bad, release: 1 } },
			fitment: { file: fit, release: 2 },
		});
		await releaseSyncOnce();

		const older: LegacyPeek = {
			content: (language) => (language === "en" ? { sha256: "a".repeat(64), pageCount: 398 } : null),
			fitment: () => null,
		};
		const document = buildCatalogStatus(inspectRelease(), older, { operator: true });

		expect(document.content.targets.us).toEqual({
			file: null,
			sha256: "a".repeat(64),
			release: null,
			language: "en",
			pages: 398,
			state: "stale",
			source: "legacy",
			activatedAt: null,
			error: { code: "file_hash_mismatch", message: expect.any(String) },
		});
		expect(document.content.targets.sk).toMatchObject({ state: "active", source: "manifest" });
		// The same keys as CFM's own example of a process with one target that did not verify.
		expect(shape(document)).toEqual(shape(failingExample));
	});

	it("says `missing` for a target with nothing at all, rather than inventing a hash", async () => {
		const bad = contentFile("en", "bad");
		world.cfm.override(bad.name, () => httpStatus(404));
		world.cfm.publish({ version: 7, targets: { us: { file: bad, release: 1 } } });
		await releaseSyncOnce();

		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(document.content.targets.us).toEqual({
			file: null,
			sha256: null,
			release: null,
			language: "en",
			pages: null,
			state: "missing",
			source: "none",
			activatedAt: null,
			error: { code: "file_unreachable", message: "HTTP 404" },
		});
	});
});

describe("the dataset line", () => {
	it("is absent when the manifest names no dataset, because there is nothing for CFM to confirm", async () => {
		world.cfm.publish({ version: 1, targets: { sk: { file: sk, release: 1 } }, fitment: null });
		await releaseSyncOnce();

		expect(buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false }).fitment).toBeNull();
	});

	it("carries the hash this process recomputed, not the one the manifest states", async () => {
		world.cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		await releaseSyncOnce();

		const { fitment } = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(fitment?.datasetHash).toBe(fit.datasetHash);
		expect(fitment?.sha256).toBe(fit.sha256);
	});

	it("is `legacy` and stale while the older settings hold a dataset and the release has not verified one", async () => {
		world.cfm.override(fit.name, () => httpStatus(503));
		world.cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		await releaseSyncOnce();

		const older: LegacyPeek = {
			content: () => null,
			fitment: () => ({ sha256: "c".repeat(64), datasetHash: "d".repeat(64), datasetVersion: "3.0.0-older" }),
		};
		const { fitment } = buildCatalogStatus(inspectRelease(), older, { operator: false });

		expect(fitment).toMatchObject({
			file: null,
			sha256: "c".repeat(64),
			datasetHash: "d".repeat(64),
			datasetVersion: "3.0.0-older",
			release: null,
			state: "stale",
			source: "legacy",
			error: { code: "file_unreachable" },
		});
	});

	it("is `missing` when neither the release nor the older settings hold one", async () => {
		world.cfm.override(fit.name, () => httpStatus(503));
		world.cfm.publish({
			version: 1,
			targets: { sk: { file: sk, release: 1 } },
			fitment: { file: fit, release: 1 },
		});
		await releaseSyncOnce();

		const { fitment } = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(fitment).toMatchObject({
			file: null,
			sha256: null,
			datasetHash: null,
			state: "missing",
			source: "none",
		});
	});
});

describe("a process that has not seen a manifest yet, or is not following one", () => {
	it("answers with what it has: no manifest, no targets, and a boot id", () => {
		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(document).toMatchObject({
			capabilities: { contentByTarget: true },
			manifest: { version: null, sha256: null, checkedAt: null, outcome: null, error: null },
			content: { targets: {} },
			fitment: null,
		});
		expect(document.process.bootId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("says it cannot pick content by target when release mode is off, so CFM will not split DE from AT for it", () => {
		delete process.env.MAKY_RELEASE_MANIFEST_URL;

		const document = buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(document.capabilities).toEqual({ contentByTarget: false });
	});

	it("keeps one boot id for the life of the process, and a new one for a new process", () => {
		const first = inspectRelease().bootId;
		expect(inspectRelease().bootId).toBe(first);

		__resetReleaseState(); // a restart, as far as the process-wide state is concerned
		expect(inspectRelease().bootId).not.toBe(first);
	});
});

describe("asking never causes what is asked about", () => {
	it("makes no request, loads nothing and changes nothing", async () => {
		publishExample();
		world.cfm.forget();

		const before = JSON.stringify(inspectRelease());
		buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: true });
		buildCatalogStatus(inspectRelease(), NOTHING_OLDER, { operator: false });

		expect(world.cfm.hits).toEqual([]);
		expect(JSON.stringify(inspectRelease())).toBe(before);
		expect(inspectRelease().targets).toEqual([]);
	});

	it("hands out a copy, so a caller cannot edit the process's state through it", async () => {
		publishExample();
		await releaseSyncOnce();

		const view = inspectRelease();
		(view.targets as unknown as unknown[]).length = 0;

		expect(inspectRelease().targets).toHaveLength(4);
	});
});
