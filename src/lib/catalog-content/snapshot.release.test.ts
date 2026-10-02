import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type Harness,
	arrangeRelease,
	contentFile,
	respond,
	status as httpStatus,
} from "@/lib/catalog-release/fixtures/fake-cfm";
import { releaseSyncOnce, releasedContent } from "@/lib/catalog-release/sync";

import {
	type CatalogContentLoad,
	loadCatalogContent,
	peekCatalogContent,
	resetCatalogContentCache,
} from "./snapshot";

/**
 * The loader as a render sees it, with a release manifest in play.
 *
 * The promise being tested is a handover: a market is answered by the older `MAKY_CATALOG_CONTENT_*`
 * settings until the manifest has verified a file for THAT MARKET, and by the manifest after that, for good.
 * Switching a deploy over must change nothing a visitor sees, and nothing may ever send a market back to a
 * file that is older than the one it already shows.
 */

let world: Harness;
let dir: string;

beforeEach(() => {
	world = arrangeRelease();
	dir = mkdtempSync(join(tmpdir(), "catalog-release-"));
	resetCatalogContentCache();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	resetCatalogContentCache();
	world.restore();
	rmSync(dir, { recursive: true, force: true });
});

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** An older-settings family, `{lang}` in the path, with one language's file written. */
function olderSetting(languages: readonly string[], edition = "legacy"): void {
	for (const language of languages) {
		writeFileSync(join(dir, `maky_catalog_content_${language}.json`), contentFile(language, edition).bytes);
	}
	process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "maky_catalog_content_{lang}.json");
}

/** Which edition of the text a load holds; `contentFile` writes `<language>/<edition>/<n>` into the first page. */
function text(load: CatalogContentLoad): string | undefined {
	const block = load.snapshot?.pages[0]?.intro?.blocks[0] as { data: { text: string } } | undefined;
	return block?.data.text;
}

describe("before the manifest has verified a file for a market", () => {
	it("the older setting answers, so nothing a visitor sees changes when release mode is switched on", async () => {
		olderSetting(["de"]);

		const load = await loadCatalogContent("de", "de");

		expect(load.status).toMatchObject({ mode: "file", unavailableReason: null });
		expect(text(load)).toBe("de/legacy/0");
	});

	it("keeps the older setting's own reason when it is configured but cannot be read, rather than blaming the release", async () => {
		process.env.MAKY_CATALOG_CONTENT_PATH = join(dir, "does-not-exist-{lang}.json");

		const load = await loadCatalogContent("de", "de");

		expect(load.snapshot).toBeNull();
		expect(load.status.mode).toBe("file");
		expect(load.status.unavailableReason).toMatch(/^unreadable/);
	});

	it("does not wait for a pass that is still downloading, and takes the release the moment it is verified", async () => {
		olderSetting(["de"]);
		const fresh = contentFile("de", "fresh");
		let open!: () => void;
		const gate = new Promise<void>((resolve) => (open = resolve));
		world.cfm.publish({ version: 1, targets: { de: { file: fresh, release: 1 } } });
		world.cfm.override(fresh.name, async () => {
			await gate;
			return respond(fresh.bytes);
		});

		const running = releaseSyncOnce();
		await tick();
		await tick();
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/legacy/0");

		open();
		await running;
		const after = await loadCatalogContent("de", "de");
		expect(after.status).toMatchObject({ mode: "release", sha256: fresh.sha256 });
		expect(text(after)).toBe("de/fresh/0");
	});

	it("keeps answering a market the manifest has not verified from the older setting, while another one moves on", async () => {
		olderSetting(["de"]);
		world.cfm.publish({ version: 1, targets: { de: { file: contentFile("de", "germany"), release: 1 } } });
		await releaseSyncOnce();

		expect(text(await loadCatalogContent("de", "de"))).toBe("de/germany/0");
		// Austria reads the same language and has no verified file yet: it is still on the older one.
		expect(text(await loadCatalogContent("de", "at"))).toBe("de/legacy/0");
	});

	it("serves what the manifest verified for a market, and not what the older setting holds, as soon as there is one", async () => {
		olderSetting(["sk"], "older");
		world.cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk", "approved"), release: 1 } } });
		await releaseSyncOnce();

		const load = await loadCatalogContent("sk", "sk");

		expect(load.status.mode).toBe("release");
		expect(text(load)).toBe("sk/approved/0");
	});
});

