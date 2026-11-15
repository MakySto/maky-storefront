import { createVerify, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
	API_BASE,
	TOKEN_URL,
	main,
	mayTell,
	parseKey,
	planFor,
	productInputOf,
	readOptions,
	toMicros,
} from "../../scripts/ops/merchant-api.mjs";
import { main as writeFeed } from "../../scripts/ops/merchant-feed.mjs";

/**
 * The program that tells Google about a changed price or availability between two feeds
 * (`scripts/ops/merchant-api.mjs`), run against a small shop and a small Google: the shop's internal
 * route, Google's token address, and the three parts of the Merchant API it reads and writes. What
 * matters is what is sent, and above all when NOTHING may be: a dry run, a walk that failed, an account
 * that is not linked, a change too large to be a change.
 */

const SECRET = "an-obviously-fake-secret-for-this-test-only";
const NOW = new Date("2026-11-16T09:35:00Z"); // a Monday
const ACCOUNT = "1234567";
const SUPPLEMENTAL = `accounts/${ACCOUNT}/dataSources/222`;
const PRIMARY = `accounts/${ACCOUNT}/dataSources/111`;

type Offer = { p: string; s: string | null; a: string; d: number | null };

const item = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	title: `Strešný box ${id}`,
	description: "Box",
	link: `https://maky.store/sk/box-${id.toLowerCase()}`,
	imageLink: `https://media.maky.store/${id}.jpg`,
	additionalImageLinks: [],
	price: { amount: 899, currency: "EUR" },
	availability: "in_stock",
	brand: "Thule",
	...over,
});

const step = (items: unknown[], next: string | null) => ({
	market: "sk",
	read: items.length,
	items,
	skipped: {},
	pageInfo: { hasNextPage: next !== null, endCursor: next },
});

const offer = (p: string, a = "in_stock", s: string | null = null, d: number | null = null): Offer => ({
	p,
	s,
	a,
	d,
});

/** A key pair made for this run of the suite. Nothing of a real account is in this file. */
let keyText: string;
let publicKey: string;

beforeAll(() => {
	const pair = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});
	publicKey = pair.publicKey;
	keyText = JSON.stringify({
		type: "service_account",
		project_id: "a-test-project",
		private_key_id: "test-key-id",
		private_key: pair.privateKey,
		client_email: "feed-test@a-test-project.iam.gserviceaccount.com",
		token_uri: "https://example.invalid/never-used",
	});
});

let dir: string;
let out: string;
let secretFile: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "maky-merchant-api-"));
	out = join(dir, "feeds");
	mkdirSync(out);
	secretFile = join(dir, "shop.env");
	writeFileSync(secretFile, `REVALIDATE_SECRET="${SECRET}"\n`);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const writeOffers = (offers: Record<string, Offer>) =>
	writeFileSync(
		join(out, "offers-sk.json"),
		JSON.stringify({ version: 1, market: "sk", generatedAt: "2026-11-16T05:05:00.000Z", offers }),
	);

const state = () =>
	JSON.parse(readFileSync(join(out, "api-sk.json"), "utf8")) as {
		dataSource: string;
		pushed: Record<string, { o: Offer; at: string }>;
		missing: Record<string, string>;
	};

type Source = Record<string, unknown>;

const feedSource = (
	rule: unknown[] | null = [{ supplementalDataSourceName: SUPPLEMENTAL }, { self: true }],
): Source => ({
	name: PRIMARY,
	displayName: "Feed SK",
	input: "FILE",
	primaryProductDataSource: {
		feedLabel: "SK",
		contentLanguage: "sk",
		...(rule ? { defaultRule: { takeFromDataSources: rule } } : {}),
	},
	fileInput: {
		fetchSettings: {
			enabled: true,
			frequency: "FREQUENCY_DAILY",
			timeOfDay: { hours: 7 },
			timeZone: "Europe/Bratislava",
			fetchUri: "https://maky.store/feeds/google-sk.xml.gz",
		},
	},
});

const apiSource = (over: Source = {}): Source => ({
	name: SUPPLEMENTAL,
	displayName: "MAKY API",
	input: "API",
	supplementalProductDataSource: {},
	...over,
});

