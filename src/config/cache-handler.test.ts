import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants.js";
import FileSystemCacheModule from "next/dist/server/lib/incremental-cache/file-system-cache.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BuildFilesOnDiskCache, { isPossibleServerAction } from "../../cache-handler.mjs";
import { resolveNextConfig } from "../../next.config.js";

/**
 * `cache-handler.mjs` against the real `FileSystemCache` of the installed Next, on a real directory.
 * What these tests pin down is the one thing the handler exists for: after the build, the files under
 * `.next` are the build's own and no more, while a page it did not make is still served from memory.
 */

// Next's own file-system adapter (`next/dist/server/lib/node-fs-methods.js`), on a temporary directory.
const nodeFs = {
	readFile: (path: string, encoding?: BufferEncoding) =>
		encoding ? readFile(path, encoding) : readFile(path),
	writeFile: (path: string, data: string | Uint8Array) => writeFile(path, data),
	mkdir: (dir: string) => mkdir(dir, { recursive: true }),
	stat: (path: string) => stat(path),
};

type Handler = InstanceType<typeof BuildFilesOnDiskCache>;
type EntryData = Parameters<Handler["set"]>[1];
type SetContext = Parameters<Handler["set"]>[2];
type GetContext = Parameters<Handler["get"]>[1];

let root: string;
let serverDir: string;
let sequence = 0;

/** The memory LRU is static on the class and survives from one test to the next: every test uses keys of its own. */
function uniqueKey(prefix: string) {
	sequence += 1;
	return `${prefix}-${sequence}`;
}

function newCache(flushToDisk = true): Handler {
	return new BuildFilesOnDiskCache({
		dev: false,
		fs: nodeFs,
		flushToDisk,
		serverDistDir: serverDir,
		revalidatedTags: [],
		maxMemoryCacheSize: 8 * 1024 * 1024,
		_requestHeaders: {},
	});
}

function page(html: string, segment = "segment"): EntryData {
	return {
		kind: "APP_PAGE",
		html,
		rscData: undefined,
		postponed: "{}",
		headers: {},
		status: 200,
		segmentData: new Map([["/_index", Buffer.from(segment)]]),
	} as unknown as EntryData;
}

const PAGE_SET: SetContext = { isRoutePPREnabled: true, isFallback: false } as SetContext;
const PAGE_GET = { kind: "APP_PAGE", isRoutePPREnabled: true, isFallback: false } as unknown as GetContext;

async function filesUnder(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
	return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

/** What the build leaves for one prerendered page: the html, its meta and one segment. */
async function leaveSeed(key: string) {
	const html = join(serverDir, "app", `${key}.html`);
	await mkdir(dirname(html), { recursive: true });
	await writeFile(html, "<p>made by the build</p>");
	await writeFile(join(serverDir, "app", `${key}.meta`), JSON.stringify({ postponed: "{}", status: 200 }));
	return html;
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "cache-handler-"));
	serverDir = join(root, ".next", "server");
	await mkdir(join(serverDir, "app"), { recursive: true });
	vi.stubEnv("NEXT_PHASE", "");
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(root, { recursive: true, force: true });
});

