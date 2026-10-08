import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PUBLIC_ASSET_PATHS } from "@/lib/routing.generated";
import {
	BATCH_SIZE,
	buildPayload,
	chunk,
	classifyShard,
	findKey,
	interpretStatus,
	main,
	normaliseUrls,
	parseLocs,
	selectShards,
} from "../../scripts/ops/indexnow.mjs";

const SITE = "https://maky.store";
const KEY = "0123456789abcdef0123456789abcdef";

type Payload = { host: string; key: string; keyLocation: string; urlList: string[] };

const urlset = (...paths: string[]) =>
	`<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${SITE}${p}</loc></url>`).join("")}</urlset>`;

const sitemapIndex = (...shards: string[]) =>
	`<?xml version="1.0"?><sitemapindex>${shards
		.map((s) => `<sitemap><loc>${SITE}/sitemaps/${s}.xml</loc></sitemap>`)
		.join("")}</sitemapindex>`;

/**
 * A small world to run `main` against: the sitemaps, the key file and the IndexNow endpoint. Every
 * request is recorded, so a test can say what was and was not sent.
 */
function world(
	options: {
		files?: Record<string, string>;
		keyFile?: string | null;
		endpointStatus?: number | ((call: number) => number);
	} = {},
) {
	const files: Record<string, string> = {
		"/sitemap.xml": sitemapIndex("sk-pages-1", "cz-pages-1", "cz-products-1", "sk-vehicles-1"),
		"/sitemaps/sk-pages-1.xml": urlset("/sk", "/sk/autochladnicky"),
		"/sitemaps/cz-pages-1.xml": urlset("/cz", "/cz/autochladnicky", "/cz/kontakt"),
		"/sitemaps/cz-products-1.xml": urlset("/cz/a-product", "/cz/b-product"),
		"/sitemaps/sk-vehicles-1.xml": urlset("/sk/stresne-nosice/skoda"),
		...options.files,
	};
	const keyFile = options.keyFile === undefined ? KEY : options.keyFile;
	const posts: { url: string; body: Payload }[] = [];
	const gets: string[] = [];
	const fetch = async (url: string, init?: { method?: string; body?: string }) => {
		if (init?.method === "POST") {
			posts.push({ url, body: JSON.parse(String(init.body)) as Payload });
			const status =
				typeof options.endpointStatus === "function"
					? options.endpointStatus(posts.length)
					: options.endpointStatus ?? 200;
			return { ok: status >= 200 && status < 300, status, text: async () => "" };
		}
		gets.push(url);
		const path = url.replace(SITE, "");
		if (path === `/${KEY}.txt` && keyFile !== null) {
			return { ok: true, status: 200, text: async () => keyFile };
		}
		if (path in files) return { ok: true, status: 200, text: async () => files[path] };
		return { ok: false, status: 404, text: async () => "" };
	};
	return { fetch, posts, gets };
}

let dir: string;
let publicDir: string;
let logLines: string[];
const log = (line: string) => {
	logLines.push(line);
};

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "indexnow-"));
	publicDir = join(dir, "public");
	mkdirSync(publicDir);
	writeFileSync(join(publicDir, `${KEY}.txt`), KEY);
	writeFileSync(join(publicDir, "llms.txt"), "# not a key");
	logLines = [];
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** The URLs the state file says were sent. */
const submittedIn = (path: string) =>
	Object.keys((JSON.parse(readFileSync(path, "utf8")) as { submitted: Record<string, string> }).submitted);

const run = (argv: string[], w: ReturnType<typeof world>) =>
	main(argv, { fetch: w.fetch, log, publicDir, sleep: async () => {} });

describe("scripts/ops/indexnow.mjs, the pieces", () => {
	it("reads <loc> out of a sitemap and decodes the entities a sitemap escapes", () => {
		const xml = `<urlset><url><loc>${SITE}/a?x=1&amp;y=2</loc></url><url><loc> ${SITE}/b </loc></url><url><lastmod>2026-10-08</lastmod></url></urlset>`;
		expect(parseLocs(xml)).toEqual([`${SITE}/a?x=1&y=2`, `${SITE}/b`]);
	});

	it("names a shard by market, kind and part, and nothing else", () => {
		expect(classifyShard(`${SITE}/sitemaps/cz-pages-1.xml`)).toEqual({
			market: "cz",
			kind: "pages",
			part: 1,
		});
		expect(classifyShard(`${SITE}/sitemaps/us-products-12.xml`)).toEqual({
			market: "us",
			kind: "products",
			part: 12,
		});
		expect(classifyShard(`${SITE}/sitemap.xml`)).toBeNull();
		expect(classifyShard(`${SITE}/sitemaps/cz-pages-0.xml`)).toBeNull();
		expect(classifyShard(`${SITE}/sitemaps/cz-brands-1.xml`)).toBeNull();
	});

	it("selects shards by kind and, when asked, by market", () => {
		const locs = ["sk-pages-1", "cz-pages-1", "cz-products-1", "cz-products-2", "sk-vehicles-1"].map(
			(s) => `${SITE}/sitemaps/${s}.xml`,
		);
		expect(selectShards(locs, { kinds: ["pages"], markets: [] })).toHaveLength(2);
		expect(selectShards(locs, { kinds: ["products", "vehicles"], markets: [] })).toHaveLength(3);
		expect(selectShards(locs, { kinds: ["products"], markets: ["cz"] })).toHaveLength(2);
		expect(selectShards(locs, { kinds: ["products"], markets: ["sk"] })).toHaveLength(0);
	});

	it("keeps only absolute URLs of the site's own host, once each, and hands back the rest", () => {
		const { urls, rejected } = normaliseUrls(
			[
				"/cz/x",
				`${SITE}/cz/x`,
				`${SITE}/cz/y#top`,
				"cz/z",
				"http://maky.store/cz/insecure",
				"https://example.com/cz/x",
				"http://[bad",
			],
			SITE,
		);
		expect(urls).toEqual([`${SITE}/cz/x`, `${SITE}/cz/y`, `${SITE}/cz/z`]);
		expect(rejected).toEqual(["http://maky.store/cz/insecure", "https://example.com/cz/x", "http://[bad"]);
	});

	it("splits a list into batches without losing or repeating anything", () => {
		const list = Array.from({ length: 11_000 }, (_, i) => String(i));
		const batches = chunk(list, BATCH_SIZE);
		expect(batches.map((b: string[]) => b.length)).toEqual([5_000, 5_000, 1_000]);
		expect(batches.flat()).toEqual(list);
	});

	it("builds the payload the protocol names: host, key, where the key lives, the URLs", () => {
		expect(buildPayload({ site: SITE, key: KEY, urlList: [`${SITE}/cz`] })).toEqual({
			host: "maky.store",
			key: KEY,
			keyLocation: `${SITE}/${KEY}.txt`,
			urlList: [`${SITE}/cz`],
		});
	});

	it("lets only 200 and 202 through", () => {
		expect([200, 202].map((s) => interpretStatus(s).ok)).toEqual([true, true]);
		expect([400, 403, 422, 429, 500].map((s) => interpretStatus(s).ok)).toEqual([
			false,
			false,
			false,
			false,
			false,
		]);
	});

	it("finds the one file whose content is its own name, and refuses none or two", () => {
		expect(findKey(publicDir)).toBe(KEY);
		writeFileSync(
			join(publicDir, "fedcba9876543210fedcba9876543210.txt"),
			"fedcba9876543210fedcba9876543210",
		);
		expect(() => findKey(publicDir)).toThrow(/more than one/);
		rmSync(join(publicDir, `${KEY}.txt`));
		rmSync(join(publicDir, "fedcba9876543210fedcba9876543210.txt"));
		expect(() => findKey(publicDir)).toThrow(/no IndexNow key file/);
	});

	it("does not take a key-shaped file name whose content says something else", () => {
		writeFileSync(join(publicDir, "notes-2026-10.txt"), "meeting notes");
		expect(findKey(publicDir)).toBe(KEY);
	});
});