/** A legacy source of the retired Content API, as the owner's account holds one: primary, API, no products. */
const legacySource: Source = {
	name: `accounts/${ACCOUNT}/dataSources/9`,
	displayName: "Content API",
	input: "API",
	primaryProductDataSource: { feedLabel: "SK", contentLanguage: "sk" },
};

function world(
	shop: unknown[][],
	google: {
		sources?: Source[];
		accounts?: string[];
		insert?: (call: number, body: Record<string, unknown>) => { status: number; message?: string };
		token?: number;
		shopStatus?: (call: number) => number;
	} = {},
) {
	const lines: string[] = [];
	const sleeps: number[] = [];
	const inserts: { dataSource: string | null; body: Record<string, any>; authorization: string | null }[] =
		[];
	const outside: string[] = [];
	const tokens: string[] = [];
	let shopCalls = 0;
	let insertCalls = 0;

	const fetchImpl = async (
		input: URL | string,
		init?: { method?: string; headers?: Record<string, string>; body?: unknown },
	) => {
		const url = new URL(String(input));
		const authorization = init?.headers?.authorization ?? null;

		if (url.origin === "http://127.0.0.1:3000") {
			shopCalls += 1;
			const status = google.shopStatus?.(shopCalls) ?? 200;
			if (status !== 200) return new Response("no", { status });
			if (authorization !== `Bearer ${SECRET}`) return new Response("Not Found", { status: 404 });
			const after = url.searchParams.get("after");
			const index = after === null ? 0 : Number(after.replace("c", ""));
			return Response.json(step(shop[index]!, index + 1 < shop.length ? `c${index + 1}` : null));
		}

		// Everything else is Google. The shop's secret must never be seen here.
		outside.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
		if (authorization?.includes(SECRET)) throw new Error("the shop's secret left the machine");

		if (String(input) === TOKEN_URL) {
			if (google.token && google.token !== 200)
				return Response.json({ error: "invalid_grant" }, { status: google.token });
			const assertion = new URLSearchParams(String(init?.body)).get("assertion")!;
			const [header, claims, signature] = assertion.split(".") as [string, string, string];
			const good = createVerify("RSA-SHA256")
				.update(`${header}.${claims}`)
				.verify(publicKey, Buffer.from(signature, "base64url"));
			const said = JSON.parse(Buffer.from(claims, "base64url").toString()) as Record<string, unknown>;
			if (!good || said.aud !== TOKEN_URL || said.scope !== "https://www.googleapis.com/auth/content") {
				return Response.json({ error: "invalid_grant" }, { status: 400 });
			}
			tokens.push(String(said.iss));
			return Response.json({ access_token: "a-test-token", expires_in: 3600 });
		}
		if (url.origin !== API_BASE) throw new Error(`unexpected request to ${url.origin}`);
		if (authorization !== "Bearer a-test-token")
			return Response.json({ error: { message: "no token" } }, { status: 401 });

		if (url.pathname === "/accounts/v1/accounts") {
			return Response.json({
				accounts: (google.accounts ?? [ACCOUNT]).map((id) => ({ name: `accounts/${id}`, accountId: id })),
			});
		}
		if (url.pathname === `/datasources/v1/accounts/${ACCOUNT}/dataSources`) {
			return Response.json({ dataSources: google.sources ?? [legacySource, feedSource(), apiSource()] });
		}
		if (url.pathname === `/quota/v1/accounts/${ACCOUNT}/quotas`) {
			return Response.json({
				quotaGroups: [
					{
						quotaUsage: "12",
						quotaLimit: "70000",
						quotaMinuteLimit: "1000",
						methodDetails: [
							{ method: "InsertProductInput", path: "/products/v1/{parent=accounts/*}/productInputs:insert" },
						],
					},
				],
			});
		}
		if (url.pathname === `/products/v1/accounts/${ACCOUNT}/productInputs:insert`) {
			insertCalls += 1;
			const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
			const verdict = google.insert?.(insertCalls, body) ?? { status: 200 };
			if (verdict.status !== 200) {
				return Response.json(
					{ error: { message: verdict.message ?? "refused" } },
					{ status: verdict.status },
				);
			}
			inserts.push({ dataSource: url.searchParams.get("dataSource"), body, authorization });
			return Response.json(body);
		}
		if (url.pathname.startsWith(`/products/v1/accounts/${ACCOUNT}/products/`)) {
			const name = Buffer.from(url.pathname.split("/").pop()!, "base64url").toString();
			if (name !== "sk~SK~V1==") return Response.json({ error: { message: "not found" } }, { status: 404 });
			return Response.json({
				productAttributes: {
					price: { amountMicros: "899000000", currencyCode: "EUR" },
					availability: "IN_STOCK",
				},
			});
		}
		throw new Error(`unexpected Google path ${url.pathname}`);
	};

	const run = (...args: string[]) =>
		main(["--out", out, "--secret-file", secretFile, "--pause-ms", "0", "--send-pause-ms", "0", ...args], {
			fetch: fetchImpl,
			log: (line: string) => lines.push(line),
			now: () => NOW,
			sleep: async (ms: number) => void sleeps.push(ms),
			retryWaitsMs: [1, 2],
			sendRetryWaitsMs: [1, 2],
			readKey: async () => keyText,
		});
	return { run, lines, sleeps, inserts, outside, tokens, text: () => lines.join("\n") };
}

