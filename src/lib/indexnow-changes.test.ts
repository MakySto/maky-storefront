import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	BULK_CHANGE_MIN,
	diffGroup,
	groupOf,
	main,
	readOptions,
	readSeen,
	snapshotOf,
} from "../../scripts/ops/indexnow.mjs";

/**
 * `--mode changes` and `--mode backlog` of scripts/ops/indexnow.mjs.
 *
 * The daily run used to be one thing: the URLs never sent, then those whose `lastmod` had moved, 10 000
 * a run, the sitemap order deciding. On 2026-11-07 Marek pointed out what that does to a real change:
 * a new product waits behind a quarter of a million URLs that were never sent, a product that is gone
 * is never mentioned (the sitemap no longer lists it), and a page or a vehicle page that changes is not
 * looked at again at all. The two modes are the answer; these tests are what they promise.
 */

const SITE = "https://maky.store";
const KEY = "0123456789abcdef0123456789abcdef";

type Payload = { host: string; key: string; keyLocation: string; urlList: string[] };

/** A shard the way the site writes it: `[path, lastmod?]` per entry. */
const shard = (...rows: [path: string, lastmod?: string][]) =>
	`<?xml version="1.0"?><urlset>${rows
		.map(([p, d]) => `<url>\n<loc>${SITE}${p}</loc>\n${d ? `<lastmod>${d}</lastmod>\n` : ""}</url>`)
		.join("\n")}</urlset>`;

const sitemapIndex = (...ids: string[]) =>
	`<?xml version="1.0"?><sitemapindex>${ids
		.map((id) => `<sitemap><loc>${SITE}/sitemaps/${id}.xml</loc></sitemap>`)
		.join("")}</sitemapindex>`;

/** The site as the tool sees it. `files` is meant to be changed between two runs, like the real sitemaps. */
function world(files: Record<string, string>, endpoint: number | ((call: number) => number) = 200) {
	const posts: Payload[] = [];
	const failing = new Set<string>();
	const fetch = async (url: string, init?: { method?: string; body?: string }) => {
		if (init?.method === "POST") {
			posts.push(JSON.parse(String(init.body)) as Payload);
			const status = typeof endpoint === "function" ? endpoint(posts.length) : endpoint;
			return { ok: status >= 200 && status < 300, status, text: async () => "" };
		}
		const path = url.replace(SITE, "");
		if (path === `/${KEY}.txt`) return { ok: true, status: 200, text: async () => KEY };
		if (failing.has(path)) return { ok: false, status: 500, text: async () => "" };
		if (path in files) return { ok: true, status: 200, text: async () => files[path] as string };
		return { ok: false, status: 404, text: async () => "" };
	};
	return { files, posts, fetch, failing };
}

let dir: string;
let publicDir: string;
let state: string;
let seenFile: string;
let logLines: string[];
const log = (line: string) => {
	logLines.push(line);
};

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "indexnow-changes-"));
	publicDir = join(dir, "public");
	mkdirSync(publicDir);
	writeFileSync(join(publicDir, `${KEY}.txt`), KEY);
	state = join(dir, "state.json");
	seenFile = join(dir, "seen.json");
	logLines = [];
	clock = START;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** The tests own the clock: the stamps and the "told again after a day" rule read it. */
const START = new Date("2026-11-08T12:00:00.000Z");
let clock = START;
const hoursLater = (hours: number) => new Date(START.getTime() + hours * 3_600_000);

const run = (argv: string[], w: ReturnType<typeof world>) =>
	main(argv, { fetch: w.fetch, log, publicDir, sleep: async () => {}, now: () => clock });

const changes = (w: ReturnType<typeof world>, extra: string[] = []) =>
	run(["--mode", "changes", "--state", state, "--seen", seenFile, "--fire", ...extra], w);

const backlog = (w: ReturnType<typeof world>, extra: string[] = []) =>
	run(["--mode", "backlog", "--state", state, "--fire", ...extra], w);

