import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadCatalogContent, resetCatalogContentCache } from "@/lib/catalog-content/snapshot";

import { ACTIVE_FILE, PRUNE_GRACE_MS, readActive, storeFile, writeActive } from "./cache";
import {
	type ContentFile,
	type FitmentFile,
	type Harness,
	arrangeRelease,
	contentFile,
	fitmentFile,
	respond,
	status as httpStatus,
} from "./fixtures/fake-cfm";
import {
	__resetReleaseState,
	inspectRelease,
	releaseSyncOnce,
	releasedContent,
	releasedFitment,
} from "./sync";

/**
 * A restart that begins from the last verified release, with a real directory in between.
 *
 * What is held here is that the cache is a convenience and never an authority: it is read back through the
 * same checks as a download, it never holds anything the process had not verified and put in use, it never
 * outranks a manifest, and when it cannot be written or read the process behaves exactly as it does without
 * one. A restart is `__resetReleaseState()`: the process forgets everything it knew, while the directory,
 * the network and the environment stay as they were.
 */

const SUBDIRECTORY = "maky-release-cache";
const HOUR = PRUNE_GRACE_MS;

let world: Harness;
let root: string;
let cacheDir: string;
let warn: ReturnType<typeof quiet>;

const quiet = (method: "log" | "warn" | "error") =>
	vi.spyOn(console, method).mockImplementation(() => undefined);

beforeEach(async () => {
	world = arrangeRelease();
	root = await mkdtemp(join(tmpdir(), "maky-release-sync-cache-"));
	cacheDir = join(root, "cache");
	process.env.MAKY_RELEASE_CACHE_DIR = cacheDir;
	quiet("log");
	quiet("error");
	warn = quiet("warn");
	resetCatalogContentCache();
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	resetCatalogContentCache();
	world.restore();
	await rm(root, { recursive: true, force: true });
});

const pass = (): Promise<void> => releaseSyncOnce();

/** What a restart does to a process: it forgets what it knew. The disk, the network and the settings stay. */
function restart(): void {
	__resetReleaseState();
}

/** CFM cannot be reached at all: the connection fails, which is not the same as an error page. */
function cfmDown(): void {
	world.cfm.override("MANIFEST.json", () => {
		throw new TypeError("fetch failed");
	});
}

function serving(market: string, language: string): string | undefined {
	const block = releasedContent(market, language)?.snapshot?.pages[0]?.intro?.blocks[0] as
		| { data: { text: string } }
		| undefined;
	return block?.data.text;
}

const kept = (name = "") => join(cacheDir, SUBDIRECTORY, name);
const listing = async (): Promise<string[]> => (await readdir(kept())).sort();
const exists = (path: string) =>
	stat(path).then(
		() => true,
		() => false,
	);

/** Set a file's age as the loader's clock sees it, which is what a prune measures against. */
async function ageFile(path: string, ms: number): Promise<void> {
	const at = new Date(world.clock.now - ms);
	await utimes(path, at, at);
}

function flip(bytes: Uint8Array): Uint8Array {
	const copy = bytes.slice();
	copy[copy.length >> 1] ^= 1;
	return copy;
}