describe("the request", () => {
	it("states a price in micros without a float in between", () => {
		expect(toMicros("899.00 EUR")).toEqual({ amountMicros: "899000000", currencyCode: "EUR" });
		expect(toMicros("37.90 EUR")).toEqual({ amountMicros: "37900000", currencyCode: "EUR" });
		expect(toMicros("22990.55 CZK")).toEqual({ amountMicros: "22990550000", currencyCode: "CZK" });
		expect(() => toMicros("899 EUR")).toThrow();
	});

	it("sends the id, the label, the language, the price and the availability, and nothing else", () => {
		expect(
			productInputOf({
				id: "V1",
				offer: offer("849.00 EUR"),
				fileOffer: offer("899.00 EUR"),
				feedLabel: "SK",
				contentLanguage: "sk",
				now: NOW,
			}),
		).toEqual({
			offerId: "V1",
			contentLanguage: "sk",
			feedLabel: "SK",
			productAttributes: {
				price: { amountMicros: "849000000", currencyCode: "EUR" },
				availability: "IN_STOCK",
			},
		});
	});

	it("a sale states both prices", () => {
		const body = productInputOf({
			id: "V1",
			offer: offer("899.00 EUR", "in_stock", "799.00 EUR"),
			fileOffer: offer("899.00 EUR"),
			feedLabel: "SK",
			contentLanguage: "sk",
			now: NOW,
		});
		expect(body.productAttributes).toEqual({
			price: { amountMicros: "899000000", currencyCode: "EUR" },
			salePrice: { amountMicros: "799000000", currencyCode: "EUR" },
			availability: "IN_STOCK",
		});
	});

	it("a sale the feed still states is ended by its dates, because an attribute cannot be taken away", () => {
		const body = productInputOf({
			id: "V1",
			offer: offer("899.00 EUR"),
			fileOffer: offer("899.00 EUR", "in_stock", "799.00 EUR"),
			feedLabel: "SK",
			contentLanguage: "sk",
			now: NOW,
		});
		expect(body.productAttributes).toEqual({
			price: { amountMicros: "899000000", currencyCode: "EUR" },
			availability: "IN_STOCK",
			salePriceEffectiveDate: { startTime: "2000-01-01T00:00:00Z", endTime: "2026-11-16T09:35:00Z" },
		});
	});

	it("a made-to-order item carries the date the page's working days lead to", () => {
		const body = productInputOf({
			id: "V1",
			offer: offer("899.00 EUR", "backorder", null, 10),
			fileOffer: offer("899.00 EUR"),
			feedLabel: "SK",
			contentLanguage: "sk",
			now: NOW,
		});
		// Monday 16 November + 10 working days = Monday 30 November.
		expect(body.productAttributes).toMatchObject({
			availability: "BACKORDER",
			availabilityDate: "2026-11-30T00:00:00Z",
		});
	});
});