const submitted = () =>
	existsSync(state)
		? Object.keys(
				(JSON.parse(readFileSync(state, "utf8")) as { submitted: Record<string, string> }).submitted,
			)
		: [];
type Seen = { version: number; takenAt: string | null; groups: Record<string, Record<string, string>> };
const seenNow = () => readSeen(seenFile) as Seen | null;
const snapshot = (group: string) => Object.keys(seenNow()?.groups[group] ?? {});
const url = (path: string) => `${SITE}${path}`;

/** A small shop: a market's pages, vehicle pages and products, the way the index lists them. */
const SHOP = () =>
	world({
		"/sitemap.xml": sitemapIndex("sk-pages-1", "sk-vehicles-1", "sk-products-1"),
		"/sitemaps/sk-pages-1.xml": shard(["/sk"], ["/sk/stresne-nosice"]),
		"/sitemaps/sk-vehicles-1.xml": shard(["/sk/stresne-nosice/skoda"]),
		"/sitemaps/sk-products-1.xml": shard(
			["/sk/a-product", "2026-10-29T10:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
		),
	});

describe("--mode changes, the first look", () => {
	it("takes the snapshot and announces nothing, however much the sitemaps hold", async () => {
		const w = SHOP();

		expect(await changes(w)).toBe(0);

		expect(w.posts).toHaveLength(0);
		expect(snapshot("sk-products")).toEqual([
			url("/sk/a-product"),
			url("/sk/b-product"),
			url("/sk/c-product"),
		]);
		expect(snapshot("sk-pages")).toHaveLength(2);
		expect(snapshot("sk-vehicles")).toHaveLength(1);
		expect(logLines.join("\n")).toMatch(/seen for the first time: recorded, not announced/);
	});

	it("has nothing to say about a second look at the same sitemaps", async () => {
		const w = SHOP();
		await changes(w);
		logLines = [];

		expect(await changes(w)).toBe(0);

		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/nothing to send/);
	});

	it("writes nothing in a dry run, not even the snapshot, and says what the first fire would do", async () => {
		const w = SHOP();

		const code = await run(["--mode", "changes", "--state", state, "--seen", seenFile], w);

		expect(code).toBe(0);
		expect(existsSync(seenFile)).toBe(false);
		expect(existsSync(state)).toBe(false);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/first run with --fire takes the snapshot and announces nothing/);
	});
});