/** Release 1 as a deploy first sees it: Slovakia, Germany and Austria sharing one German file, and a dataset. */
function releaseOne(overrides: { sk?: ContentFile; de?: ContentFile; fitment?: FitmentFile } = {}) {
	const sk = overrides.sk ?? contentFile("sk", "a");
	const de = overrides.de ?? contentFile("de", "a");
	const fitment = overrides.fitment ?? fitmentFile("3.0.0-test.1");
	world.cfm.publish({
		version: 1,
		targets: { sk: { file: sk, release: 1 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
		fitment: { file: fitment, release: 1 },
	});
	return { sk, de, fitment };
}

describe("a restart that begins from the last verified release", () => {
	it("restores every market and the dataset from disk when CFM cannot be reached, and fetches no file", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		restart();
		cfmDown();
		world.cfm.forget();

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(serving("de", "de")).toBe("de/a/0");
		expect(serving("at", "de")).toBe("de/a/0");
		expect(releasedFitment()?.dataset.datasetHash).toBe(fitment.datasetHash);
		for (const file of [sk, de, fitment]) expect(world.cfm.count(file.name)).toBe(0);
		expect(world.cfm.count("MANIFEST.json")).toBe(1);
		expect(inspectRelease().manifest).toMatchObject({
			outcome: "failed",
			fault: { code: "manifest_unreachable" },
		});
	});

	it("restores before the network is asked anything, so a slow CFM changes nothing a visitor sees", async () => {
		releaseOne();
		await pass();
		restart();
		let seenWhenAsked: string | undefined;
		world.cfm.override("MANIFEST.json", () => {
			seenWhenAsked = serving("sk", "sk");
			return httpStatus(503);
		});

		await pass();

		expect(seenWhenAsked).toBe("sk/a/0");
	});

	it("shares one parsed snapshot between DE and AT after a restore, as it does after a download", async () => {
		releaseOne();
		await pass();
		restart();
		cfmDown();

		await pass();

		expect(releasedContent("de", "de")?.snapshot).toBe(releasedContent("at", "de")?.snapshot);
		expect(releasedContent("de", "de")?.snapshot).not.toBe(releasedContent("sk", "sk")?.snapshot);
	});

	it("reports a restored market as active under the file's own hash, and a restored dataset under its recomputed hash", async () => {
		const { sk, fitment } = releaseOne();
		await pass();
		restart();
		cfmDown();

		await pass();

		const view = inspectRelease();
		expect(view.targets.find((target) => target.market === "sk")?.active).toMatchObject({
			entry: { sha256: sk.sha256, release: 1 },
			pageCount: 3,
		});
		expect(view.fitment.active).toMatchObject({
			entry: { sha256: fitment.sha256 },
			datasetHash: fitment.datasetHash,
		});
	});

	it("does not take the restored set for a manifest: the first request for the pointer is unconditional", async () => {
		releaseOne();
		await pass();
		restart();
		world.cfm.forget();

		await pass();

		const asked = world.cfm.hits.find((hit) => hit.url.endsWith("MANIFEST.json"));
		expect(asked?.headers["if-none-match"]).toBeUndefined();
		expect(inspectRelease().manifest).toMatchObject({ outcome: "new", version: 1 });
	});

	it("fetches only what changed when the manifest is reachable, and keeps the rest from disk", async () => {
		const { de, fitment } = releaseOne();
		await pass();
		restart();
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});
		world.cfm.forget();

		await pass();

		expect(serving("sk", "sk")).toBe("sk/b/0");
		expect(world.cfm.count(skB.name)).toBe(1);
		expect(world.cfm.count(de.name)).toBe(0);
		expect(world.cfm.count(fitment.name)).toBe(0);
		expect(serving("de", "de")).toBe("de/a/0");
	});

	it("takes the release number of the manifest for bytes it already holds, without fetching them", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		restart();
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 7 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});
		world.cfm.forget();

		await pass();

		expect(inspectRelease().targets.find((target) => target.market === "sk")?.active?.entry.release).toBe(7);
		expect(world.cfm.count(sk.name)).toBe(0);
	});

	it("keeps the restored file when the manifest names a newer one that cannot be fetched, and says why", async () => {
		const { de, fitment } = releaseOne();
		await pass();
		restart();
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});
		world.cfm.override(skB.name, () => httpStatus(404));

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(inspectRelease().targets.find((target) => target.market === "sk")).toMatchObject({
			fault: { code: "file_unreachable" },
			desired: { sha256: skB.sha256 },
		});
	});

	it("does not bring back a dataset CFM has replaced: what is kept is the one that was in use, not the first one", async () => {
		const { sk, de } = releaseOne();
		await pass();
		const replacement = fitmentFile("3.0.0-test.2");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 1 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: replacement, release: 2 },
		});
		await pass();
		restart();
		cfmDown();

		await pass();

		expect(releasedFitment()?.dataset.datasetVersion).toBe("3.0.0-test.2");
		expect(releasedFitment()?.dataset.datasetHash).toBe(replacement.datasetHash);
	});
});