describe("the plan", () => {
	const file = { A: offer("10.00 EUR"), B: offer("20.00 EUR"), C: offer("30.00 EUR", "out_of_stock") };

	it("sends only what differs from what Google was last told", () => {
		const plan = planFor({
			file,
			pushed: {},
			missing: {},
			current: {
				A: offer("10.00 EUR"),
				B: offer("19.00 EUR"),
				C: offer("30.00 EUR", "in_stock"),
				NEW: offer("5.00 EUR"),
			},
			now: NOW,
		});
		expect(plan.send.map((change) => change.id)).toEqual(["B", "C"]);
		expect(plan).toMatchObject({ unchanged: 1, waiting: 1, total: 3, missingNext: {} });
	});

	it("what this program sent stands for what Google knows, not the feed", () => {
		// B was sent as 19: the supplemental source holds 19 and wins over the feed's 20.
		const pushed = { B: { o: offer("19.00 EUR"), at: "x" } };
		const still = planFor({
			file,
			pushed,
			missing: {},
			current: { ...file, B: offer("19.00 EUR") },
			now: NOW,
		});
		expect(still.send).toEqual([]);
		// Back at the feed's price: Google must be told, although the shop and the feed agree again.
		const back = planFor({ file, pushed, missing: {}, current: file, now: NOW });
		expect(back.send.map((change) => [change.id, change.offer.p])).toEqual([["B", "20.00 EUR"]]);
	});

	it("the date of a made-to-order item moving is not a change", () => {
		const made = { A: offer("10.00 EUR", "backorder", null, 10) };
		const plan = planFor({
			file: made,
			pushed: {},
			missing: {},
			current: { A: offer("10.00 EUR", "backorder", null, 14) },
			now: NOW,
		});
		expect(plan.send).toEqual([]);
	});

	it("a product the walk misses once is only noted; missed twice it is told out of stock", () => {
		const first = planFor({ file, pushed: {}, missing: {}, current: { A: file.A }, now: NOW });
		expect(first.send).toEqual([]);
		expect(first.missingNext).toEqual({ B: NOW.toISOString() });

		const second = planFor({
			file,
			pushed: {},
			missing: first.missingNext,
			current: { A: file.A },
			now: new Date("2026-11-16T10:35:00Z"),
		});
		expect(second.send).toEqual([
			{ id: "B", offer: offer("20.00 EUR", "out_of_stock"), told: file.B, fileOffer: file.B, gone: true },
		]);
		// C was out of stock already: nothing to say about it.
		expect(second.missingNext).toEqual({ B: NOW.toISOString() });
	});

	it("a product that is back is forgotten as missing", () => {
		const plan = planFor({ file, pushed: {}, missing: { B: "earlier" }, current: file, now: NOW });
		expect(plan).toMatchObject({ send: [], missingNext: {} });
	});

	it("a few changes always go, a quarter of the feed at once does not", () => {
		expect(mayTell({ changes: 20, total: 30, maxShare: 0.25, force: false }).ok).toBe(true);
		expect(mayTell({ changes: 250, total: 1000, maxShare: 0.25, force: false }).ok).toBe(true);
		expect(mayTell({ changes: 251, total: 1000, maxShare: 0.25, force: false }).ok).toBe(false);
		expect(mayTell({ changes: 251, total: 1000, maxShare: 0.25, force: true }).ok).toBe(true);
	});
});

