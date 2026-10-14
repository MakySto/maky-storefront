import { existsSync, statSync, utimesSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { main } from "../../scripts/ops/slim-next-dir.mjs";

/**
 * `scripts/ops/slim-next-dir.mjs` on a small `.next` that has the shape of a real one: the pages the build
 * made, the files that are not pages, what the server wrote while it ran, and the caches.
 */

let root: string;
let snapshot: string;

async function put(relative: string, content = "x") {
	const path = join(snapshot, relative);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content);
}

/** The route `/cz-czk/produkt-1` rendered at run time: what a server leaves for one page it never prerendered. */
const RUNTIME_PAGES = [
	"server/app/cz-czk/produkt-1.html",
	"server/app/cz-czk/produkt-1.meta",
	"server/app/cz-czk/produkt-1.segments/_tree.segment.rsc",
	"server/app/cz-czk/produkt-1.segments/_full.segment.rsc",
	// A runtime page next to the build's own files: its directory stays.
	"server/app/sk-eur/produkt-9.html",
	"server/app/sk-eur/produkt-9.meta",
];

const BUILD_PAGES = [
	"server/app/index.html",
	"server/app/index.meta",
	"server/app/index.rsc",
	"server/app/index.segments/_tree.segment.rsc",
	"server/app/sk-eur.html",
	"server/app/sk-eur.meta",
	"server/app/sk-eur/cookies.html",
	"server/app/sk-eur/cookies.meta",
	"server/app/robots.txt.body",
	"server/app/robots.txt.meta",
	"server/app/sk-eur/[productSlug].html",
	"server/app/sk-eur/[productSlug].meta",
	"server/app/[channel]/account.html",
	"server/app/[channel]/account.meta",
];

/** Everything under server/app that is not a page-cache file: never touched. */
const BUILD_OTHER = [
	"server/app/sk-eur/cookies/page.js",
	"server/app/sk-eur/cookies/page.js.map",
	"server/app/sk-eur/cookies/page_client-reference-manifest.js",
	"server/app/[channel]/account/page.js",
	"server/app/sk-eur/[productSlug]/page.js.nft.json",
	"server/chunks/ssr/a.js",
	"static/chunks/a.js",
	"required-server-files.json",
	"MAKY_DEPLOY_META",
];

const KEPT_CACHE = ["cache/fetch-cache/0123abcd"];
const REMOVED_CACHE = [
	"cache/images/key1/60.1.etag.up.webp",
	"cache/images/key2/60.1.etag.up.avif",
	"cache/turbopack/00001.sst",
];

async function run(...argv: string[]) {
	const out: string[] = [];
	const err: string[] = [];
	const code = main(
		argv,
		(line: string) => out.push(line),
		(line: string) => err.push(line),
	) as number;
	return { code, out: out.join("\n"), err: err.join("\n") };
}