describe("what a render sees after a restart", () => {
	const OLDER_URL = "https://carfitmanager.test/fitment.json";

	/** A fresh provider, as `provider.release.test.ts` takes one: its loader is memoised per module. */
	async function freshProvider() {
		vi.resetModules();
		const provider = await import("@/lib/fitment/provider");
		provider.__resetFitmentMemo();
		return provider;
	}

	it("serves the restored dataset instead of the older setting's, which may be the one CFM has withdrawn", async () => {
		const withdrawn = fitmentFile("3.0.0-withdrawn.1");
		process.env.MAKY_FITMENT_PROVIDER = "http";
		process.env.MAKY_FITMENT_URL = OLDER_URL;
		world.cfm.override(OLDER_URL, () => respond(withdrawn.bytes));
		releaseOne({ fitment: fitmentFile("3.0.0-current.1") });
		await pass();
		restart();
		cfmDown();
		await pass();
		const { loadFitmentDataset } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(status).toMatchObject({ mode: "release", datasetVersion: "3.0.0-current.1" });
		expect(dataset?.datasetVersion).toBe("3.0.0-current.1");
		expect(world.cfm.count(OLDER_URL)).toBe(0);
	});

	it("is exactly what the older setting would have answered, when no cache directory is named: the contrast that shows what the cache is for", async () => {
		delete process.env.MAKY_RELEASE_CACHE_DIR;
		const withdrawn = fitmentFile("3.0.0-withdrawn.1");
		process.env.MAKY_FITMENT_PROVIDER = "http";
		process.env.MAKY_FITMENT_URL = OLDER_URL;
		world.cfm.override(OLDER_URL, () => respond(withdrawn.bytes));
		releaseOne({ fitment: fitmentFile("3.0.0-current.1") });
		await pass();
		restart();
		cfmDown();
		await pass();
		const { loadFitmentDataset } = await freshProvider();

		const { status } = await loadFitmentDataset();

		expect(status).toMatchObject({ mode: "http", datasetVersion: "3.0.0-withdrawn.1" });
	});

	it("serves the restored text of a market instead of the older setting's file", async () => {
		await writeFile(join(root, "maky_catalog_content_sk.json"), contentFile("sk", "legacy").bytes);
		process.env.MAKY_CATALOG_CONTENT_PATH = join(root, "maky_catalog_content_{lang}.json");
		releaseOne({ sk: contentFile("sk", "approved") });
		await pass();
		restart();
		cfmDown();
		await pass();
		resetCatalogContentCache();

		const load = await loadCatalogContent("sk", "sk");

		expect(load.status).toMatchObject({ mode: "release" });
		expect(load.snapshot?.pages[0]?.intro?.blocks[0]).toMatchObject({ data: { text: "sk/approved/0" } });
	});
});

describe("when no cache directory is named", () => {
	it("writes nothing and restores nothing: a restart forgets, as it always did", async () => {
		delete process.env.MAKY_RELEASE_CACHE_DIR;
		releaseOne();
		await pass();
		expect(await readdir(root)).toEqual([]);

		restart();
		cfmDown();
		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(releasedFitment()).toBeNull();
		expect(await readdir(root)).toEqual([]);
	});
});

