import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
	normaliseEntries,
	normaliseUrls,
	parseEntries,
	parseLocs,
	readOptions,
	selectPending,
	selectShards,
} from "../../scripts/ops/indexnow.mjs";

const SITE = "https://maky.store";
const KEY = "0123456789abcdef0123456789abcdef";

type Payload = { host: string; key: string; keyLocation: string; urlList: string[] };

const urlset = (...paths: string[]) =>
	`<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${SITE}${p}</loc></url>`).join("")}</urlset>`;

/** A shard the way the site writes a product one: every entry with the `lastmod` Saleor gave it. */
const datedUrlset = (...rows: [path: string, lastmod?: string][]) =>
	`<?xml version="1.0"?><urlset>${rows
		.map(([p, d]) => `<url>\n<loc>${SITE}${p}</loc>\n${d ? `<lastmod>${d}</lastmod>\n` : ""}</url>`)
		.join("\n")}</urlset>`;

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

const run = (argv: string[], w: ReturnType<typeof world>, extra: { now?: () => Date } = {}) =>
	main(argv, { fetch: w.fetch, log, publicDir, sleep: async () => {}, ...extra });

describe("scripts/ops/indexnow.mjs, the pieces", () => {
	it("reads <loc> out of a sitemap and decodes the entities a sitemap escapes", () => {
		const xml = `<urlset><url><loc>${SITE}/a?x=1&amp;y=2</loc></url><url><loc> ${SITE}/b </loc></url><url><lastmod>2026-10-08</lastmod></url></urlset>`;
		expect(parseLocs(xml)).toEqual([`${SITE}/a?x=1&y=2`, `${SITE}/b`]);
	});

	it("reads loc and lastmod of every <url> of a shard, and skips an entry that has no loc", () => {
		const xml = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
			`<url>\n<loc>${SITE}/a?x=1&amp;y=2</loc>\n<lastmod>2026-10-28T09:30:00.000Z</lastmod>\n<changefreq>daily</changefreq>\n<priority>0.7</priority>\n</url>`,
			`<url><loc> ${SITE}/b </loc></url>`,
			"<url><lastmod>2026-10-08T00:00:00.000Z</lastmod></url>",
			"</urlset>",
		].join("\n");
		expect(parseEntries(xml)).toEqual([
			{ loc: `${SITE}/a?x=1&y=2`, lastmod: "2026-10-28T09:30:00.000Z" },
			{ loc: `${SITE}/b`, lastmod: null },
		]);
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

	it("carries the lastmod through normalisation, keeps the first of two spellings of one URL, and hands back the rest", () => {
		const { entries, rejected } = normaliseEntries(
			[
				{ loc: `${SITE}/cz/x`, lastmod: "2026-10-01T00:00:00.000Z" },
				{ loc: `${SITE}/cz/x#top`, lastmod: "2026-10-09T00:00:00.000Z" },
				"/cz/y",
				{ loc: "https://example.com/cz/z", lastmod: null },
			],
			SITE,
		);
		expect(entries).toEqual([
			{ url: `${SITE}/cz/x`, lastmod: "2026-10-01T00:00:00.000Z" },
			{ url: `${SITE}/cz/y`, lastmod: null },
		]);
		expect(rejected).toEqual(["https://example.com/cz/z"]);
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

	it("lets only a 200 through, and calls a 202 what it is: received, not confirmed", () => {
		expect(interpretStatus(200).ok).toBe(true);
		expect([202, 400, 403, 422, 429, 500].map((s) => interpretStatus(s).ok)).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
		]);
		expect(interpretStatus(202)).toMatchObject({ ok: false, unconfirmed: true });
		expect([400, 403, 422, 429, 500].some((s) => interpretStatus(s).unconfirmed)).toBe(false);
	});

	describe("selectPending", () => {
		const now = Date.parse("2026-11-20T06:00:00.000Z");
		const day = 24 * 60 * 60 * 1000;
		const entry = (url: string, lastmod: string | null = null) => ({ url, lastmod });

		it("puts what was never sent first, in sitemap order, and what changed since it was sent after it", () => {
			const { fresh, changed } = selectPending(
				[
					entry("u/changed", "2026-11-10T00:00:00.000Z"),
					entry("u/new-1"),
					entry("u/new-2", "2026-11-19T00:00:00.000Z"),
				],
				{ "u/changed": "2026-11-01T06:00:00.000Z" },
				{ now, resendAfterMs: 7 * day },
			);
			expect(fresh).toEqual(["u/new-1", "u/new-2"]);
			expect(changed).toEqual(["u/changed"]);
		});

		it("does not tell a URL again that has not changed since it was sent, or that has no lastmod at all", () => {
			const sent = "2026-11-01T06:00:00.000Z";
			const { fresh, changed } = selectPending(
				[entry("u/older", "2026-10-30T00:00:00.000Z"), entry("u/same-moment", sent), entry("u/page")],
				{ "u/older": sent, "u/same-moment": sent, "u/page": sent },
				{ now, resendAfterMs: 0 },
			);
			expect(fresh).toEqual([]);
			expect(changed).toEqual([]);
		});

		it("does not tell a changed URL again before the resend window has passed", () => {
			const submitted = { "u/a": "2026-11-17T06:00:00.000Z" }; // three days ago
			const rows = [entry("u/a", "2026-11-18T00:00:00.000Z")];
			expect(selectPending(rows, submitted, { now, resendAfterMs: 7 * day }).changed).toEqual([]);
			expect(selectPending(rows, submitted, { now, resendAfterMs: 3 * day }).changed).toEqual(["u/a"]);
			expect(selectPending(rows, submitted, { now, resendAfterMs: 0 }).changed).toEqual(["u/a"]);
		});

		it("reads a recorded time or a lastmod that is not a date as 'sent', so a damaged file makes a run send less", () => {
			const { fresh, changed } = selectPending(
				[entry("u/bad-stamp", "2026-11-19T00:00:00.000Z"), entry("u/bad-lastmod", "soon")],
				{ "u/bad-stamp": "yesterday-ish", "u/bad-lastmod": "2026-11-01T06:00:00.000Z" },
				{ now, resendAfterMs: 0 },
			);
			expect(fresh).toEqual([]);
			expect(changed).toEqual([]);
		});
	});

	it("takes --resend-after-days as a whole number of days and refuses anything else", () => {
		expect(readOptions([]).resendAfterDays).toBe(7);
		expect(readOptions(["--resend-after-days", "0"]).resendAfterDays).toBe(0);
		expect(readOptions(["--resend-after-days", "30"]).resendAfterDays).toBe(30);
		for (const bad of ["-1", "1.5", "soon", "3651"]) {
			expect(readOptions(["--resend-after-days", bad]).error).toMatch(/--resend-after-days/);
		}
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
		const state = join(dir, "state.json");
		expect(
			await run(["--fire", "--kinds", "products,vehicles", "--markets", "cz", "--state", state], w),
		).toBe(0);
		expect(w.posts[0].body.urlList).toEqual([`${SITE}/cz/a-product`, `${SITE}/cz/b-product`]);
	});

	it("sends products and vehicles only with a state file, while a dry run, the pages and named URLs need none", async () => {
		const w = world();
		expect(await run(["--fire", "--kinds", "products"], w)).toBe(2);
		expect(await run(["--fire", "--kinds", "pages,vehicles"], w)).toBe(2);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/products and vehicles are sent only with --state/);

		expect(await run(["--kinds", "products"], w)).toBe(0);
		expect(await run(["--fire", "--kinds", "pages"], w)).toBe(0);
		expect(await run(["--fire", "--urls", "/cz/a-product"], w)).toBe(0);
		expect(w.posts).toHaveLength(2);
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

	it("stops at the first answer that is not a 200 and keeps what had gone through", async () => {
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

	it("takes a 202 as received, not sent: it stops, records nothing and exits 3", async () => {
		// 2026-10-08: 177 URLs got a 202, were written to the state file as sent, and Bing never listed them.
		const state = join(dir, "state.json");
		const w = world({ endpointStatus: 202 });
		expect(await run(["--fire", "--state", state], w)).toBe(3);
		expect(w.posts).toHaveLength(1);
		expect(existsSync(state)).toBe(false);
		expect(logLines.join("\n")).toMatch(/202 \(received/);
		expect(logLines.join("\n")).toMatch(/not recorded as sent/);
		expect(logLines.join("\n")).not.toMatch(/done:/);

		// The next run, with an engine that now accepts, sends the same URLs.
		const next = world();
		expect(await run(["--fire", "--state", state], next)).toBe(0);
		expect(next.posts[0].body.urlList).toHaveLength(5);
		expect(submittedIn(state)).toHaveLength(5);
	});

	it("keeps what the requests before a 202 had confirmed, and records nothing of the one that got it", async () => {
		const state = join(dir, "state.json");
		const urls = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => `/sk/p-${i}`).join(",");
		const w = world({ endpointStatus: (call) => (call === 1 ? 200 : 202) });
		expect(await run(["--fire", "--state", state, "--urls", urls, "--max", String(BATCH_SIZE + 1)], w)).toBe(
			3,
		);
		expect(w.posts).toHaveLength(2);
		expect(submittedIn(state)).toHaveLength(BATCH_SIZE);
	});

	it("sends again a product whose lastmod is later than when it was sent, and not one that is unchanged", async () => {
		const state = join(dir, "state.json");
		const sentAt = "2026-11-01T06:00:00.000Z";
		writeFileSync(
			state,
			JSON.stringify({
				version: 1,
				submitted: { [`${SITE}/cz/a-product`]: sentAt, [`${SITE}/cz/b-product`]: sentAt },
			}),
		);
		const w = world({
			files: {
				"/sitemaps/cz-products-1.xml": datedUrlset(
					["/cz/a-product", "2026-11-10T08:00:00.000Z"], // changed after it was sent
					["/cz/b-product", "2026-10-30T08:00:00.000Z"], // last changed before it was sent
				),
			},
		});
		const now = () => new Date("2026-11-20T06:20:00.000Z");
		expect(
			await run(["--fire", "--kinds", "products", "--markets", "cz", "--state", state], w, { now }),
		).toBe(0);
		expect(w.posts).toHaveLength(1);
		expect(w.posts[0].body.urlList).toEqual([`${SITE}/cz/a-product`]);
		expect(logLines.join("\n")).toMatch(/0 never sent, 1 changed since they were sent/);

		const written = (JSON.parse(readFileSync(state, "utf8")) as { submitted: Record<string, string> })
			.submitted;
		expect(written[`${SITE}/cz/a-product`]).toBe("2026-11-20T06:20:00.000Z");
		expect(written[`${SITE}/cz/b-product`]).toBe(sentAt);

		// And a second run the same day has nothing left.
		const again = world({
			files: { "/sitemaps/cz-products-1.xml": datedUrlset(["/cz/a-product", "2026-11-10T08:00:00.000Z"]) },
		});
		expect(
			await run(["--fire", "--kinds", "products", "--markets", "cz", "--state", state], again, { now }),
		).toBe(0);
		expect(again.posts).toHaveLength(0);
	});

	it("does not tell a changed product again before --resend-after-days have passed", async () => {
		const state = join(dir, "state.json");
		writeFileSync(
			state,
			JSON.stringify({ version: 1, submitted: { [`${SITE}/cz/a-product`]: "2026-11-17T06:00:00.000Z" } }),
		);
		const files = {
			"/sitemaps/cz-products-1.xml": datedUrlset(["/cz/a-product", "2026-11-18T00:00:00.000Z"]),
		};
		const now = () => new Date("2026-11-20T06:20:00.000Z");
		const base = ["--fire", "--kinds", "products", "--markets", "cz", "--state", state];

		const held = world({ files });
		expect(await run(base, held, { now })).toBe(0);
		expect(held.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/nothing to send/);

		const sooner = world({ files });
		expect(await run([...base, "--resend-after-days", "2"], sooner, { now })).toBe(0);
		expect(sooner.posts).toHaveLength(1);
	});

	it("sends what was never sent before what changed, so a cap cuts the changed ones first", async () => {
		const state = join(dir, "state.json");
		writeFileSync(
			state,
			JSON.stringify({ version: 1, submitted: { [`${SITE}/cz/a-product`]: "2026-11-01T06:00:00.000Z" } }),
		);
		const w = world({
			files: {
				"/sitemaps/cz-products-1.xml": datedUrlset(
					["/cz/a-product", "2026-11-10T08:00:00.000Z"], // changed, listed first
					["/cz/b-product", "2026-11-12T08:00:00.000Z"], // never sent
					["/cz/c-product", "2026-11-13T08:00:00.000Z"], // never sent
				),
			},
		});
		const now = () => new Date("2026-11-20T06:20:00.000Z");
		expect(
			await run(["--fire", "--kinds", "products", "--markets", "cz", "--state", state, "--max", "2"], w, {
				now,
			}),
		).toBe(0);
		expect(w.posts[0].body.urlList).toEqual([`${SITE}/cz/b-product`, `${SITE}/cz/c-product`]);
		expect(logLines.join("\n")).toMatch(/capped by --max 2/);
	});

	it("reads the state file the earlier version of the tool wrote, and does not tell a page twice", async () => {
		// The state of 2026-10-08: version 1, an ISO time per URL, and pages carry no lastmod.
		const state = join(dir, "state.json");
		const submitted = Object.fromEntries(
			["/sk", "/sk/autochladnicky", "/cz", "/cz/autochladnicky", "/cz/kontakt"].map((p) => [
				`${SITE}${p}`,
				"2026-10-08T19:44:43.000Z",
			]),
		);
		writeFileSync(state, JSON.stringify({ version: 1, submitted }, null, "\t"));
		const w = world();
		expect(await run(["--fire", "--state", state], w)).toBe(0);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/nothing to send/);
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

describe("scripts/ops/systemd, the daily run", () => {
	const root = process.cwd();
	const unit = readFileSync(join(root, "scripts/ops/systemd/maky-indexnow.service"), "utf8");
	const timer = readFileSync(join(root, "scripts/ops/systemd/maky-indexnow.timer"), "utf8");

	it("starts the tool with options it accepts: every kind, a state file outside the checkout, --fire", () => {
		const line = unit.split("\n").find((l) => l.startsWith("ExecStart="));
		expect(line).toBeDefined();
		const args = (line as string)
			.slice((line as string).indexOf("indexnow.mjs") + "indexnow.mjs".length)
			.trim()
			.split(/\s+/);
		const options = readOptions(args);
		expect(options.error).toBeUndefined();
		expect(options).toMatchObject({ fire: true, kinds: ["pages", "products", "vehicles"], max: 10_000 });
		// A deploy replaces the checkout's files; the progress must not live there.
		expect(options.state).toMatch(/^\/var\/lib\/maky-indexnow\//);
		expect(unit).toMatch(/^StateDirectory=maky-indexnow$/m);
	});

	it("skips while a deploy runs, by the lock the deploy script itself takes", () => {
		const lock = /LOCK_FILE="\$\{LOCK_FILE:-([^}]+)\}"/.exec(
			readFileSync(join(root, "scripts/ops/deploy-production.sh"), "utf8"),
		)?.[1];
		expect(lock).toBe("/run/lock/maky-storefront-deploy.lock");
		expect(unit).toContain(`ExecCondition=/usr/bin/flock -n ${lock} -c true`);
	});

	it("runs once a day, outside the CarFitManager windows on the same box with half an hour to spare", () => {
		const at = /^OnCalendar=\*-\*-\* (\d\d):(\d\d):00 UTC$/m.exec(timer);
		expect(at).not.toBeNull();
		const minute = Number(at?.[1]) * 60 + Number(at?.[2]);
		// 01:30 to 02:04 and 03:15 to 05:00 UTC every day; Mondays also about 02:30 to 03:04 (all inside these).
		const windows: [number, number][] = [
			[90, 124],
			[195, 300],
		];
		for (const [from, to] of windows) {
			expect(minute < from - 30 || minute > to + 30).toBe(true);
		}
		expect(timer).toMatch(/^Persistent=true$/m);
	});

	it("keeps the ceilings on a job that must not compete with the shop", () => {
		expect(unit).toMatch(/^Nice=\d+$/m);
		expect(unit).toMatch(/^MemoryMax=\d+M$/m);
		expect(unit).toMatch(/^MemorySwapMax=0$/m);
		// It reads the public sitemaps and writes its state file; nothing of PM2, nginx or .env (comments aside).
		const settings = unit
			.split("\n")
			.filter((l) => l.trim() && !l.trim().startsWith("#"))
			.join("\n");
		expect(settings).not.toMatch(/pm2|nginx|\.env|--update-env/i);
	});
});