describe("options and the key", () => {
	it("is a dry run of Slovakia unless told otherwise", () => {
		expect(readOptions([])).toMatchObject({ market: "sk", fire: false, check: false, show: null, max: 500 });
	});

	it("refuses two kinds of run at once, and what is not a market, an account or a parameter name", () => {
		expect(() => readOptions(["--fire", "--check"])).toThrow(/different runs/);
		expect(() => readOptions(["--market", "sk,cz"])).toThrow(/one market/);
		expect(() => readOptions(["--account", "accounts/1"])).toThrow(/number/);
		expect(() => readOptions(["--key-ssm", "name; rm -rf /"])).toThrow(/SSM parameter/);
	});

	it("takes a service account key and nothing that only looks like one", () => {
		expect(parseKey(keyText).client_email).toBe("feed-test@a-test-project.iam.gserviceaccount.com");
		expect(() => parseKey("not json")).toThrow(/not JSON/);
		expect(() =>
			parseKey(JSON.stringify({ type: "authorized_user", client_email: "a", private_key: "b" })),
		).toThrow(/service account key/);
	});
});

describe("a run", () => {
	const shop = [
		[item("V1"), item("V2", { price: { amount: 849, currency: "EUR" } })],
		[item("V3", { availability: "out_of_stock" })],
	];
	const fed = { V1: offer("899.00 EUR"), V2: offer("899.00 EUR"), V3: offer("899.00 EUR") };

	it("a dry run walks the shop, prints the plan and talks to nobody else", async () => {
		writeOffers(fed);
		const w = world(shop);
		expect(await w.run()).toBe(0);
		expect(w.outside).toEqual([]);
		expect(w.inserts).toEqual([]);
		expect(existsSync(join(out, "api-sk.json"))).toBe(false);
		expect(w.text()).toContain("2 to tell Google (0 no longer sold), 1 unchanged, 0 new");
		expect(w.text()).toContain("V2: 899.00 EUR in_stock → 849.00 EUR in_stock");
		expect(w.text()).toContain("dry run: nothing was sent");
	});

	it("refuses when no feed was ever written: the API only changes what a feed stated", async () => {
		const w = world(shop);
		expect(await w.run("--fire")).toBe(2);
		expect(w.outside).toEqual([]);
		expect(w.text()).toContain("no feed has been written yet");
	});

	it("sends the changes into the supplemental source and records what Google accepted", async () => {
		writeOffers(fed);
		const w = world(shop);
		expect(await w.run("--fire")).toBe(0);

		expect(w.tokens).toEqual(["feed-test@a-test-project.iam.gserviceaccount.com"]);
		expect(w.inserts.map((call) => call.dataSource)).toEqual([SUPPLEMENTAL, SUPPLEMENTAL]);
		expect(w.inserts.map((call) => call.body)).toEqual([
			{
				offerId: "V2",
				contentLanguage: "sk",
				feedLabel: "SK",
				productAttributes: {
					price: { amountMicros: "849000000", currencyCode: "EUR" },
					availability: "IN_STOCK",
				},
			},
			{
				offerId: "V3",
				contentLanguage: "sk",
				feedLabel: "SK",
				productAttributes: {
					price: { amountMicros: "899000000", currencyCode: "EUR" },
					availability: "OUT_OF_STOCK",
				},
			},
		]);
		expect(state()).toMatchObject({
			dataSource: SUPPLEMENTAL,
			pushed: { V2: { o: offer("849.00 EUR") }, V3: { o: offer("899.00 EUR", "out_of_stock") } },
		});
		expect(w.text()).toContain('2 change(s) told to Google (source "MAKY API")');

		// The next hour, nothing has moved: nothing is sent again.
		const again = world(shop);
		expect(await again.run("--fire")).toBe(0);
		expect(again.inserts).toEqual([]);
	});

	it("never prints the key, the token or the shop's secret", async () => {
		writeOffers(fed);
		const w = world(shop);
		await w.run("--fire");
		const printed = w.text();
		expect(printed).not.toContain(SECRET);
		expect(printed).not.toContain("a-test-token");
		expect(printed).not.toContain("PRIVATE KEY");
		expect(printed).not.toContain("feed-test@");
	});

	it("a walk that fails sends nothing, although Google was ready", async () => {
		writeOffers(fed);
		const w = world(shop, { shopStatus: (call) => (call >= 2 ? 500 : 200) });
		expect(await w.run("--fire")).toBe(1);
		expect(w.inserts).toEqual([]);
		expect(w.text()).toContain("Nothing was sent");
	});

	it("tells a withdrawn product out of stock on the second run that misses it", async () => {
		writeOffers(fed);
		const without = [[item("V1"), item("V2")]];
		const first = world(without);
		expect(await first.run("--fire")).toBe(0);
		expect(first.inserts).toEqual([]);
		expect(state().missing).toEqual({ V3: NOW.toISOString() });

		const second = world(without);
		expect(await second.run("--fire")).toBe(0);
		expect(
			second.inserts.map((call) => [call.body.offerId, call.body.productAttributes.availability]),
		).toEqual([["V3", "OUT_OF_STOCK"]]);
		expect(second.text()).toContain("1 to tell Google (1 no longer sold)");

		// And it is not told a third time.
		const third = world(without);
		expect(await third.run("--fire")).toBe(0);
		expect(third.inserts).toEqual([]);
		expect(state().missing).toEqual({});
	});

	it("does not send a quarter of the feed at once without --force", async () => {
		const many = Object.fromEntries(Array.from({ length: 100 }, (_, n) => [`P${n}`, offer("10.00 EUR")]));
		writeOffers(many);
		const cheaper = [Object.keys(many).map((id) => item(id, { price: { amount: 9, currency: "EUR" } }))];
		const w = world(cheaper);
		expect(await w.run("--fire")).toBe(2);
		expect(w.inserts).toEqual([]);
		expect(w.text()).toContain("100 of the feed's 100 products differ at once");

		const forced = world(cheaper);
		expect(await forced.run("--fire", "--force", "--max", "30")).toBe(0);
		expect(forced.inserts).toHaveLength(30);
		expect(forced.text()).toContain("30 change(s) told to Google");
		expect(forced.text()).toContain("70 left for the next run");
	});

	it("stops when Google says the access is gone, and keeps what was accepted", async () => {
		writeOffers(fed);
		const w = world(shop, {
			insert: (call) =>
				call === 2 ? { status: 403, message: "The caller does not have permission" } : { status: 200 },
		});
		expect(await w.run("--fire")).toBe(1);
		expect(Object.keys(state().pushed)).toEqual(["V2"]);
		expect(w.text()).toContain("Google stopped the run (HTTP 403: The caller does not have permission)");
	});

	it("waits and tries again when Google is busy", async () => {
		writeOffers(fed);
		const w = world(shop, { insert: (call) => (call === 1 ? { status: 429 } : { status: 200 }) });
		expect(await w.run("--fire")).toBe(0);
		expect(w.inserts).toHaveLength(2);
		expect(w.sleeps).toContain(1);
	});

	it("a product Google does not accept is named, and the others still go", async () => {
		writeOffers(fed);
		const w = world(shop, {
			insert: (_call, body) =>
				body.offerId === "V2" ? { status: 400, message: "Invalid price" } : { status: 200 },
		});
		expect(await w.run("--fire")).toBe(1);
		expect(Object.keys(state().pushed)).toEqual(["V3"]);
		expect(w.text()).toContain("not accepted: V2: HTTP 400: Invalid price");
	});

	it("a key Google does not accept ends the run before the shop is walked", async () => {
		writeOffers(fed);
		const w = world(shop, { token: 400 });
		expect(await w.run("--fire")).toBe(1);
		expect(w.text()).toContain("Google gave no token (HTTP 400, invalid_grant)");
		expect(w.inserts).toEqual([]);
	});
});