describe("cache-handler.mjs while the server runs", () => {
	it("keeps a page the build did not make in memory and writes nothing to disk", async () => {
		const cache = newCache();
		const key = uniqueKey("/cz-czk/produkt");

		await cache.set(key, page("<p>rendered at run time</p>"), PAGE_SET);

		expect(await filesUnder(join(root, ".next"))).toEqual([]);
		const hit = await cache.get(key, PAGE_GET);
		expect(hit?.value).toMatchObject({ kind: "APP_PAGE", html: "<p>rendered at run time</p>" });
	});

	it("serves that page to the next instance as well, because the memory LRU is shared", async () => {
		const key = uniqueKey("/de-eur/produkt");
		await newCache().set(key, page("<p>shared</p>"), PAGE_SET);

		const hit = await newCache().get(key, PAGE_GET);

		expect(hit?.value).toMatchObject({ html: "<p>shared</p>" });
	});

	it("refreshes in place a page the build made, as the stock cache does", async () => {
		const key = uniqueKey("/sk-eur/seed");
		const html = await leaveSeed(key);
		const cache = newCache();

		await cache.set(key, page("<p>regenerated</p>", "new segment"), PAGE_SET);

		expect(await readFile(html, "utf8")).toBe("<p>regenerated</p>");
		expect(await readFile(join(serverDir, "app", `${key}.segments`, "_index.segment.rsc"), "utf8")).toBe(
			"new segment",
		);
		// ...and the set of files the build left is not extended by anything else.
		expect(
			(await filesUnder(join(serverDir, "app"))).map((file) => file.slice(serverDir.length)).sort(),
		).toEqual(
			[`${key}.html`, `${key}.meta`, `${key}.segments/_index.segment.rsc`].map((rel) => `/app${rel}`).sort(),
		);
	});

	it("reads a seed from disk, and keeps serving it from memory after the file is gone", async () => {
		const key = uniqueKey("/sk-eur/read");
		await leaveSeed(key);
		const cache = newCache();

		const first = await cache.get(key, PAGE_GET);
		await rm(join(serverDir, "app"), { recursive: true });
		const second = await cache.get(key, PAGE_GET);

		expect(first?.value).toMatchObject({ html: "<p>made by the build</p>" });
		expect(second?.value).toMatchObject({ html: "<p>made by the build</p>" });
	});

	it("treats a fetch result like a page: new keys stay in memory, a key the build made is refreshed", async () => {
		const cache = newCache();
		const fresh = uniqueKey("fetch-new");
		const made = uniqueKey("fetch-made");
		const fetchData = (body: string) =>
			({
				kind: "FETCH",
				data: { headers: {}, body, url: "https://api.maky.store/graphql/", status: 200 },
				revalidate: 300,
			}) as unknown as EntryData;
		const fetchContext = { fetchCache: true, tags: [], fetchIdx: 0, fetchUrl: "x" } as unknown as SetContext;
		const madeFile = join(root, ".next", "cache", "fetch-cache", made);
		await mkdir(dirname(madeFile), { recursive: true });
		await writeFile(madeFile, "{}");

		await cache.set(fresh, fetchData("new"), fetchContext);
		await cache.set(made, fetchData("refreshed"), fetchContext);

		expect(await filesUnder(join(root, ".next", "cache", "fetch-cache"))).toEqual([madeFile]);
		expect((JSON.parse(await readFile(madeFile, "utf8")) as { data: { body: string } }).data.body).toBe(
			"refreshed",
		);
	});

	it("treats a route handler's body the same way", async () => {
		const cache = newCache();
		const fresh = uniqueKey("/cz-czk/feed");
		const made = uniqueKey("/robots");
		const body = (text: string) =>
			({ kind: "APP_ROUTE", body: Buffer.from(text), headers: {}, status: 200 }) as unknown as EntryData;
		const madeFile = join(serverDir, "app", `${made}.body`);
		await mkdir(dirname(madeFile), { recursive: true });
		await writeFile(madeFile, "old");

		await cache.set(fresh, body("new"), PAGE_SET);
		await cache.set(made, body("refreshed"), PAGE_SET);

		expect((await filesUnder(join(serverDir, "app"))).sort()).toEqual(
			[madeFile, madeFile.replace(/\.body$/, ".meta")].sort(),
		);
		expect(await readFile(madeFile, "utf8")).toBe("refreshed");
	});

	it("writes nothing it does not recognise, and does not fail on it", async () => {
		const cache = newCache();

		await expect(
			cache.set(uniqueKey("/redirect"), { kind: "REDIRECT", props: {} } as unknown as EntryData, PAGE_SET),
		).resolves.toBeUndefined();
		await expect(cache.set(uniqueKey("/null"), null, PAGE_SET)).resolves.toBeUndefined();

		expect(await filesUnder(join(root, ".next"))).toEqual([]);
	});

	it("is still memory only when the file system cannot answer", async () => {
		const broken = new BuildFilesOnDiskCache({
			dev: false,
			fs: { ...nodeFs, stat: () => Promise.reject(new Error("EIO")) },
			flushToDisk: true,
			serverDistDir: serverDir,
			revalidatedTags: [],
			maxMemoryCacheSize: 8 * 1024 * 1024,
			_requestHeaders: {},
		});
		const key = uniqueKey("/sk-eur/broken");
		await leaveSeed(key);

		await broken.set(key, page("<p>kept in memory</p>"), PAGE_SET);

		expect(await readFile(join(serverDir, "app", `${key}.html`), "utf8")).toBe("<p>made by the build</p>");
		expect((await broken.get(key, PAGE_GET))?.value).toMatchObject({ html: "<p>kept in memory</p>" });
	});
});