describe("what is written, and when", () => {
	it("keeps each verified file once under the name CFM gave it, and records the set in use", async () => {
		const { sk, de, fitment } = releaseOne();

		await pass();

		expect(await listing()).toEqual([ACTIVE_FILE, de.name, fitment.name, sk.name].sort());
		const recorded = await readActive(cacheDir);
		expect(Object.keys(recorded?.content ?? {}).sort()).toEqual(["at", "de", "sk"]);
		expect(recorded?.content.de?.file).toBe(de.name);
		expect(recorded?.content.at?.file).toBe(de.name);
		expect(recorded?.fitment).toMatchObject({ file: fitment.name, datasetHash: fitment.datasetHash });
		expect(recorded?.manifestVersion).toBe(1);
	});

	it("keeps the bytes it verified, not a copy that merely resembles them", async () => {
		const { sk, fitment } = releaseOne();

		await pass();

		expect(new Uint8Array(await readFile(kept(sk.name)))).toEqual(sk.bytes);
		expect(new Uint8Array(await readFile(kept(fitment.name)))).toEqual(fitment.bytes);
	});

	it("never keeps bytes that failed verification, and records nothing for a target that has none in use", async () => {
		const sk = contentFile("sk", "a");
		const fitment = fitmentFile("3.0.0-test.1");
		releaseOne({ sk, fitment });
		world.cfm.override(sk.name, () => respond(flip(sk.bytes)));
		world.cfm.override(fitment.name, () => respond(flip(fitment.bytes)));

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(await listing()).not.toContain(sk.name);
		expect(await listing()).not.toContain(fitment.name);
		const recorded = await readActive(cacheDir);
		expect(Object.keys(recorded?.content ?? {}).sort()).toEqual(["at", "de"]);
		expect(recorded?.fitment).toBeNull();
	});

	it("names in the record only the files it managed to keep, so a restart never looks for one that is not there", async () => {
		const { sk, de, fitment } = releaseOne();
		// A directory where the file should go: this one write fails, and no other does.
		await mkdir(kept(sk.name), { recursive: true });

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		const recorded = await readActive(cacheDir);
		expect(Object.keys(recorded?.content ?? {}).sort()).toEqual(["at", "de"]);
		expect(recorded?.fitment?.file).toBe(fitment.name);
		expect(await exists(kept(de.name))).toBe(true);

		restart();
		cfmDown();
		warn.mockClear();
		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(serving("de", "de")).toBe("de/a/0");
		expect(warn.mock.calls.filter(([line]) => String(line).includes("not restored"))).toEqual([]);
	});

	it("records what is IN USE, not what the manifest wants: a newer file that fails leaves the record as it was", async () => {
		const { de, fitment } = releaseOne();
		await pass();
		const before = await readFile(kept(ACTIVE_FILE), "utf8");
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});
		world.cfm.override(skB.name, () => respond(flip(skB.bytes)));

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(await readFile(kept(ACTIVE_FILE), "utf8")).toBe(before);
		expect(await listing()).not.toContain(skB.name);
	});

	it("leaves the record alone when a poll finds nothing new", async () => {
		releaseOne();
		await pass();
		await ageFile(kept(ACTIVE_FILE), 10 * HOUR);
		const written = (await stat(kept(ACTIVE_FILE))).mtimeMs;
		world.clock.now += 60_000;

		await pass();
		await pass();

		expect((await stat(kept(ACTIVE_FILE))).mtimeMs).toBe(written);
	});

	it("records a new release number for bytes it already holds, without writing those bytes again", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		await ageFile(kept(sk.name), 10 * HOUR);
		const writtenBefore = (await stat(kept(sk.name))).mtimeMs;
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: sk, release: 9 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});

		await pass();

		expect((await readActive(cacheDir))?.content.sk?.release).toBe(9);
		expect((await readActive(cacheDir))?.manifestVersion).toBe(2);
		expect((await stat(kept(sk.name))).mtimeMs).toBe(writtenBefore);
	});

	it("does not record an empty state over a good record: a boot that has verified nothing yet is not news", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		const before = await readFile(kept(ACTIVE_FILE), "utf8");
		for (const file of [sk, de, fitment]) await rm(kept(file.name));
		restart();
		cfmDown();

		await pass();
		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(await readFile(kept(ACTIVE_FILE), "utf8")).toBe(before);
	});

	it("does not record an empty set over a good record when every write failed", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		const before = await readFile(kept(ACTIVE_FILE), "utf8");
		for (const file of [sk, de, fitment]) {
			await rm(kept(file.name));
			// A directory where each file should go: every write below fails, and the network still works.
			await mkdir(kept(file.name));
		}
		restart();

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(await readFile(kept(ACTIVE_FILE), "utf8")).toBe(before);
	});

	it("removes the files a newer release no longer uses once they are old, and keeps the ones in use", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		await ageFile(kept(sk.name), 2 * HOUR);
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});

		await pass();

		expect(await listing()).toEqual([ACTIVE_FILE, de.name, fitment.name, skB.name].sort());
		expect((await readActive(cacheDir))?.content.sk?.file).toBe(skB.name);
	});

	it("keeps a file that is not old enough to be sure nothing is about to read it", async () => {
		const { sk, de, fitment } = releaseOne();
		await pass();
		await ageFile(kept(sk.name), HOUR / 6);
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});

		await pass();

		expect(await listing()).toContain(sk.name);
		expect(await listing()).toContain(skB.name);
	});

	it("never touches anything in the directory it was given that it did not write", async () => {
		await mkdir(cacheDir, { recursive: true });
		const foreign = join(cacheDir, "somebody-elses.json");
		await writeFile(foreign, "{}");
		const { de, fitment } = releaseOne();
		await pass();
		const notes = kept("notes.txt");
		await writeFile(notes, "keep me");
		for (const path of [foreign, notes]) await ageFile(path, 10 * HOUR);
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});

		await pass();

		expect(await exists(foreign)).toBe(true);
		expect(await exists(notes)).toBe(true);
	});

	it("is private: the files are 600 and the cache's own directory is 700", async () => {
		const { sk } = releaseOne();

		await pass();

		expect((await stat(kept(sk.name))).mode & 0o777).toBe(0o600);
		expect((await stat(kept(ACTIVE_FILE))).mode & 0o777).toBe(0o600);
		expect((await stat(kept())).mode & 0o777).toBe(0o700);
	});
});

