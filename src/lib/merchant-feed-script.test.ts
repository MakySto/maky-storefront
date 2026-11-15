import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	addWorkingDays,
	availabilityDate,
	formatPrice,
	isLoopback,
	main,
	mayReplace,
	readOptions,
	readSecret,
	renderItem,
	xmlEscape,
} from "../../scripts/ops/merchant-feed.mjs";

/**
 * The writer of the Merchant feeds (`scripts/ops/merchant-feed.mjs`), run against a small shop: the
 * internal route with its steps, a secret file and a directory to write into. What matters is what ends
 * up on disk, and above all when NOTHING may: a walk that failed, an empty feed, a feed that shrank.
 */

const SECRET = "an-obviously-fake-secret-for-this-test-only";
const NOW = new Date("2026-11-16T05:20:00Z"); // a Monday

const item = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	title: `Strešný box ${id}`,
	description: "Box pre celú rodinu & lyže",
	link: `https://maky.store/sk/box-${id.toLowerCase()}`,
	imageLink: `https://media.maky.store/${id}.jpg`,
	additionalImageLinks: [],
	price: { amount: 899, currency: "EUR" },
	availability: "backorder",
	backorderWorkingDays: 10,
	brand: "Thule",
	...over,
});

type Step = {
	market: string;
	read: number;
	items: unknown[];
	skipped: Record<string, number>;
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

const step = (items: unknown[], next: string | null, skipped: Record<string, number> = {}): Step => ({
	market: "sk",
	read: items.length + Object.values(skipped).reduce((a, b) => a + b, 0),
	items,
	skipped,
	pageInfo: { hasNextPage: next !== null, endCursor: next },
});

let dir: string;
let secretFile: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "maky-feed-script-"));
	secretFile = join(dir, "shop.env");
	writeFileSync(secretFile, `NEXT_PUBLIC_X=1\nREVALIDATE_SECRET="${SECRET}"\n`);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** A shop whose route answers `steps[market]` in order, keyed by the cursor that leads to each. */
function world(steps: Record<string, Step[]>, options: { status?: (call: number, url: URL) => number } = {}) {
	const calls: { url: URL; authorization: string | null }[] = [];
	const lines: string[] = [];
	const sleeps: number[] = [];
	const fetchImpl = async (input: URL | string, init?: { headers?: Record<string, string> }) => {
		const url = new URL(String(input));
		calls.push({ url, authorization: init?.headers?.authorization ?? null });
		const status = options.status?.(calls.length, url) ?? 200;
		if (status !== 200) return new Response("no", { status });
		const market = url.searchParams.get("market")!;
		const after = url.searchParams.get("after");
		const list = steps[market];
		if (!list) return new Response("Not Found", { status: 404 });
		const index = after === null ? 0 : Number(after.replace("c", ""));
		return Response.json(list[index]);
	};
	const run = (...args: string[]) =>
		main(["--out", join(dir, "feeds"), "--secret-file", secretFile, "--pause-ms", "0", ...args], {
			fetch: fetchImpl,
			log: (line: string) => lines.push(line),
			now: () => NOW,
			sleep: async (ms: number) => void sleeps.push(ms),
			retryWaitsMs: [1, 2],
		});
	const feed = (market: string) =>
		gunzipSync(readFileSync(join(dir, "feeds", `google-${market}.xml.gz`))).toString();
	const status = () =>
		JSON.parse(readFileSync(join(dir, "feeds", "status.json"), "utf8")) as {
			markets: Record<string, { items: number } & Record<string, unknown>>;
		};
	return { run, calls, lines, sleeps, feed, status, out: join(dir, "feeds") };
}

const twoSteps = { sk: [step([item("V1"), item("V2")], "c1", { "no-brand": 3 }), step([item("V3")], null)] };

