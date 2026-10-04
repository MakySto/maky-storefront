import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	ACTIVE_FILE,
	type CacheDocument,
	PRUNE_GRACE_MS,
	filesOf,
	loadFile,
	prune,
	readActive,
	storeFile,
	writeActive,
} from "./cache";
import type { ContentEntry, FitmentEntry } from "./manifest";

/**
 * The files a restart begins from, on a real directory.
 *
 * What these tests hold the module to: a file is never half-written, a name cannot reach outside the cache's
 * own subdirectory, what is read back is exactly what was recorded or an error, and a prune removes only
 * what is the cache's own, unreferenced and old, whatever else lives in the directory it was pointed at.
 */

const SHA = "a".repeat(64);
const HOUR = PRUNE_GRACE_MS;

const FILE = `maky_catalog_content_1.0.0-sk-${SHA.slice(0, 16)}.json`;

function content(market: string, overrides: Partial<ContentEntry> = {}): ContentEntry {
	return { market, language: "sk", file: FILE, sha256: SHA, bytes: 11, release: 3, pages: 3, ...overrides };
}

const FITMENT: FitmentEntry = {
	file: `maky_fitment_3.0.0-test.1-${"b".repeat(16)}.json`,
	sha256: "b".repeat(64),
	bytes: 21,
	release: 2,
	schemaVersion: "3.0.0",
	datasetVersion: "3.0.0-test.1",
	datasetHash: "c".repeat(64),
};

let dir: string;
const subdirectory = () => join(dir, "maky-release-cache");

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "maky-release-cache-test-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/** Age a file, so that a prune sees it as it would an hour-old one. */
async function age(path: string, ms: number): Promise<void> {
	const at = new Date(Date.now() - ms);
	await utimes(path, at, at);
}

describe("a verified file kept for the next boot", () => {
	it("comes back byte for byte", async () => {
		const bytes = new TextEncoder().encode('{"hello":"world"}');

		await storeFile(dir, FILE, bytes);

		expect(await loadFile(dir, FILE, bytes.byteLength)).toEqual(bytes);
	});

	it("is private to the user running the process: the file is 600 and its directory 700", async () => {
		await storeFile(dir, FILE, new Uint8Array([1, 2, 3]));

		expect((await stat(join(subdirectory(), FILE))).mode & 0o777).toBe(0o600);
		expect((await stat(subdirectory())).mode & 0o777).toBe(0o700);
	});

	it("is written beside its name and renamed into place, so nothing is left behind when it is done", async () => {
		await storeFile(dir, FILE, new Uint8Array([1, 2, 3]));

		expect(await readdir(subdirectory())).toEqual([FILE]);
	});

	it("is replaced by a second write rather than skipped, because a file that is there may be the damaged one", async () => {
		await storeFile(dir, FILE, new Uint8Array([1, 2, 3]));
		await storeFile(dir, FILE, new Uint8Array([9, 9, 9]));

		expect(await loadFile(dir, FILE, 3)).toEqual(new Uint8Array([9, 9, 9]));
	});

	it("leaves no temporary file when the write cannot finish", async () => {
		// A directory where the file should go: the rename is refused, after the temporary file was written.
		await mkdir(join(subdirectory(), FILE), { recursive: true });

		await expect(storeFile(dir, FILE, new Uint8Array([1, 2, 3]))).rejects.toThrow();

		expect((await readdir(subdirectory())).filter((name) => name.includes(".tmp-"))).toEqual([]);
	});

	it("is refused on read when its size is not the size the entry records, before anything is hashed", async () => {
		await storeFile(dir, FILE, new Uint8Array([1, 2, 3]));

		await expect(loadFile(dir, FILE, 4)).rejects.toThrow("the kept file is 3 bytes, the entry says 4");
	});

	it("is an error to read a file that is not there, not an empty answer", async () => {
		await expect(loadFile(dir, FILE, 3)).rejects.toThrow();
	});

	it.each([
		["the index itself", ACTIVE_FILE],
		["a temporary file", "maky_catalog_content_1.0.0-sk-aaaa.json.tmp-deadbeef"],
		["a path that leaves the directory", "../escape.json"],
		["a path into a subdirectory", "sub/dir.json"],
		["a backslash path", "sub\\dir.json"],
		["a name that is not a .json file", "maky_catalog_content.txt"],
		["no extension at all", "maky_catalog_content"],
	])("is not a name the cache writes or reads: %s", async (_what, name) => {
		await expect(storeFile(dir, name, new Uint8Array([1]))).rejects.toThrow("is not a name the cache keeps");
		await expect(loadFile(dir, name, 1)).rejects.toThrow("is not a name the cache keeps");
		await expect(readdir(dir)).resolves.toEqual([]);
	});
});