describe("what is on disk is checked, not believed", () => {
	it("restores nothing for a file that was changed on disk, even to the same size, and restores the rest", async () => {
		const { de } = releaseOne();
		await pass();
		await writeFile(kept(de.name), flip(de.bytes));
		restart();
		cfmDown();

		await pass();

		expect(serving("de", "de")).toBeUndefined();
		expect(serving("at", "de")).toBeUndefined();
		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(releasedFitment()).not.toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cache: not restored: de,at .*sha256/));
	});

	it("does not forget what it could not take back: the record still names a damaged file after the restore", async () => {
		const { de } = releaseOne();
		await pass();
		await writeFile(kept(de.name), flip(de.bytes));
		const before = await readFile(kept(ACTIVE_FILE), "utf8");
		restart();
		cfmDown();

		await pass();
		await pass();

		expect(serving("de", "de")).toBeUndefined();
		expect(await readFile(kept(ACTIVE_FILE), "utf8")).toBe(before);
	});

	it("repairs a damaged file the next time CFM can be reached: fetched, verified, kept again and recorded", async () => {
		const { de } = releaseOne();
		await pass();
		await writeFile(kept(de.name), flip(de.bytes));
		restart();

		await pass();

		expect(serving("de", "de")).toBe("de/a/0");
		expect(new Uint8Array(await readFile(kept(de.name)))).toEqual(de.bytes);
		restart();
		cfmDown();
		await pass();
		expect(serving("de", "de")).toBe("de/a/0");
	});

	it("restores nothing for a file that was cut short", async () => {
		const { sk } = releaseOne();
		await pass();
		await writeFile(kept(sk.name), sk.bytes.slice(0, sk.bytes.byteLength - 5));
		restart();
		cfmDown();

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(warn).toHaveBeenCalledWith(
			expect.stringMatching(/the kept file is \d+ bytes, the entry says \d+/),
		);
	});

	it("restores nothing for a file that is gone, and does not mind", async () => {
		const { sk } = releaseOne();
		await pass();
		await rm(kept(sk.name));
		restart();
		cfmDown();

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(serving("de", "de")).toBe("de/a/0");
	});

	it("restores a dataset that was damaged on disk as nothing at all, and says so", async () => {
		const { fitment } = releaseOne();
		await pass();
		await writeFile(kept(fitment.name), flip(fitment.bytes));
		restart();
		cfmDown();

		await pass();

		expect(releasedFitment()).toBeNull();
		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cache: not restored: fitment/));
	});

	it("ignores a record that is not a record, with one warning, and starts as it does without a cache", async () => {
		releaseOne();
		await pass();
		await writeFile(kept(ACTIVE_FILE), "{ truncated");
		restart();
		cfmDown();

		await pass();
		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(releasedFitment()).toBeNull();
		expect(warn.mock.calls.filter(([line]) => String(line).includes("ACTIVE.json is not JSON"))).toHaveLength(
			1,
		);
	});

	it("refuses a record that gives a market the wrong language for the file it names", async () => {
		const sk = contentFile("sk", "a");
		await storeFile(cacheDir, sk.name, sk.bytes);
		await writeActive(cacheDir, {
			manifestVersion: 1,
			content: {
				de: {
					market: "de",
					language: "de",
					file: sk.name,
					sha256: sk.sha256,
					bytes: sk.bytes.byteLength,
					release: 1,
					pages: 3,
				},
			},
			fitment: null,
		});
		cfmDown();

		await pass();

		expect(serving("de", "de")).toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/de: .*"sk".*"de"/));
	});

	it("refuses a record for a market this storefront does not serve", async () => {
		const sk = contentFile("sk", "a");
		await storeFile(cacheDir, sk.name, sk.bytes);
		await writeActive(cacheDir, {
			manifestVersion: 1,
			content: {
				xx: {
					market: "xx",
					language: "sk",
					file: sk.name,
					sha256: sk.sha256,
					bytes: sk.bytes.byteLength,
					release: 1,
					pages: 3,
				},
			},
			fitment: null,
		});
		cfmDown();

		await pass();

		expect(releasedContent("xx", "sk")).toBeNull();
		expect(inspectRelease().targets.map((target) => target.market)).not.toContain("xx");
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/xx: /));
	});

	it("refuses a record that claims another page count than the file holds", async () => {
		const sk = contentFile("sk", "a");
		await storeFile(cacheDir, sk.name, sk.bytes);
		await writeActive(cacheDir, {
			manifestVersion: 1,
			content: {
				sk: {
					market: "sk",
					language: "sk",
					file: sk.name,
					sha256: sk.sha256,
					bytes: sk.bytes.byteLength,
					release: 1,
					pages: 99,
				},
			},
			fitment: null,
		});
		cfmDown();

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/sk: .*3 pages.*99/));
	});

	it("refuses a record that names a dataset hash the file does not have, because the dataset must be the approved one", async () => {
		const fitment = fitmentFile("3.0.0-test.1");
		await storeFile(cacheDir, fitment.name, fitment.bytes);
		await writeActive(cacheDir, {
			manifestVersion: 1,
			content: {},
			fitment: {
				file: fitment.name,
				sha256: fitment.sha256,
				bytes: fitment.bytes.byteLength,
				release: 1,
				schemaVersion: fitment.schemaVersion,
				datasetVersion: fitment.datasetVersion,
				datasetHash: "d".repeat(64),
			},
		});
		cfmDown();

		await pass();

		expect(releasedFitment()).toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cache: not restored: fitment/));
	});

	it("refuses a dataset that was verified for another Saleor instance than the one this deploy talks to", async () => {
		releaseOne();
		await pass();
		restart();
		cfmDown();
		process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://some-other-saleor.example/graphql/";

		await pass();

		expect(releasedFitment()).toBeNull();
		expect(serving("sk", "sk")).toBe("sk/a/0");
	});

	it("takes nothing from the directory when a restart finds it empty or missing", async () => {
		cfmDown();

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(releasedFitment()).toBeNull();
		expect(await exists(cacheDir)).toBe(false);
	});
});