describe("public/<key>.txt, the file the engines read", () => {
	it("is in the repository exactly once, says its own name, and the proxy lets it through", () => {
		const key = findKey();
		expect(key).toMatch(/^[a-f0-9]{32}$/);
		// No newline and no BOM: the file is compared to the key byte for byte by some engines.
		expect(readFileSync(join(process.cwd(), "public", `${key}.txt`), "utf8")).toBe(key);
		// The proxy sends an unknown root path to the market gate. A file in public/ is served only
		// if the generated list knows it (`pnpm generate:routing`).
		expect(PUBLIC_ASSET_PATHS.has(`/${key}.txt`)).toBe(true);
	});
});

describe("scripts/ops/indexnow.mjs, a run", () => {
	it("is a dry run unless told otherwise: it reads, reports, and sends nothing", async () => {
		const w = world();
		expect(await run([], w)).toBe(0);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/5 URLs found/);
		expect(logLines.join("\n")).toMatch(/dry run: nothing was sent/);
		expect(logLines.join("\n")).toMatch(/serves the key/);
	});

	it("sends the pages shards of every market and nothing else by default", async () => {
		const w = world();
		expect(await run(["--fire"], w)).toBe(0);
		expect(w.posts).toHaveLength(1);
		expect(w.posts[0].url).toBe("https://api.indexnow.org/indexnow");
		expect(w.posts[0].body).toEqual({
			host: "maky.store",
			key: KEY,
			keyLocation: `${SITE}/${KEY}.txt`,
			urlList: [
				`${SITE}/sk`,
				`${SITE}/sk/autochladnicky`,
				`${SITE}/cz`,
				`${SITE}/cz/autochladnicky`,
				`${SITE}/cz/kontakt`,
			],
		});
	});

	it("narrows to the asked kinds and markets", async () => {
		const w = world();
		expect(await run(["--fire", "--kinds", "products,vehicles", "--markets", "cz"], w)).toBe(0);
		expect(w.posts[0].body.urlList).toEqual([`${SITE}/cz/a-product`, `${SITE}/cz/b-product`]);
	});

	it("sends named URLs without reading the sitemaps, and sends them again even if they were sent before", async () => {
		const state = join(dir, "state.json");
		const first = world();
		expect(await run(["--fire", "--state", state, "--urls", "/cz/autochladnicky"], first)).toBe(0);
		expect(first.gets.some((u) => u.includes("sitemap"))).toBe(false);
		expect(first.posts[0].body.urlList).toEqual([`${SITE}/cz/autochladnicky`]);

		const again = world();
		expect(await run(["--fire", "--state", state, "--urls", "/cz/autochladnicky"], again)).toBe(0);
		expect(again.posts).toHaveLength(1);
	});

	it("remembers what it sent, so a second run sends only what the first did not", async () => {
		const state = join(dir, "nested", "state.json");
		const first = world();
		expect(await run(["--fire", "--state", state, "--max", "2"], first)).toBe(0);
		expect(first.posts[0].body.urlList).toEqual([`${SITE}/sk`, `${SITE}/sk/autochladnicky`]);
		expect(submittedIn(state)).toHaveLength(2);

		const second = world();
		expect(await run(["--fire", "--state", state], second)).toBe(0);
		expect(second.posts[0].body.urlList).toEqual([
			`${SITE}/cz`,
			`${SITE}/cz/autochladnicky`,
			`${SITE}/cz/kontakt`,
		]);

		const third = world();
		expect(await run(["--fire", "--state", state], third)).toBe(0);
		expect(third.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/nothing to send/);
	});

	it("refuses to fire while the public site does not serve the key file", async () => {
		const missing = world({ keyFile: null });
		expect(await run(["--fire"], missing)).toBe(2);
		expect(missing.posts).toHaveLength(0);

		const wrong = world({ keyFile: "not-the-key" });
		expect(await run(["--fire"], wrong)).toBe(2);
		expect(wrong.posts).toHaveLength(0);

		// A dry run only reports it.
		const dry = world({ keyFile: null });
		expect(await run([], dry)).toBe(0);
		expect(logLines.join("\n")).toMatch(/does NOT serve the key/);
	});

	it("stops at the first answer that is not 200 or 202 and keeps what had gone through", async () => {
		const state = join(dir, "state.json");
		const urls = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, i) => `/sk/p-${i}`).join(",");
		const w = world({ endpointStatus: (call) => (call === 1 ? 200 : 429) });
		expect(await run(["--fire", "--state", state, "--urls", urls, "--max", String(BATCH_SIZE * 3)], w)).toBe(
			1,
		);
		expect(w.posts).toHaveLength(2);
		expect(submittedIn(state)).toHaveLength(BATCH_SIZE);
		expect(logLines.join("\n")).toMatch(/429 \(too many requests/);
	});

	it("takes 202 as sent", async () => {
		const w = world({ endpointStatus: 202 });
		expect(await run(["--fire"], w)).toBe(0);
		expect(logLines.join("\n")).toMatch(/202 \(received/);
	});

	it("refuses, before sending anything, when a sitemap lists a URL of another host", async () => {
		const w = world({
			files: {
				"/sitemaps/cz-pages-1.xml": urlset("/cz").replace(
					"</urlset>",
					"<url><loc>https://example.com/cz</loc></url></urlset>",
				),
			},
		});
		expect(await run(["--fire"], w)).toBe(2);
		expect(w.posts).toHaveLength(0);
	});

	it("fails without sending when the index or a shard cannot be read", async () => {
		const noIndex = world();
		const original = noIndex.fetch;
		noIndex.fetch = async (url, init) =>
			url.endsWith("/sitemap.xml") ? { ok: false, status: 503, text: async () => "" } : original(url, init);
		expect(await run(["--fire"], noIndex)).toBe(1);
		expect(noIndex.posts).toHaveLength(0);

		const noShard = world({ files: { "/sitemap.xml": sitemapIndex("sk-pages-1", "de-pages-1") } });
		expect(await run(["--fire"], noShard)).toBe(1);
		expect(noShard.posts).toHaveLength(0);
	});

	it("refuses a typo instead of ignoring it", async () => {
		const w = world();
		expect(await run(["--fier"], w)).toBe(2);
		expect(await run(["--kinds", "pagez"], w)).toBe(2);
		expect(await run(["--max", "50001"], w)).toBe(2);
		expect(await run(["--markets", "czech"], w)).toBe(2);
		expect(w.gets).toHaveLength(0);
		expect(w.posts).toHaveLength(0);
	});
});