describe("the record of what was in use", () => {
	const held: CacheDocument = {
		manifestVersion: 7,
		content: { sk: content("sk"), de: content("de", { language: "de", pages: null, release: 5 }) },
		fitment: FITMENT,
	};

	it("is read back exactly as it was written, in the manifest's own shape", async () => {
		await writeActive(dir, held);

		expect(await readActive(dir)).toEqual(held);
		const written = JSON.parse(await readFile(join(subdirectory(), ACTIVE_FILE), "utf8"));
		expect(written).toMatchObject({
			artifact: "MAKY_RELEASE_CACHE",
			schemaVersion: 1,
			fitment: { file: FITMENT.file, contract: { schemaVersion: "3.0.0" }, datasetHash: FITMENT.datasetHash },
		});
	});

	it("can say that no dataset was in use, and that no manifest was ever seen", async () => {
		await writeActive(dir, { manifestVersion: null, content: { sk: content("sk") }, fitment: null });

		expect(await readActive(dir)).toEqual({
			manifestVersion: null,
			content: { sk: content("sk") },
			fitment: null,
		});
	});

	it("is nothing yet, which is not an error, when no run has recorded anything", async () => {
		expect(await readActive(dir)).toBeNull();
	});

	it("is replaced whole by the next record", async () => {
		await writeActive(dir, held);
		await writeActive(dir, {
			manifestVersion: 8,
			content: { sk: content("sk", { release: 4 }) },
			fitment: null,
		});

		expect(await readActive(dir)).toEqual({
			manifestVersion: 8,
			content: { sk: content("sk", { release: 4 }) },
			fitment: null,
		});
	});

	async function plant(text: string): Promise<void> {
		await mkdir(subdirectory(), { recursive: true });
		await writeFile(join(subdirectory(), ACTIVE_FILE), text);
	}

	const good = (): Record<string, unknown> => ({
		artifact: "MAKY_RELEASE_CACHE",
		schemaVersion: 1,
		manifestVersion: 1,
		content: { sk: content("sk") },
		fitment: null,
	});

	it.each([
		["not JSON", "{ truncated", "is not JSON"],
		["JSON that is not an object", "[1,2]", "is not a release cache"],
		["null", "null", "is not an object"],
		["another artifact", JSON.stringify({ ...good(), artifact: "SOMETHING_ELSE" }), "is not a release cache"],
		[
			"a schema this build does not read",
			JSON.stringify({ ...good(), schemaVersion: 2 }),
			"is not a release cache",
		],
		["content that is not an object", JSON.stringify({ ...good(), content: [] }), "has no content entries"],
		["content that is missing", JSON.stringify({ ...good(), content: undefined }), "has no content entries"],
	])("is refused when it is %s", async (_what, text, reason) => {
		await plant(text);

		await expect(readActive(dir)).rejects.toThrow(reason);
	});

	it.each([
		["a hash that is not a SHA-256", { sha256: "xyz" }],
		["a file name that is a path", { file: "../x.json" }],
		["a size that is not a number", { bytes: "11" }],
		["a release below 1", { release: 0 }],
		["another market's name inside the entry", { market: "de" }],
	])("is refused when an entry carries %s", async (_what, change) => {
		const document = good();
		document.content = { sk: { ...content("sk"), ...change } };
		await plant(JSON.stringify(document));

		await expect(readActive(dir)).rejects.toThrow();
	});

	it("is refused when the dataset entry is damaged", async () => {
		await plant(JSON.stringify({ ...good(), fitment: { file: FITMENT.file } }));

		await expect(readActive(dir)).rejects.toThrow();
	});

	it("names the files it depends on, content first", () => {
		expect(filesOf(held)).toEqual([FILE, FILE, FITMENT.file]);
		expect(filesOf({ manifestVersion: null, content: {}, fitment: null })).toEqual([]);
	});
});