/**
 * Next looks a page up for a Server Action too, and if the copy is stale it re-renders the page in the
 * background with the action's own request: two parsers on one body, "Unexpected end of form", a 500 on a
 * response whose action did run. The handler answers an action request with the page copy dated ahead of
 * now. Reproduced on Next 16.3.6 in a minimal app (stale copy: every action 500, fresh copy: every one 200),
 * and with this handler in that app every action answers 200 on a stale copy.
 */
describe("cache-handler.mjs and a Server Action on a stale page", () => {
	const HOUR = 60 * 60 * 1000;
	const FileSystemCache =
		(FileSystemCacheModule as unknown as { default?: unknown }).default ?? FileSystemCacheModule;
	const memoryCache = () =>
		(FileSystemCache as unknown as { memoryCache: { get(key: string): { lastModified: number } } })
			.memoryCache;

	function newCacheFor(headers: Record<string, string> | undefined): Handler {
		return new BuildFilesOnDiskCache({
			dev: false,
			fs: nodeFs,
			flushToDisk: false,
			serverDistDir: serverDir,
			revalidatedTags: [],
			maxMemoryCacheSize: 8 * 1024 * 1024,
			_requestHeaders: headers,
		});
	}

	/** A page kept in memory whose copy was made an hour ago. */
	async function oldPage(prefix: string) {
		const key = uniqueKey(prefix);
		await newCacheFor({}).set(key, page("<p>an hour old</p>"), PAGE_SET);
		memoryCache().get(key).lastModified = Date.now() - HOUR;
		return key;
	}

	it("returns the page copy dated ahead of now to a request with a Next-Action header", async () => {
		const key = await oldPage("/de-eur/produkt");

		const entry = await newCacheFor({ "next-action": "6012abcd" }).get(key, PAGE_GET);

		expect(entry?.lastModified).toBeGreaterThan(Date.now());
		expect(entry?.value).toMatchObject({ kind: "APP_PAGE", html: "<p>an hour old</p>", postponed: "{}" });
	});

	it("does the same for a form post without the header (a page submitted without JavaScript)", async () => {
		const key = await oldPage("/de-eur/formular");

		const multipart = await newCacheFor({ "content-type": "multipart/form-data; boundary=----x" }).get(
			key,
			PAGE_GET,
		);
		const urlencoded = await newCacheFor({ "content-type": "application/x-www-form-urlencoded" }).get(
			key,
			PAGE_GET,
		);

		expect(multipart?.lastModified).toBeGreaterThan(Date.now());
		expect(urlencoded?.lastModified).toBeGreaterThan(Date.now());
	});

	it("hands back a copy: the stored entry keeps its own age, so plain requests still see a stale page", async () => {
		const key = await oldPage("/de-eur/kopia");

		const forAction = await newCacheFor({ "next-action": "6012abcd" }).get(key, PAGE_GET);
		const forVisitor = await newCacheFor({ accept: "text/html" }).get(key, PAGE_GET);

		expect(forVisitor?.lastModified).toBeLessThan(Date.now() - HOUR / 2);
		expect(forVisitor).not.toBe(forAction);
		expect(forVisitor?.value).toBe(forAction?.value);
	});

	it.each([
		["no headers at all", undefined],
		["a plain visit", { accept: "text/html", "user-agent": "Googlebot" }],
		["an RSC navigation", { rsc: "1", "next-router-state-tree": "%5B%5D" }],
		["a JSON post that is not a form", { "content-type": "application/json" }],
		["an empty Next-Action header", { "next-action": "" }],
	])("leaves the page copy as it is for %s", async (_name, headers) => {
		const key = await oldPage("/de-eur/ostatne");

		const entry = await newCacheFor(headers).get(key, PAGE_GET);

		expect(entry?.lastModified).toBeLessThan(Date.now() - HOUR / 2);
	});

	it("touches only page copies: a fetch result keeps its own stamp for an action request too", async () => {
		const key = uniqueKey("fetch-for-action");
		const fetchData = {
			kind: "FETCH",
			data: { headers: {}, body: "x", url: "https://api.maky.store/graphql/", status: 200 },
			revalidate: 300,
		} as unknown as EntryData;
		await newCacheFor({}).set(key, fetchData, {
			fetchCache: true,
			tags: [],
			fetchIdx: 0,
			fetchUrl: "x",
		} as unknown as SetContext);
		memoryCache().get(key).lastModified = Date.now() - HOUR;

		const entry = await newCacheFor({ "next-action": "6012abcd" }).get(key, {
			kind: "FETCH",
			tags: [],
			softTags: [],
			fetchIdx: 0,
			fetchUrl: "x",
		} as unknown as GetContext);

		expect(entry?.lastModified).toBeLessThan(Date.now() - HOUR / 2);
	});

	it("answers nothing for a page it has not got, as before", async () => {
		await expect(
			newCacheFor({ "next-action": "6012abcd" }).get(uniqueKey("/de-eur/neznama"), PAGE_GET),
		).resolves.toBeNull();
	});

	it("recognises a possible Server Action the way Next does, by header or by form content type", () => {
		expect(isPossibleServerAction({ "next-action": "x" })).toBe(true);
		expect(isPossibleServerAction({ "content-type": "Multipart/Form-Data; boundary=b" })).toBe(true);
		expect(
			isPossibleServerAction({ "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }),
		).toBe(true);
		expect(isPossibleServerAction({ "content-type": "text/plain;charset=UTF-8" })).toBe(false);
		expect(isPossibleServerAction({ "content-type": "multipart/mixed" })).toBe(false);
		expect(isPossibleServerAction({})).toBe(false);
		expect(isPossibleServerAction(undefined)).toBe(false);
	});

	// The property Next's own code acts on: `isStale` on the entry of its IncrementalCache. Next schedules the
	// background re-render of the page when it is `true` or `-1` and the request is a Server Action.
	it("makes Next's IncrementalCache call the copy fresh for an action and stale for a plain request", async () => {
		(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
		const { IncrementalCache } = (await import(
			"next/dist/server/lib/incremental-cache/index.js"
		)) as unknown as {
			IncrementalCache: new (options: Record<string, unknown>) => {
				get(key: string, ctx: unknown): Promise<{ isStale?: boolean | -1 } | null>;
			};
		};
		const key = await oldPage("/de-eur/next");
		const lookup = (headers: Record<string, string>) =>
			new IncrementalCache({
				fs: nodeFs,
				dev: false,
				requestHeaders: headers,
				minimalMode: false,
				serverDistDir: serverDir,
				flushToDisk: false,
				maxMemoryCacheSize: 8 * 1024 * 1024,
				allowedRevalidateHeaderKeys: [],
				getPrerenderManifest: () => ({
					version: 4,
					routes: {},
					dynamicRoutes: {},
					notFoundRoutes: [],
					preview: { previewModeId: "id", previewModeSigningKey: "key", previewModeEncryptionKey: "key" },
				}),
				CurCacheHandler: BuildFilesOnDiskCache,
			}).get(key, { kind: "APP_PAGE", isRoutePPREnabled: true, isFallback: false });

		const visitor = await lookup({ accept: "text/html" });
		const action = await lookup({
			"next-action": "6012abcd",
			"content-type": "multipart/form-data; boundary=b",
		});

		expect(visitor?.isStale).toBe(true);
		expect(action?.isStale).toBeFalsy();
		expect(action?.isStale).not.toBe(-1);
	}, 30_000);
});

describe("cache-handler.mjs while the build runs", () => {
	it("writes every page, which is how the build leaves its pages behind", async () => {
		vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);
		const cache = newCache();
		const key = uniqueKey("/sk-eur/prerendered");

		await cache.set(key, page("<p>prerendered</p>"), PAGE_SET);

		expect(await readFile(join(serverDir, "app", `${key}.html`), "utf8")).toBe("<p>prerendered</p>");
		expect(JSON.parse(await readFile(join(serverDir, "app", `${key}.meta`), "utf8"))).toMatchObject({
			postponed: "{}",
			status: 200,
		});
	});

	it("still writes nothing when Next itself asked for no disk cache", async () => {
		vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);
		const cache = newCache(false);

		await cache.set(uniqueKey("/sk-eur/none"), page("<p>x</p>"), PAGE_SET);

		expect(await filesUnder(join(root, ".next"))).toEqual([]);
	});
});

describe("the parts of Next this handler stands on", () => {
	const FileSystemCache =
		(FileSystemCacheModule as unknown as { default?: unknown }).default ?? FileSystemCacheModule;

	// If an upgrade renames a kind or moves a directory, `hasFileOnDisk` would answer "no" for every entry and
	// a seed would stop being refreshed on disk. That is safe, and it is also a change nobody asked for.
	it.each([
		["APP_PAGE", "/x.html", "/server/app/x.html"],
		["PAGES", "/x.html", "/server/pages/x.html"],
		["APP_ROUTE", "/x.body", "/server/app/x.body"],
		["FETCH", "abc123", "/cache/fetch-cache/abc123"],
	])("builds the %s path where the stock cache writes it", (kind, key, expected) => {
		const cache = newCache() as unknown as { getFilePath(key: string, kind: string): string };

		expect(cache.getFilePath(key, kind)).toBe(join(root, ".next", expected));
	});

	it("extends the class the installed Next ships", () => {
		expect(Object.getPrototypeOf(BuildFilesOnDiskCache)).toBe(FileSystemCache);
	});
});

describe("next.config.js and the page cache", () => {
	const production = (phase = PHASE_PRODUCTION_BUILD) => resolveNextConfig(phase, () => 0);

	beforeEach(() => {
		vi.stubEnv("NEXT_OUTPUT", "");
	});

	it.each([PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER])(
		"points Next at the handler in %s",
		async (phase) => {
			const { cacheHandler } = production(phase);

			expect(cacheHandler).toBeTypeOf("string");
			expect((await import(/* @vite-ignore */ cacheHandler as string)).default).toBe(BuildFilesOnDiskCache);
		},
	);

	it("gives the memory cache a size, never 0: 0 switches it off and with it every page kept in memory", () => {
		const { cacheMaxMemorySize } = production();

		expect(cacheMaxMemorySize).toBeGreaterThanOrEqual(64 * 1024 * 1024);
		expect(cacheMaxMemorySize).toBeLessThanOrEqual(512 * 1024 * 1024);
	});

	it("caps the image cache on disk, and leaves isrFlushToDisk on because that cache depends on it", () => {
		const configured = production();

		expect(configured.images?.maximumDiskCacheSize).toBeGreaterThanOrEqual(1024 ** 3);
		expect(configured.images?.maximumDiskCacheSize).toBeLessThanOrEqual(10 * 1024 ** 3);
		expect(configured.experimental?.isrFlushToDisk).not.toBe(false);
	});

	it("keeps the optimised images out of the handler: with customCacheHandler they would live in memory only", () => {
		const images = production().images as Record<string, unknown> | undefined;

		expect(images?.customCacheHandler).toBeFalsy();
	});

	it("leaves development and the Dockerfile's standalone build on Next's stock cache", () => {
		expect(resolveNextConfig(PHASE_DEVELOPMENT_SERVER, () => 1).cacheHandler).toBeUndefined();

		vi.stubEnv("NEXT_OUTPUT", "standalone");
		expect(production().cacheHandler).toBeUndefined();
	});
});