async function allFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
		.sort();
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "slim-next-"));
	snapshot = join(root, ".next.rollback-abc1234-BUILD-20261012T000000Z");
	await put("BUILD_ID", "BUILD");
	await put(
		"prerender-manifest.json",
		JSON.stringify({
			version: 4,
			routes: { "/": {}, "/sk-eur": {}, "/sk-eur/cookies": {}, "/robots.txt": {} },
			dynamicRoutes: { "/sk-eur/[productSlug]": {}, "/[channel]/account": {} },
		}),
	);
	for (const file of [...RUNTIME_PAGES, ...BUILD_PAGES, ...BUILD_OTHER, ...KEPT_CACHE, ...REMOVED_CACHE]) {
		await put(file, "0123456789");
	}
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("slim-next-dir.mjs", () => {
	it("says what it would remove and removes nothing without --apply", async () => {
		const before = await allFiles(snapshot);

		const { code, out } = await run(snapshot);

		expect(code).toBe(0);
		expect(await allFiles(snapshot)).toEqual(before);
		expect(out).toContain("dry run");
		expect(out).toContain(`would remove ${RUNTIME_PAGES.length} files`);
		expect(out).toContain("would remove 2 files"); // cache/images
		expect(out).toContain("would remove 1 files"); // cache/turbopack
		expect(out).toContain(`kept ${BUILD_PAGES.length} files`);
	});

	it("removes the pages the build never made, the image cache and the compile cache, and nothing else", async () => {
		const { code, out } = await run(snapshot, "--apply");

		expect(code).toBe(0);
		expect(out).toContain("freed");
		const left = new Set(await allFiles(snapshot));
		for (const file of [...RUNTIME_PAGES, ...REMOVED_CACHE]) expect(left.has(file), file).toBe(false);
		for (const file of [
			...BUILD_PAGES,
			...BUILD_OTHER,
			...KEPT_CACHE,
			"BUILD_ID",
			"prerender-manifest.json",
		]) {
			expect(left.has(file), file).toBe(true);
		}
	});

	it("removes the directories the runtime pages leave empty, and keeps the ones that hold the build's files", async () => {
		await run(snapshot, "--apply");

		expect(existsSync(join(snapshot, "server/app/cz-czk"))).toBe(false);
		expect(existsSync(join(snapshot, "server/app/sk-eur"))).toBe(true);
		expect(existsSync(join(snapshot, "server/app"))).toBe(true);
		expect(existsSync(join(snapshot, "cache/images"))).toBe(false);
		expect(existsSync(join(snapshot, "cache/fetch-cache"))).toBe(true);
	});

	it("does not change the snapshot's own modification time, which orders the snapshots for pruning", async () => {
		const old = new Date("2026-10-01T10:00:00Z");
		utimesSync(snapshot, old, old);

		await run(snapshot, "--apply");

		expect(statSync(snapshot).mtime.getTime()).toBe(old.getTime());
	});

	it("is done after one run", async () => {
		await run(snapshot, "--apply");
		const left = await allFiles(snapshot);

		const { code, out } = await run(snapshot, "--apply");

		expect(code).toBe(0);
		expect(out).toContain("removed 0 files, 0.0 MB");
		expect(await allFiles(snapshot)).toEqual(left);
	});

	it.each([
		["a directory without BUILD_ID", async () => rm(join(snapshot, "BUILD_ID")), /no BUILD_ID/],
		[
			"a directory without a manifest",
			async () => rm(join(snapshot, "prerender-manifest.json")),
			/cannot be read/,
		],
		[
			"a directory without server/app",
			async () => rm(join(snapshot, "server/app"), { recursive: true }),
			/no server\/app/,
		],
	])("refuses %s", async (_name, break_, message) => {
		await break_();
		const before = await allFiles(snapshot);

		const { code, err } = await run(snapshot, "--apply");

		expect(code).toBe(2);
		expect(err).toMatch(message);
		expect(await allFiles(snapshot)).toEqual(before);
	});

	it("refuses a directory named .next: that is the one a server serves", async () => {
		const live = join(root, ".next");
		await mkdir(live);
		await writeFile(join(live, "BUILD_ID"), "x");

		const { code, err } = await run(live, "--apply");

		expect(code).toBe(2);
		expect(err).toContain("is named .next");
	});

	it("refuses when the manifest and the files do not belong together, so a renamed layout is never read as 'all runtime'", async () => {
		await writeFile(
			join(snapshot, "prerender-manifest.json"),
			JSON.stringify({
				routes: { "/a": {}, "/b": {}, "/c": {}, "/d": {}, "/e": {} },
				dynamicRoutes: {},
			}),
		);
		const before = await allFiles(snapshot);

		const { code, err } = await run(snapshot, "--apply");

		expect(code).toBe(2);
		expect(err).toContain("do not belong together");
		expect(await allFiles(snapshot)).toEqual(before);
	});

	it("asks for exactly one directory", async () => {
		expect((await run()).code).toBe(2);
		expect((await run(snapshot, "elsewhere")).code).toBe(2);
		expect((await run(snapshot, "--everything")).code).toBe(2);
	});
});