describe("removing what nothing uses any more", () => {
	async function plantFile(name: string, ageMs: number, text = "x"): Promise<string> {
		await mkdir(subdirectory(), { recursive: true });
		const path = join(subdirectory(), name);
		await writeFile(path, text);
		await age(path, ageMs);
		return path;
	}

	const exists = (path: string) =>
		stat(path).then(
			() => true,
			() => false,
		);

	it("removes a file that nothing names once it is older than the grace, and says which", async () => {
		const old = await plantFile("maky_catalog_content_1.0.0-sk-0000000000000000.json", 2 * HOUR);

		const removed = await prune(dir, new Set(), Date.now());

		expect(removed).toEqual(["maky_catalog_content_1.0.0-sk-0000000000000000.json"]);
		expect(await exists(old)).toBe(false);
	});

	it("keeps a file that is too young: another process may have just stored it and not recorded it yet", async () => {
		const fresh = await plantFile("maky_catalog_content_1.0.0-sk-1111111111111111.json", HOUR / 2);

		expect(await prune(dir, new Set(), Date.now())).toEqual([]);
		expect(await exists(fresh)).toBe(true);
	});

	it("keeps a file this process uses, however old it is", async () => {
		const inUse = await plantFile(FILE, 30 * HOUR);

		expect(await prune(dir, new Set([FILE]), Date.now())).toEqual([]);
		expect(await exists(inUse)).toBe(true);
	});

	it("keeps a file the recorded set names even when this process does not use it: another process recorded it", async () => {
		const theirs = await plantFile(FILE, 30 * HOUR);
		const stale = await plantFile("maky_catalog_content_1.0.0-sk-2222222222222222.json", 30 * HOUR);
		await writeActive(dir, { manifestVersion: 9, content: { sk: content("sk") }, fitment: null });

		const removed = await prune(dir, new Set(), Date.now());

		expect(removed).toEqual(["maky_catalog_content_1.0.0-sk-2222222222222222.json"]);
		expect(await exists(theirs)).toBe(true);
		expect(await exists(stale)).toBe(false);
	});

	it("still prunes when the recorded set cannot be read, and keeps what this process uses", async () => {
		const inUse = await plantFile(FILE, 30 * HOUR);
		const stale = await plantFile("maky_catalog_content_1.0.0-sk-3333333333333333.json", 30 * HOUR);
		await plantFile(ACTIVE_FILE, 0, "{ not json");

		const removed = await prune(dir, new Set([FILE]), Date.now());

		expect(removed).toEqual(["maky_catalog_content_1.0.0-sk-3333333333333333.json"]);
		expect(await exists(inUse)).toBe(true);
		expect(await exists(stale)).toBe(false);
	});

	it("never removes the record itself", async () => {
		const record = await plantFile(ACTIVE_FILE, 30 * HOUR, "{}");

		expect(await prune(dir, new Set(), Date.now())).toEqual([]);
		expect(await exists(record)).toBe(true);
	});

	it("removes the leftovers of a write that was cut short, once they are old, and not before", async () => {
		const leftover = await plantFile(`${FILE}.tmp-0badf00d`, 3 * HOUR);
		const writing = await plantFile(`${FILE}.tmp-1badf00d`, 1_000);

		expect(await prune(dir, new Set([FILE]), Date.now())).toEqual([`${FILE}.tmp-0badf00d`]);
		expect(await exists(leftover)).toBe(false);
		expect(await exists(writing)).toBe(true);
	});

	it("touches nothing that is not the cache's own: other files in its subdirectory, the directory it was given, and subdirectories", async () => {
		const notes = await plantFile("notes.txt", 30 * HOUR);
		const sibling = join(dir, "somebody-elses.json");
		await writeFile(sibling, "{}");
		await age(sibling, 30 * HOUR);
		const nested = join(subdirectory(), "nested.json");
		await mkdir(nested);
		await age(nested, 30 * HOUR);

		expect(await prune(dir, new Set(), Date.now())).toEqual([]);

		expect(await exists(notes)).toBe(true);
		expect(await exists(sibling)).toBe(true);
		expect(await exists(nested)).toBe(true);
	});

	it("has nothing to do, and says so, when no run has stored anything yet", async () => {
		expect(await prune(dir, new Set(), Date.now())).toEqual([]);
	});

	it("is measured against the clock it is given, so a test and a deploy agree on what an hour is", async () => {
		const path = await plantFile("maky_catalog_content_1.0.0-sk-4444444444444444.json", 0);
		const written = (await stat(path)).mtimeMs;

		expect(await prune(dir, new Set(), written + HOUR - 1)).toEqual([]);
		expect(await prune(dir, new Set(), written + HOUR)).toEqual([
			"maky_catalog_content_1.0.0-sk-4444444444444444.json",
		]);
	});
});