describe("the account", () => {
	const shop = [[item("V1", { price: { amount: 849, currency: "EUR" } })]];

	const refusal = async (sources: Source[], accounts?: string[]) => {
		writeOffers({ V1: offer("899.00 EUR") });
		const w = world(shop, { sources, accounts });
		expect(await w.run("--fire")).toBe(1);
		expect(w.inserts).toEqual([]);
		return w.text();
	};

	it("needs the feed to be a source in Merchant Center", async () => {
		expect(await refusal([legacySource, apiSource()])).toContain(
			"no product source in Merchant Center fetches /feeds/google-sk.xml.gz",
		);
	});

	it("never takes the legacy Content API source for the supplemental one", async () => {
		expect(await refusal([legacySource, feedSource(null)])).toContain(
			"there is no supplemental data source of type API",
		);
	});

	it("says when the supplemental source exists and is not linked", async () => {
		expect(await refusal([feedSource(null), apiSource()])).toContain(
			'"MAKY API" exists and is not linked to the feed\'s source "Feed SK"',
		);
	});

	it("says when the supplemental source is linked after the feed, where it changes nothing", async () => {
		const text = await refusal([
			feedSource([{ self: true }, { supplementalDataSourceName: SUPPLEMENTAL }]),
			apiSource(),
		]);
		expect(text).toContain("linked AFTER the feed");
	});

	it("refuses a supplemental source made for another language or label", async () => {
		const text = await refusal([
			feedSource(),
			apiSource({ supplementalProductDataSource: { feedLabel: "CZ", contentLanguage: "cs" } }),
		]);
		expect(text).toContain("the supplemental source is for cs~CZ and the feed is sk~SK");
	});

	it("asks which account when the key sees several", async () => {
		expect(await refusal([feedSource(), apiSource()], [ACCOUNT, "7654321"])).toContain(
			"name one with --account",
		);
	});

	it("starts from nothing when the supplemental source is another one than last time", async () => {
		writeOffers({ V1: offer("899.00 EUR") });
		writeFileSync(
			join(out, "api-sk.json"),
			JSON.stringify({
				version: 1,
				market: "sk",
				dataSource: "accounts/1234567/dataSources/OLD",
				pushed: { V1: { o: offer("849.00 EUR"), at: "x" } },
				missing: {},
			}),
		);
		const w = world(shop);
		expect(await w.run("--fire")).toBe(0);
		// The old source held 849; the new one holds nothing, so 849 has to be said again.
		expect(w.inserts).toHaveLength(1);
		expect(state().dataSource).toBe(SUPPLEMENTAL);
	});

	it("--check reads the account, says what is linked and the quota, and sends nothing", async () => {
		const w = world(shop);
		expect(await w.run("--check")).toBe(0);
		expect(w.text()).toContain(
			'the feed\'s source "Feed SK" (sk~SK, fetched daily at 07:00 Europe/Bratislava)',
		);
		expect(w.text()).toContain('supplemental API source "MAKY API" is linked ahead of the feed');
		expect(w.text()).toContain("12 used of 70000 a day, 1000 a minute");
		expect(w.outside.filter((line) => line.startsWith("POST") && !line.includes("oauth2"))).toEqual([]);
	});

	it("--show prints what Google holds for one product, by an id with characters a URL cannot carry", async () => {
		const w = world(shop);
		expect(await w.run("--show", "V1==")).toBe(0);
		expect(w.text()).toContain("V1==: price 899.00 EUR, sale price none, IN_STOCK");
		const missing = world(shop);
		expect(await missing.run("--show", "nothing")).toBe(1);
	});
});

describe("with the feed writer", () => {
	it("the feed writes the record this program compares with", async () => {
		const lines: string[] = [];
		const steps = [step([item("V1"), item("V2", { salePrice: { amount: 799, currency: "EUR" } })], null)];
		const code = await writeFeed(["--out", out, "--secret-file", secretFile, "--pause-ms", "0", "--write"], {
			fetch: async () => Response.json(steps[0]),
			log: (line: string) => lines.push(line),
			now: () => new Date("2026-11-16T05:05:00Z"),
			sleep: async () => {},
		});
		expect(code).toBe(0);
		expect(JSON.parse(readFileSync(join(out, "offers-sk.json"), "utf8"))).toEqual({
			version: 1,
			market: "sk",
			generatedAt: "2026-11-16T05:05:00.000Z",
			offers: { V1: offer("899.00 EUR"), V2: offer("899.00 EUR", "in_stock", "799.00 EUR") },
		});

		// Nothing changed since: the API has nothing to say.
		const w = world([[item("V1"), item("V2", { salePrice: { amount: 799, currency: "EUR" } })]]);
		expect(await w.run("--fire")).toBe(0);
		expect(w.inserts).toEqual([]);
	});
});