describe("--mode changes, what it announces", () => {
	it("tells about a new product, a product that is gone and a product whose date moved — in that order, once", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product", "2026-11-08T08:00:00.000Z"], // changed
			["/sk/c-product", "2026-10-29T10:00:00.000Z"], // untouched; b-product is gone
			["/sk/d-product", "2026-11-08T07:00:00.000Z"], // new
		);

		expect(await changes(w)).toBe(0);

		expect(w.posts).toHaveLength(1);
		expect(w.posts[0]?.urlList).toEqual([url("/sk/b-product"), url("/sk/d-product"), url("/sk/a-product")]);
		expect(w.posts[0]).toMatchObject({ host: "maky.store", key: KEY });
		expect(logLines.join("\n")).toMatch(/1 removed, 1 added, 1 changed/);
		expect(logLines.join("\n")).toMatch(/done: 3 URL\(s\) sent \(1 removed, 1 added, 1 changed\)/);

		// What was told is what is recorded: the removed one is forgotten, the others are the new baseline.
		expect(snapshot("sk-products")).toEqual([
			url("/sk/a-product"),
			url("/sk/c-product"),
			url("/sk/d-product"),
		]);
		expect(submitted()).toEqual(expect.arrayContaining([url("/sk/a-product"), url("/sk/d-product")]));
		expect(submitted()).not.toContain(url("/sk/b-product"));

		// A third look at the same sitemaps repeats nothing.
		w.posts.length = 0;
		await changes(w);
		expect(w.posts).toHaveLength(0);
	});

	it("announces a rename as the old address gone and the new one there, in one message", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product-renamed", "2026-11-08T08:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
		);
		await changes(w);

		expect(w.posts).toHaveLength(1);
		expect(w.posts[0]?.urlList).toEqual([url("/sk/a-product"), url("/sk/a-product-renamed")]);
	});

	it("holds a change back when the URL was told less than a day ago, and tells it once the day has passed", async () => {
		const w = SHOP();
		await changes(w);
		const products = (aLastmod: string) =>
			shard(
				["/sk/a-product", aLastmod],
				["/sk/b-product", "2026-10-29T10:00:00.000Z"],
				["/sk/c-product", "2026-10-29T10:00:00.000Z"],
			);

		w.files["/sitemaps/sk-products-1.xml"] = products("2026-11-08T08:00:00.000Z");
		await changes(w);
		expect(w.posts.map((p) => p.urlList)).toEqual([[url("/sk/a-product")]]);

		// Touched again two hours later: the same page, not news yet.
		clock = hoursLater(2);
		w.files["/sitemaps/sk-products-1.xml"] = products("2026-11-08T13:30:00.000Z");
		await changes(w);
		expect(w.posts).toHaveLength(1);
		expect(seenNow()?.groups["sk-products"][url("/sk/a-product")]).toBe("2026-11-08T08:00:00.000Z");
		expect(logLines.join("\n")).toMatch(/1 held back \(told less than 1 day\(s\) ago\)/);

		// The day has passed: it is told, once, with the newest date recorded.
		clock = hoursLater(25);
		await changes(w);
		expect(w.posts.map((p) => p.urlList)).toEqual([[url("/sk/a-product")], [url("/sk/a-product")]]);
		expect(seenNow()?.groups["sk-products"][url("/sk/a-product")]).toBe("2026-11-08T13:30:00.000Z");

		clock = hoursLater(26);
		await changes(w);
		expect(w.posts).toHaveLength(2);
	});

	it("never holds back a new or a removed URL: the pause is for changes of a page that was just told", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product", "2026-10-29T10:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
			["/sk/d-product", "2026-11-08T12:10:00.000Z"],
		);
		await changes(w); // d is new: told

		clock = hoursLater(1);
		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product", "2026-10-29T10:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
		); // d is gone an hour later: that is told too
		await changes(w);

		expect(w.posts.map((p) => p.urlList)).toEqual([[url("/sk/d-product")], [url("/sk/d-product")]]);
		expect(submitted()).not.toContain(url("/sk/d-product"));
	});

	it("announces a page and a vehicle page that appear, and a page that goes", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemaps/sk-pages-1.xml"] = shard(["/sk"], ["/sk/autochladnicky"]); // stresne-nosice is gone
		w.files["/sitemaps/sk-vehicles-1.xml"] = shard(["/sk/stresne-nosice/skoda"], ["/sk/stresne-nosice/audi"]);
		await changes(w);

		expect(w.posts[0]?.urlList).toEqual([
			url("/sk/stresne-nosice"),
			url("/sk/autochladnicky"),
			url("/sk/stresne-nosice/audi"),
		]);
	});

	it("does not announce as new a URL the state file already says was sent, and does not announce it later either", async () => {
		const w = SHOP();
		await changes(w);

		// The backlog (or a person) told Bing about it before this run noticed it.
		const early = url("/sk/e-product");
		writeFileSync(state, JSON.stringify({ version: 1, submitted: { [early]: "2026-11-08T06:20:00.000Z" } }));
		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product", "2026-10-29T10:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
			["/sk/e-product", "2026-11-08T06:00:00.000Z"],
		);
		await changes(w);

		expect(w.posts).toHaveLength(0);
		expect(snapshot("sk-products")).toContain(early);

		await changes(w);
		expect(w.posts).toHaveLength(0);
	});

	it("does not take a date that appears, vanishes, goes backwards or is not a date for a change", () => {
		const diff = diffGroup(
			{
				[url("/a")]: "",
				[url("/b")]: "2026-10-29T10:00:00.000Z",
				[url("/c")]: "2026-10-29T10:00:00.000Z",
				[url("/d")]: "2026-10-29T10:00:00.000Z",
			},
			[
				{ url: url("/a"), lastmod: "2026-11-08T00:00:00.000Z" },
				{ url: url("/b"), lastmod: null },
				{ url: url("/c"), lastmod: "2026-10-01T00:00:00.000Z" },
				{ url: url("/d"), lastmod: "yesterday" },
			],
		);

		expect(diff.changed).toEqual([]);
		expect(diff.absorbed.map((entry) => entry.url)).toEqual([url("/a"), url("/b"), url("/c"), url("/d")]);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
	});
});