describe("a cache that cannot be written is a log line, not a failure", () => {
	/** A path below a regular file: it cannot be created, as root or not. */
	async function unwritable(): Promise<string> {
		const blocker = join(root, "a-file");
		await writeFile(blocker, "not a directory");
		return join(blocker, "cache");
	}

	it("still takes every verified file into use, and reports nothing as failed", async () => {
		process.env.MAKY_RELEASE_CACHE_DIR = await unwritable();
		releaseOne();

		await pass();

		expect(serving("sk", "sk")).toBe("sk/a/0");
		expect(serving("de", "de")).toBe("de/a/0");
		expect(releasedFitment()).not.toBeNull();
		const view = inspectRelease();
		expect(view.targets.map((target) => target.fault)).toEqual([null, null, null]);
		expect(view.fitment.fault).toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cache: .* not kept for the next boot/));
	});

	it("says it once per file, not once per poll", async () => {
		process.env.MAKY_RELEASE_CACHE_DIR = await unwritable();
		releaseOne();
		await pass();
		const lines = () =>
			warn.mock.calls.filter(([line]) => String(line).includes("not kept for the next boot")).length;
		const first = lines();

		world.clock.now += 60_000;
		await pass();
		await pass();

		expect(first).toBeGreaterThan(0);
		expect(lines()).toBe(first);
	});

	it("still follows a newer manifest afterwards", async () => {
		process.env.MAKY_RELEASE_CACHE_DIR = await unwritable();
		const { de, fitment } = releaseOne();
		await pass();
		const skB = contentFile("sk", "b");
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: skB, release: 2 }, de: { file: de, release: 1 }, at: { file: de, release: 1 } },
			fitment: { file: fitment, release: 1 },
		});

		await pass();

		expect(serving("sk", "sk")).toBe("sk/b/0");
	});

	it("restores nothing from a directory that cannot even be read, with one warning, and carries on", async () => {
		process.env.MAKY_RELEASE_CACHE_DIR = await unwritable();
		cfmDown();

		await pass();

		expect(serving("sk", "sk")).toBeUndefined();
		expect(inspectRelease().manifest.fault?.code).toBe("manifest_unreachable");
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cache: .*; nothing restored/));
	});
});