describe("rendering", () => {
	it("escapes text and drops characters XML does not allow", () => {
		expect(xmlEscape(`Tom & "Jerry" <b>\u0001x`)).toBe(`Tom &amp; "Jerry" &lt;b&gt;x`);
	});

	it("states a price with two decimals and its currency", () => {
		expect(formatPrice({ amount: 899, currency: "EUR" })).toBe("899.00 EUR");
		expect(formatPrice({ amount: 22990.5, currency: "CZK" })).toBe("22990.50 CZK");
	});

	it("counts working days over the weekend", () => {
		// Monday 16 November + 10 working days = Monday 30 November.
		expect(addWorkingDays(NOW, 10).toISOString().slice(0, 10)).toBe("2026-11-30");
		// From a Friday, one working day is the Monday.
		expect(addWorkingDays(new Date("2026-11-20T23:59:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-11-23");
		expect(availabilityDate(NOW, 14)).toBe("2026-12-04T00:00Z");
	});

	it("writes a made-to-order item with its date, and every field Google asks for", () => {
		const xml = renderItem(
			item("V1", {
				gtin: "7313020079820",
				isBundle: true,
				salePrice: { amount: 799, currency: "EUR" },
				shippingWeight: { value: 26.5, unit: "kg" },
				productType: "Strešné boxy",
				additionalImageLinks: ["https://media.maky.store/b.jpg"],
			}),
			{ now: NOW },
		);
		for (const line of [
			"<g:id>V1</g:id>",
			"<g:title>Strešný box V1</g:title>",
			"<g:description>Box pre celú rodinu &amp; lyže</g:description>",
			"<g:link>https://maky.store/sk/box-v1</g:link>",
			"<g:image_link>https://media.maky.store/V1.jpg</g:image_link>",
			"<g:additional_image_link>https://media.maky.store/b.jpg</g:additional_image_link>",
			"<g:availability>backorder</g:availability>",
			"<g:availability_date>2026-11-30T00:00Z</g:availability_date>",
			"<g:price>899.00 EUR</g:price>",
			"<g:sale_price>799.00 EUR</g:sale_price>",
			"<g:brand>Thule</g:brand>",
			"<g:gtin>7313020079820</g:gtin>",
			"<g:is_bundle>yes</g:is_bundle>",
			"<g:condition>new</g:condition>",
			"<g:shipping_weight>26.5 kg</g:shipping_weight>",
			"<g:product_type>Strešné boxy</g:product_type>",
		]) {
			expect(xml).toContain(line);
		}
	});

	it("gives no date to an item on the shelf, and says nothing about delivery or a part number", () => {
		const xml = renderItem(item("V1", { availability: "in_stock", backorderWorkingDays: undefined }), {
			now: NOW,
		});
		expect(xml).toContain("<g:availability>in_stock</g:availability>");
		expect(xml).not.toContain("availability_date");
		expect(xml).not.toContain("g:shipping>");
		expect(xml).not.toContain("g:mpn");
	});
});

describe("options and the secret", () => {
	it("is a dry run of Slovakia unless told otherwise", () => {
		expect(readOptions([])).toMatchObject({ markets: ["sk"], write: false, origin: "http://127.0.0.1:3000" });
		expect(readOptions(["--markets", "sk, cz,sk"]).markets).toEqual(["sk", "cz"]);
	});

	it("refuses what is not a market code, and a partial walk that would be written", () => {
		expect(() => readOptions(["--markets", "sk,../etc"])).toThrow(/market codes/);
		expect(() => readOptions(["--markets", ""])).toThrow(/market codes/);
		expect(() => readOptions(["--write", "--max-pages", "3"])).toThrow(/dry run/);
		expect(() => readOptions(["--page-size", "500"])).toThrow(/page-size/);
	});

	it("knows this machine from any other", () => {
		expect(isLoopback("http://127.0.0.1:3000")).toBe(true);
		expect(isLoopback("http://localhost:3100")).toBe(true);
		expect(isLoopback("https://maky.store")).toBe(false);
		expect(isLoopback("http://127.0.0.1.evil.example")).toBe(false);
		expect(isLoopback("not a url")).toBe(false);
	});

	it("reads one variable from an env file, quoted or not", () => {
		expect(readSecret(`A=1\nREVALIDATE_SECRET=abc123\n`)).toBe("abc123");
		expect(readSecret(`export REVALIDATE_SECRET='abc 123'\n`)).toBe("abc 123");
		expect(readSecret(`# REVALIDATE_SECRET=commented\nOTHER_REVALIDATE_SECRET=x\n`)).toBeNull();
		expect(readSecret(`REVALIDATE_SECRET=\n`)).toBeNull();
	});

	it("never sends the secret anywhere but this machine, and never prints it", async () => {
		const { run, calls, lines } = world(twoSteps);
		expect(await run("--origin", "https://maky.store", "--write")).toBe(2);
		expect(calls).toHaveLength(0);

		expect(await run("--write")).toBe(0);
		expect(calls.every((call) => call.authorization === `Bearer ${SECRET}`)).toBe(true);
		expect(lines.join("\n")).not.toContain(SECRET);
	});

	it("refuses to run without the secret", async () => {
		writeFileSync(secretFile, "OTHER=1\n");
		const { run, calls, lines } = world(twoSteps);
		expect(await run("--write")).toBe(2);
		expect(calls).toHaveLength(0);
		expect(lines.join("\n")).toContain("REVALIDATE_SECRET was not found");
	});
});

describe("mayReplace", () => {
	it("never an empty feed, not even with --force", () => {
		expect(mayReplace({ previous: 100, items: 0, minShare: 0.5, force: true }).ok).toBe(false);
		expect(mayReplace({ previous: undefined, items: 0, minShare: 0.5, force: false }).ok).toBe(false);
	});

	it("a first feed, a grown feed and a feed that lost less than half are written", () => {
		expect(mayReplace({ previous: undefined, items: 5, minShare: 0.5, force: false }).ok).toBe(true);
		expect(mayReplace({ previous: 100, items: 400, minShare: 0.5, force: false }).ok).toBe(true);
		expect(mayReplace({ previous: 100, items: 50, minShare: 0.5, force: false }).ok).toBe(true);
	});

	it("a feed that lost more than half waits for --force", () => {
		expect(mayReplace({ previous: 100, items: 49, minShare: 0.5, force: false }).ok).toBe(false);
		expect(mayReplace({ previous: 100, items: 49, minShare: 0.5, force: true }).ok).toBe(true);
	});
});

describe("a run", () => {
	it("a dry run reads two steps, prints the plan and writes nothing", async () => {
		const long = { sk: [step([item("V1")], "c1"), step([item("V2")], "c2"), step([item("V3")], null)] };
		const { run, calls, lines, out } = world(long);

		expect(await run()).toBe(0);
		expect(calls).toHaveLength(2);
		expect(existsSync(out)).toBe(false);
		expect(lines.join("\n")).toContain("2 feed item(s)");
		expect(lines.join("\n")).toContain("<g:id>V1</g:id>");
		expect(lines.at(-1)).toContain("dry run");
	});

	it("writes the whole market as one valid gzip file and records what it wrote", async () => {
		const { run, calls, feed, status, lines, out } = world(twoSteps);
		expect(await run("--write")).toBe(0);

		expect(calls.map((call) => call.url.searchParams.get("after"))).toEqual([null, "c1"]);
		expect(calls[0]!.url.pathname).toBe("/api/internal/merchant-feed");
		expect(calls[0]!.url.searchParams.get("first")).toBe("50");

		const xml = feed("sk");
		expect(
			xml.startsWith(
				`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
			),
		).toBe(true);
		expect(xml.trimEnd().endsWith("</channel>\n</rss>")).toBe(true);
		expect(xml.match(/<item>/g)).toHaveLength(3);
		expect(xml).toContain("<link>https://maky.store/sk</link>");

		expect(status().markets.sk).toMatchObject({
			file: "google-sk.xml.gz",
			generatedAt: NOW.toISOString(),
			read: 6,
			items: 3,
			skipped: { "no-brand": 3 },
		});
		expect(readdirSync(out).sort()).toEqual(["google-sk.xml.gz", "status.json"]);
		expect(lines.join("\n")).toContain("left out: no-brand 3");
	});

	it("drops an id that comes twice", async () => {
		const { run, feed, lines } = world({ sk: [step([item("V1"), item("V1"), item("V2")], null)] });
		expect(await run("--write")).toBe(0);
		expect(feed("sk").match(/<item>/g)).toHaveLength(2);
		expect(lines.join("\n")).toContain("1 repeated id(s) dropped");
	});

	it("tries a failed step again, and carries on when it answers", async () => {
		const { run, feed, sleeps } = world(twoSteps, { status: (call) => (call === 2 ? 502 : 200) });
		expect(await run("--write")).toBe(0);
		expect(feed("sk").match(/<item>/g)).toHaveLength(3);
		expect(sleeps).toContain(1);
	});

	it("a step that never answers ends the market and leaves yesterday's feed alone", async () => {
		const first = world(twoSteps);
		expect(await first.run("--write")).toBe(0);
		const before = readFileSync(join(first.out, "google-sk.xml.gz"));

		const second = world(twoSteps, { status: (_call, url) => (url.searchParams.get("after") ? 502 : 200) });
		expect(await second.run("--write")).toBe(1);
		expect(readFileSync(join(second.out, "google-sk.xml.gz")).equals(before)).toBe(true);
		expect(readdirSync(second.out).sort()).toEqual(["google-sk.xml.gz", "status.json"]);
		expect(second.lines.join("\n")).toContain("The feed of the last run stays");
	});

	it("does not retry a 404: the route is absent or the secret is not the shop's", async () => {
		const { run, calls, lines, out } = world(twoSteps, { status: () => 404 });
		expect(await run("--write")).toBe(1);
		expect(calls).toHaveLength(1);
		expect(lines.join("\n")).toContain("answered 404");
		expect(readdirSync(out)).toEqual([]);
	});

	it("an answer that is not a feed step, or holds a broken item, stops the walk", async () => {
		const broken = world({ sk: [{ nonsense: true } as unknown as Step] });
		expect(await broken.run("--write")).toBe(1);

		const noPrice = world({ sk: [step([item("V1", { price: null })], null)] });
		expect(await noPrice.run("--write")).toBe(1);
		expect(readdirSync(noPrice.out)).toEqual([]);
	});

	it("a walk that does not advance is an error, not an endless loop", async () => {
		const stuck = world({ sk: [step([item("V1")], "c1"), step([item("V2")], "c1")] });
		expect(await stuck.run("--write")).toBe(1);
		expect(stuck.calls.length).toBe(2);
	});

	it("never writes an empty feed", async () => {
		const { run, out, lines } = world({ sk: [step([], null, { "no-brand": 40 })] });
		expect(await run("--write")).toBe(2);
		expect(readdirSync(out)).toEqual([]);
		expect(lines.join("\n")).toContain("the feed would be empty");
	});

	it("keeps the last feed when the new one lost more than half, until --force", async () => {
		const full = world({ sk: [step([item("V1"), item("V2"), item("V3"), item("V4"), item("V5")], null)] });
		expect(await full.run("--write")).toBe(0);

		const shrunk = world({ sk: [step([item("V1"), item("V2")], null)] });
		expect(await shrunk.run("--write")).toBe(2);
		expect(shrunk.feed("sk").match(/<item>/g)).toHaveLength(5);
		expect(shrunk.status().markets.sk.items).toBe(5);

		expect(await shrunk.run("--write", "--force")).toBe(0);
		expect(shrunk.feed("sk").match(/<item>/g)).toHaveLength(2);
	});

	it("one market failing does not stop the next, and the run still says so", async () => {
		const steps = {
			sk: [step([item("V1")], null)],
			cz: [step([item("V9", { price: { amount: 22990, currency: "CZK" } })], null)],
		};
		const { run, feed, out } = world(steps, {
			status: (_call, url) => (url.searchParams.get("market") === "sk" ? 500 : 200),
		});
		expect(await run("--write", "--markets", "sk,cz")).toBe(1);
		expect(existsSync(join(out, "google-sk.xml.gz"))).toBe(false);
		expect(feed("cz")).toContain("<g:price>22990.00 CZK</g:price>");
	});
});