describe("--mode changes, what it does not announce", () => {
	const manyProducts = (count: number, lastmod: (n: number) => string) =>
		shard(...Array.from({ length: count }, (_, n): [string, string] => [`/sk/p-${n}`, lastmod(n)]));

	it("takes a rewrite of the dates for what it is, records it, and still announces the next real change", async () => {
		const w = world({
			"/sitemap.xml": sitemapIndex("sk-products-1"),
			"/sitemaps/sk-products-1.xml": manyProducts(200, () => "2026-10-01T00:00:00.000Z"),
		});
		await changes(w);

		// 2026-10-29: Saleor dates nearly every product the same day.
		w.files["/sitemaps/sk-products-1.xml"] = manyProducts(200, () => "2026-10-29T00:00:00.000Z");
		expect(await changes(w)).toBe(0);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/200 dates moved in one run, more than 25 % of the group/);
		expect(Object.values(seenNow()?.groups["sk-products"] ?? {})).toEqual(
			Array(200).fill("2026-10-29T00:00:00.000Z"),
		);

		// One product really changes afterwards: that goes out.
		w.files["/sitemaps/sk-products-1.xml"] = manyProducts(200, (n) =>
			n === 7 ? "2026-11-08T09:00:00.000Z" : "2026-10-29T00:00:00.000Z",
		);
		await changes(w);
		expect(w.posts).toHaveLength(1);
		expect(w.posts[0]?.urlList).toEqual([url("/sk/p-7")]);
	});

	it("announces a handful of changed dates in a big group, and a group too small for the share to mean anything", async () => {
		const w = world({
			"/sitemap.xml": sitemapIndex("sk-products-1"),
			"/sitemaps/sk-products-1.xml": manyProducts(200, () => "2026-10-01T00:00:00.000Z"),
		});
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = manyProducts(200, (n) =>
			n < BULK_CHANGE_MIN ? "2026-11-08T09:00:00.000Z" : "2026-10-01T00:00:00.000Z",
		);
		await changes(w);

		expect(w.posts[0]?.urlList).toHaveLength(BULK_CHANGE_MIN);

		const small = diffGroup(
			{ [url("/a")]: "2026-10-01T00:00:00.000Z", [url("/b")]: "2026-10-01T00:00:00.000Z" },
			[
				{ url: url("/a"), lastmod: "2026-11-08T00:00:00.000Z" },
				{ url: url("/b"), lastmod: "2026-11-08T00:00:00.000Z" },
			],
		);
		expect(small.bulk).toBe(false);
		expect(small.changed).toHaveLength(2);
	});

	it("leaves a group it could not read exactly as it was, and says so with a failing exit code", async () => {
		const w = SHOP();
		await changes(w);
		const before = snapshot("sk-products");

		w.failing.add("/sitemaps/sk-products-1.xml");
		w.files["/sitemaps/sk-vehicles-1.xml"] = shard(["/sk/stresne-nosice/skoda"], ["/sk/stresne-nosice/audi"]);
		const code = await changes(w);

		expect(code).toBe(1);
		// The others were handled...
		expect(w.posts[0]?.urlList).toEqual([url("/sk/stresne-nosice/audi")]);
		// ...and the unread one was neither emptied nor touched.
		expect(snapshot("sk-products")).toEqual(before);
		expect(logLines.join("\n")).toMatch(/sk-products could not be read/);
	});

	it("does not take a group that comes back empty for the removal of everything in it", async () => {
		const w = SHOP();
		await changes(w);
		const before = snapshot("sk-products");

		w.files["/sitemaps/sk-products-1.xml"] = shard();
		const code = await changes(w);

		expect(code).toBe(1);
		expect(w.posts).toHaveLength(0);
		expect(snapshot("sk-products")).toEqual(before);
		expect(logLines.join("\n")).toMatch(/came back empty where the snapshot holds 3 URLs/);
	});

	it("does not take a product that moves from one part of a market to the next for a removal and an addition", async () => {
		const w = world({
			"/sitemap.xml": sitemapIndex("sk-products-1"),
			"/sitemaps/sk-products-1.xml": shard(
				["/sk/a", "2026-10-29T10:00:00.000Z"],
				["/sk/b", "2026-10-29T10:00:00.000Z"],
			),
		});
		await changes(w);

		// The market grows a second part and the last product of the first moves into it.
		w.files["/sitemap.xml"] = sitemapIndex("sk-products-1", "sk-products-2");
		w.files["/sitemaps/sk-products-1.xml"] = shard(["/sk/a", "2026-10-29T10:00:00.000Z"]);
		w.files["/sitemaps/sk-products-2.xml"] = shard(["/sk/b", "2026-10-29T10:00:00.000Z"]);
		await changes(w);

		expect(w.posts).toHaveLength(0);
		expect(groupOf(url("/sitemaps/sk-products-2.xml"))).toBe("sk-products");
	});

	it("records a market it has not seen before without announcing it: that is the backlog's work", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemap.xml"] = sitemapIndex("sk-pages-1", "sk-vehicles-1", "sk-products-1", "cz-pages-1");
		w.files["/sitemaps/cz-pages-1.xml"] = shard(["/cz"], ["/cz/autochladnicky"]);
		await changes(w);

		expect(w.posts).toHaveLength(0);
		expect(snapshot("cz-pages")).toEqual([url("/cz"), url("/cz/autochladnicky")]);
	});

	it("announces at most --max in a run and finds the rest again at the next one, each exactly once", async () => {
		const w = SHOP();
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a-product", "2026-10-29T10:00:00.000Z"],
			["/sk/b-product", "2026-10-29T10:00:00.000Z"],
			["/sk/c-product", "2026-10-29T10:00:00.000Z"],
			...Array.from({ length: 5 }, (_, n): [string, string] => [`/sk/new-${n}`, "2026-11-08T07:00:00.000Z"]),
		);
		await changes(w, ["--max", "2"]);
		await changes(w, ["--max", "2"]);
		await changes(w, ["--max", "2"]);
		await changes(w, ["--max", "2"]);

		expect(w.posts.map((p) => p.urlList.length)).toEqual([2, 2, 1]);
		const told = w.posts.flatMap((p) => p.urlList);
		expect(new Set(told).size).toBe(5);
		expect(logLines.join("\n")).toMatch(/capped by --max 2; the rest is found again by the next run/);
	});

	it("refuses a sitemap that lists another host, before it sends or writes anything", async () => {
		const w = SHOP();
		await changes(w);
		const seenBefore = readFileSync(seenFile, "utf8");

		w.files["/sitemaps/sk-pages-1.xml"] =
			`<urlset><url><loc>https://elsewhere.example/sk</loc></url></urlset>`;
		const code = await changes(w);

		expect(code).toBe(2);
		expect(w.posts).toHaveLength(0);
		expect(readFileSync(seenFile, "utf8")).toBe(seenBefore);
	});
});