describe("once a market has had a verified file", () => {
	it("is answered by the release for good: the older setting is not consulted again, whatever it holds", async () => {
		olderSetting(["de"]);
		world.cfm.publish({ version: 1, targets: { de: { file: contentFile("de", "approved"), release: 1 } } });
		await releaseSyncOnce();
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/approved/0");

		// The older file changes, then disappears. Neither is the release's business.
		olderSetting(["de"], "newer-but-not-approved");
		resetCatalogContentCache();
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/approved/0");
		rmSync(join(dir, "maky_catalog_content_de.json"));
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/approved/0");
	});

	it("is not sent back to the older setting when the manifest later cannot be read", async () => {
		olderSetting(["de"], "older");
		world.cfm.publish({ version: 1, targets: { de: { file: contentFile("de", "approved"), release: 1 } } });
		await releaseSyncOnce();

		world.cfm.override("MANIFEST.json", () => httpStatus(503));
		await releaseSyncOnce();

		expect(releasedContent("de", "de")).not.toBeNull();
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/approved/0");
	});

	it("gives Germany and Austria different files when the manifest does, though they read one language", async () => {
		world.cfm.publish({
			version: 1,
			targets: {
				de: { file: contentFile("de", "germany"), release: 1 },
				at: { file: contentFile("de", "austria"), release: 1 },
			},
		});
		await releaseSyncOnce();

		expect(text(await loadCatalogContent("de", "de"))).toBe("de/germany/0");
		expect(text(await loadCatalogContent("de", "at"))).toBe("de/austria/0");
	});

	it("is never answered in a language the market does not read", async () => {
		world.cfm.publish({ version: 1, targets: { sk: { file: contentFile("sk"), release: 1 } } });
		await releaseSyncOnce();

		const wrong = await loadCatalogContent("de", "sk");

		expect(wrong.snapshot).toBeNull();
	});

	it("keeps its old meaning for a call that names no market: by language alone, from the older setting", async () => {
		olderSetting(["de"]);
		world.cfm.publish({ version: 1, targets: { de: { file: contentFile("de", "approved"), release: 1 } } });
		await releaseSyncOnce();

		// This is the call a forgotten call site would make, which is why `release-call-sites.test.ts` exists.
		expect(text(await loadCatalogContent("de"))).toBe("de/legacy/0");
	});
});

describe("with no older setting at all", () => {
	it("says what the market is waiting for, not that no source is configured", async () => {
		const load = await loadCatalogContent("de", "de");

		expect(load.snapshot).toBeNull();
		expect(load.status.mode).toBe("release");
		expect(load.status.unavailableReason).toBe('waiting for the first verified release of market "de"');
	});

	it("answers from the release as soon as the manifest has verified a file", async () => {
		world.cfm.publish({ version: 1, targets: { de: { file: contentFile("de", "approved"), release: 1 } } });
		await releaseSyncOnce();

		expect(text(await loadCatalogContent("de", "de"))).toBe("de/approved/0");
	});

	it("still reports the old reason for a call that names no market", async () => {
		const load = await loadCatalogContent("de");

		expect(load.snapshot).toBeNull();
		expect(load.status.unavailableReason).toContain("no MAKY_CATALOG_CONTENT_PATH");
	});

	it("does not report waiting for a language that cannot be a language", async () => {
		const load = await loadCatalogContent("../de", "de");

		expect(load.status.unavailableReason).toContain("unsupported language");
	});
});

describe("with release mode off", () => {
	beforeEach(() => {
		delete process.env.MAKY_RELEASE_MANIFEST_URL;
	});

	it("ignores the market and answers exactly as before, from the older setting", async () => {
		olderSetting(["de"]);

		const load = await loadCatalogContent("de", "de");

		expect(load.status.mode).toBe("file");
		expect(text(load)).toBe("de/legacy/0");
	});

	it("keeps the old reason when there is nothing to answer from, rather than waiting for a release that is not coming", async () => {
		const load = await loadCatalogContent("de", "de");

		expect(load.status.mode).toBe("disabled");
		expect(load.status.unavailableReason).toContain("no MAKY_CATALOG_CONTENT_PATH");
	});
});

describe("looking at the older setting without loading it", () => {
	it("is empty until something has loaded, even when the file is right there", async () => {
		olderSetting(["de"]);

		expect(peekCatalogContent("de")).toBeNull();
		expect(text(await loadCatalogContent("de", "de"))).toBe("de/legacy/0");
		expect(peekCatalogContent("de")).toMatchObject({ mode: "file", language: "de", pageCount: 3 });
	});

	it("says nothing for a language that was never loaded, one that cannot be one, or no setting", async () => {
		olderSetting(["de"]);
		await loadCatalogContent("de", "de");

		expect(peekCatalogContent("sk")).toBeNull();
		expect(peekCatalogContent("../de")).toBeNull();
		delete process.env.MAKY_CATALOG_CONTENT_PATH;
		expect(peekCatalogContent("de")).toBeNull();
	});
});