describe("--mode changes, when the engine does not accept", () => {
	it("keeps what a 202 did not confirm out of the snapshot and the state, so the next run says it again", async () => {
		let status = 202;
		const w = world(
			{
				"/sitemap.xml": sitemapIndex("sk-products-1"),
				"/sitemaps/sk-products-1.xml": shard(["/sk/a", "2026-10-29T10:00:00.000Z"]),
			},
			() => status,
		);
		await changes(w);

		w.files["/sitemaps/sk-products-1.xml"] = shard(
			["/sk/a", "2026-10-29T10:00:00.000Z"],
			["/sk/new", "2026-11-08T07:00:00.000Z"],
		);
		expect(await changes(w)).toBe(3);
		expect(snapshot("sk-products")).toEqual([url("/sk/a")]);
		expect(submitted()).toEqual([]);

		status = 200;
		expect(await changes(w)).toBe(0);
		expect(w.posts.at(-1)?.urlList).toEqual([url("/sk/new")]);
		expect(snapshot("sk-products")).toEqual([url("/sk/a"), url("/sk/new")]);
	});
});

describe("--mode changes, what it refuses", () => {
	it("will not fire without both files, because without them it would say the same things every hour", async () => {
		const w = SHOP();
		for (const argv of [
			["--mode", "changes", "--fire"],
			["--mode", "changes", "--state", state, "--fire"],
			["--mode", "changes", "--seen", seenFile, "--fire"],
		]) {
			expect(await run(argv, w)).toBe(2);
		}
		expect(w.posts).toHaveLength(0);
		expect(existsSync(seenFile)).toBe(false);
	});

	it("stops on a snapshot file that is not one, instead of starting over without a word", async () => {
		const w = SHOP();
		writeFileSync(seenFile, JSON.stringify({ version: 7 }));

		expect(await changes(w)).toBe(2);
		expect(w.posts).toHaveLength(0);
		expect(logLines.join("\n")).toMatch(/is not an IndexNow snapshot file/);
	});
});

describe("--mode backlog", () => {
	const world3 = () =>
		world({
			"/sitemap.xml": sitemapIndex("sk-products-1", "sk-vehicles-1", "sk-pages-1"),
			"/sitemaps/sk-pages-1.xml": shard(["/sk"], ["/sk/stresne-nosice"]),
			"/sitemaps/sk-vehicles-1.xml": shard(["/sk/stresne-nosice/skoda"], ["/sk/stresne-nosice/audi"]),
			"/sitemaps/sk-products-1.xml": shard(["/sk/a-product", "2026-11-08T00:00:00.000Z"]),
		});

	it("sends what was never sent, pages first, a limited number a run, and keeps the progress", async () => {
		const w = world3();

		await backlog(w, ["--max", "3"]);
		await backlog(w, ["--max", "3"]);
		await backlog(w, ["--max", "3"]);

		expect(w.posts.map((p) => p.urlList)).toEqual([
			[url("/sk"), url("/sk/stresne-nosice"), url("/sk/stresne-nosice/skoda")],
			[url("/sk/stresne-nosice/audi")],
		]);
		expect(logLines.join("\n")).toMatch(/nothing to send/);
		// It never takes a snapshot: that is the other mode's file.
		expect(existsSync(seenFile)).toBe(false);
	});

	it("does not go back for a URL whose date moved after it was sent: that is a change, and changes announces it", async () => {
		const w = world3();
		writeFileSync(
			state,
			JSON.stringify({
				version: 1,
				submitted: { [url("/sk/a-product")]: "2026-10-01T00:00:00.000Z" },
			}),
		);

		await run(["--mode", "backlog", "--kinds", "products", "--state", state, "--fire"], w);

		expect(w.posts).toHaveLength(0);
	});

	it("will not fire without a state file, whatever the kinds", async () => {
		const w = world3();

		const code = await run(["--mode", "backlog", "--kinds", "pages", "--fire"], w);

		expect(code).toBe(2);
		expect(w.posts).toHaveLength(0);
	});
});

describe("the options of the modes", () => {
	it("gives each mode its own kinds and cap, and leaves the tool as it was when no mode is named", () => {
		expect(readOptions([])).toMatchObject({ mode: "sweep", kinds: ["pages"], max: 10_000 });
		expect(readOptions(["--mode", "changes"])).toMatchObject({
			mode: "changes",
			kinds: ["pages", "vehicles", "products"],
			max: 1_000,
		});
		expect(readOptions(["--mode", "backlog"])).toMatchObject({
			mode: "backlog",
			kinds: ["pages", "vehicles"],
			max: 2_000,
		});
		expect(readOptions(["--mode", "changes", "--kinds", "products", "--max", "50"])).toMatchObject({
			kinds: ["products"],
			max: 50,
		});
	});

	it("pauses a changed URL for a week in the default mode, a day in changes, and takes an explicit number from the line", () => {
		expect(readOptions([]).resendAfterDays).toBe(7);
		expect(readOptions(["--mode", "backlog"]).resendAfterDays).toBe(7);
		expect(readOptions(["--mode", "changes"]).resendAfterDays).toBe(1);
		expect(readOptions(["--mode", "changes", "--resend-after-days", "3"]).resendAfterDays).toBe(3);
		expect(readOptions(["--mode", "changes", "--resend-after-days", "0"]).resendAfterDays).toBe(0);
		expect(readOptions(["--resend-after-days", "x"]).error).toMatch(/--resend-after-days/);
	});

	it("refuses an unknown mode, and named URLs in a mode that decides for itself", () => {
		expect(readOptions(["--mode", "everything"]).error).toMatch(/--mode takes sweep, changes, backlog/);
		expect(readOptions(["--mode", "changes", "--urls", "/sk"]).error).toMatch(/belongs to the default mode/);
		expect(readOptions(["--mode", "backlog", "--urls", "/sk"]).error).toMatch(/belongs to the default mode/);
		expect(readOptions(["--urls", "/sk"]).error).toBeUndefined();
	});

	it("keeps the snapshot in a plain object per group, with the empty string for a page without a date", () => {
		expect(
			snapshotOf([
				{ url: url("/a"), lastmod: null },
				{ url: url("/b"), lastmod: "2026-11-08" },
			]),
		).toEqual({
			[url("/a")]: "",
			[url("/b")]: "2026-11-08",
		});
	});
});

describe("scripts/ops/systemd, the hourly run (what changed)", () => {
	const root = process.cwd();
	const read = (name: string) => readFileSync(join(root, "scripts/ops/systemd", name), "utf8");
	const unit = read("maky-indexnow-changes.service");
	const timer = read("maky-indexnow-changes.timer");
	const backlogUnit = read("maky-indexnow.service");

	const execStart = (text: string) => {
		const line = text.split("\n").find((l) => l.startsWith("ExecStart="));
		expect(line).toBeDefined();
		return line as string;
	};
	const argsOf = (line: string) =>
		line
			.slice(line.indexOf("indexnow.mjs") + "indexnow.mjs".length)
			.trim()
			.split(/\s+/);

	it("starts the tool in changes mode with options it accepts, every kind, and both files outside the checkout", () => {
		const options = readOptions(argsOf(execStart(unit)));

		expect(options.error).toBeUndefined();
		expect(options).toMatchObject({
			fire: true,
			mode: "changes",
			kinds: ["pages", "vehicles", "products"],
			max: 1_000,
			resendAfterDays: 1,
		});
		// A deploy replaces the checkout's files; the progress must not live there.
		expect(options.state).toMatch(/^\/var\/lib\/maky-indexnow\//);
		expect(options.seen).toMatch(/^\/var\/lib\/maky-indexnow\//);
		expect(options.state).not.toBe(options.seen);
		expect(unit).toMatch(/^StateDirectory=maky-indexnow$/m);
	});

	it("takes turns with the daily run: the same lock, held for the whole run, inside the state directory", () => {
		const lockOf = (line: string) => /^ExecStart=\/usr\/bin\/flock -w (\d+) (\S+) /.exec(line);
		const hourly = lockOf(execStart(unit));
		const daily = lockOf(execStart(backlogUnit));

		expect(hourly).not.toBeNull();
		expect(daily).not.toBeNull();
		expect(hourly?.[2]).toBe(daily?.[2]);
		expect(hourly?.[2]).toMatch(/^\/var\/lib\/maky-indexnow\/[^/]+\.lock$/);
		// Waiting must outlast a run (seconds) and stay far inside the unit's own timeout.
		for (const wait of [hourly?.[1], daily?.[1]]) {
			expect(Number(wait)).toBeGreaterThanOrEqual(300);
			expect(Number(wait)).toBeLessThan(30 * 60);
		}
		// ... and the two units do not do the same job.
		expect(readOptions(argsOf(execStart(backlogUnit))).mode).toBe("backlog");
	});

	it("skips while a deploy runs, by the lock the deploy script itself takes", () => {
		const lock = /LOCK_FILE="\$\{LOCK_FILE:-([^}]+)\}"/.exec(
			readFileSync(join(root, "scripts/ops/deploy-production.sh"), "utf8"),
		)?.[1];
		expect(lock).toBe("/run/lock/maky-storefront-deploy.lock");
		expect(unit).toContain(`ExecCondition=/usr/bin/flock -n ${lock} -c true`);
	});

	it("runs every hour except the ones that would fall inside the CarFitManager windows, each with half an hour to spare", () => {
		const at = /^OnCalendar=\*-\*-\* ([0-9,.]+):(\d\d):00 UTC$/m.exec(timer);
		expect(at).not.toBeNull();
		const hours = new Set<number>();
		for (const part of (at as RegExpExecArray)[1].split(",")) {
			const [from, to = from] = part.split("..").map(Number) as [number, number?];
			for (let hour = from; hour <= (to as number); hour += 1) hours.add(hour);
		}
		// 01:30 to 02:04 and 03:15 to 05:00 UTC every day; Mondays also about 02:30 to 03:04 (all inside these).
		const windows: [number, number][] = [
			[90, 124],
			[195, 300],
		];
		for (const hour of hours) {
			const minute = hour * 60 + Number((at as RegExpExecArray)[2]);
			for (const [from, to] of windows) {
				expect(minute < from - 30 || minute > to + 30, `${hour}:${(at as RegExpExecArray)[2]}`).toBe(true);
			}
		}
		// Nothing else is left out: the five hours of the windows, and only them.
		expect([...Array(24).keys()].filter((hour) => !hours.has(hour))).toEqual([1, 2, 3, 4]);
		expect(timer).toMatch(/^Persistent=true$/m);
	});

	it("keeps the ceilings on a job that must not compete with the shop, with room for the snapshot", () => {
		expect(unit).toMatch(/^Nice=\d+$/m);
		expect(unit).toMatch(/^MemorySwapMax=0$/m);
		// 256 000 URLs peaked at ~300 MB above the bare interpreter in the synthetic run of 2026-11-07.
		expect(unit).toMatch(/^MemoryMax=(?:[1-9]\d*G|[1-9]\d{3,}M)$/m);
		// It reads the public sitemaps and writes two files; nothing of PM2, nginx or .env (comments aside).
		const settings = unit
			.split("\n")
			.filter((l) => l.trim() && !l.trim().startsWith("#"))
			.join("\n");
		expect(settings).not.toMatch(/pm2|nginx|\.env|--update-env/i);
	});
});
