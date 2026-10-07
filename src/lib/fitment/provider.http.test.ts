import { AsyncLocalStorage } from "node:async_hooks";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __forgetRootContext, captureRootContext } from "@/lib/async/detached";

import fixtureDataset from "./fixtures/dataset-v1.json";
import { datasetHashFromText } from "./dataset-hash";

/**
 * The HTTP provider, which had no tests at all.
 *
 * Every case here asserts the same shape of answer: `dataset: null` and a named reason.
 * That is the whole contract of this layer — a provider that cannot answer must degrade
 * the compatibility feature, never take down a product page that is otherwise perfectly
 * able to sell something, and never produce a dataset the rest of the build would then
 * treat as authoritative.
 *
 * `loadFitmentDataset` is wrapped in React `cache()`, so each test re-imports the module
 * to get a fresh one rather than the previous test's memoised answer. The memo itself is
 * process-wide (it lives on `globalThis`, see the provider), so it is reset before each test.
 */

const SALEOR_HOST = "api.maky.store";
const URL_A = "https://carfitmanager.test/fitment.json";

/** A payload shaped like a real delivery: no demo catalogue, real instance, real hash. */
function delivered(overrides: Record<string, unknown> = {}): string {
	const d = JSON.parse(JSON.stringify(fixtureDataset)) as Record<string, unknown>;
	delete d.demoCatalogue;
	d.source = { system: "cfm" };
	d.saleorInstance = SALEOR_HOST;
	Object.assign(d, overrides);
	delete d.datasetHash;
	const hash = datasetHashFromText(JSON.stringify(d));
	d.datasetHash = hash;
	return JSON.stringify(d);
}

async function load() {
	vi.resetModules();
	const { loadFitmentDataset } = await import("./provider");
	return loadFitmentDataset();
}

function respondWith(body: string, init: { status?: number } = {}) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(body, { status: init.status ?? 200 })),
	);
}

const ENV_KEYS = [
	"MAKY_FITMENT_PROVIDER",
	"MAKY_FITMENT_URL",
	"MAKY_FITMENT_REVALIDATE_SECONDS",
	"NEXT_PUBLIC_SALEOR_API_URL",
] as const;
const SAVED = { ...process.env };

beforeEach(async () => {
	process.env.MAKY_FITMENT_PROVIDER = "http";
	process.env.MAKY_FITMENT_URL = URL_A;
	process.env.NEXT_PUBLIC_SALEOR_API_URL = `https://${SALEOR_HOST}/graphql/`;
	(await import("./provider")).__resetFitmentMemo();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
	__forgetRootContext();
	for (const k of ENV_KEYS) {
		if (SAVED[k] === undefined) delete process.env[k];
		else process.env[k] = SAVED[k];
	}
});

describe("the HTTP provider answers, or says why not", () => {
	it("accepts a well-formed delivery", async () => {
		respondWith(delivered());
		const { dataset, status } = await load();
		expect(status.unavailableReason).toBeNull();
		expect(dataset).not.toBeNull();
		expect(status.mode).toBe("http");
		expect(status.isFixture).toBe(false);
	});

	it("survives a timeout", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
			}),
		);
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("fetch-failed");
	});

	it("survives a non-2xx", async () => {
		respondWith("upstream is unwell", { status: 503 });
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("http-503");
	});

	it("survives a body that is not JSON at all", async () => {
		// An HTML error page from a proxy is the realistic shape of this.
		respondWith("<!doctype html><title>502 Bad Gateway</title>");
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("payload-not-json");
	});

	it("refuses a schema version this build does not implement", async () => {
		respondWith(delivered({ schemaVersion: "3.1.0" }));
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("payload-invalid");
	});

	it("refuses a payload whose datasetHash does not describe it", async () => {
		const text = delivered();
		const tampered = JSON.parse(text) as Record<string, unknown>;
		// Change the content, keep the hash. This is the case the old code could not see.
		tampered.datasetVersion = "tampered-in-flight";
		respondWith(JSON.stringify(tampered));
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("payload-invalid");
	});

	it("refuses a payload built against a different Saleor instance", async () => {
		respondWith(delivered({ saleorInstance: "staging.example.test" }));
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("payload-invalid");
	});

	it("refuses the committed-fixture hash sentinel over the wire", async () => {
		const d = JSON.parse(delivered()) as Record<string, unknown>;
		d.datasetHash = "demo-no-hash-this-is-not-a-cfm-export";
		respondWith(JSON.stringify(d));
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("payload-invalid");
	});

	it("reports a delivery that declares itself a fixture as NOT real data", async () => {
		// It may load — it is well-formed — but nothing downstream may sell from it.
		respondWith(delivered({ source: { system: "fixture" } }));
		const { dataset, status } = await load();
		expect(dataset).not.toBeNull();
		expect(status.isFixture).toBe(true);
	});

	it("says so when no URL is configured, rather than fetching undefined", async () => {
		delete process.env.MAKY_FITMENT_URL;
		const { dataset, status } = await load();
		expect(dataset).toBeNull();
		expect(status.unavailableReason).toBe("missing-MAKY_FITMENT_URL");
	});
});

/**
 * The memo exists because Next's data cache does not hold this payload.
 *
 * `next: { revalidate }` is the intended cache and it works for a small dataset. The real
 * CFM export is 7.9 MB and Next refuses any entry over 2 MB — the fetch still succeeds, so
 * nothing looks broken and every gate stays green while the caching silently stops
 * happening. Measured on a production build against the live URL: three PDP renders, three
 * full 8 MB downloads. These tests are what keep that from coming back.
 */
describe("the dataset is fetched once, not once per render", () => {
	async function freshModule() {
		vi.resetModules();
		return import("./provider");
	}

	it("serves the second caller from memory", async () => {
		const spy = vi.fn(async () => new Response(delivered(), { status: 200 }));
		vi.stubGlobal("fetch", spy);

		const { loadFitmentDataset } = await freshModule();
		const first = await loadFitmentDataset();
		const second = await loadFitmentDataset();

		expect(first.dataset).not.toBeNull();
		expect(second.dataset).toBe(first.dataset);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("collapses concurrent cold callers into one fetch", async () => {
		// The failure this prevents is a cold start under load: without an in-flight
		// entry, ten simultaneous requests are ten simultaneous 8 MB downloads.
		const spy = vi.fn(async () => new Response(delivered(), { status: 200 }));
		vi.stubGlobal("fetch", spy);

		const { loadFitmentDataset } = await freshModule();
		const all = await Promise.all(Array.from({ length: 5 }, () => loadFitmentDataset()));

		expect(spy).toHaveBeenCalledTimes(1);
		for (const load of all) expect(load.dataset).toBe(all[0].dataset);
	});

	it("does not hold a failure for the full success TTL", async () => {
		// A broken upstream must not be cached for five minutes, or recovery waits it
		// out. It must not be retried on every request either, or an outage becomes a
		// thundering herd. 30 s is the compromise, and it is not the success TTL.
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "3600";
		const spy = vi.fn(async () => new Response("nope", { status: 500 }));
		vi.stubGlobal("fetch", spy);

		const { loadFitmentDataset, __resetFitmentMemo } = await freshModule();
		const first = await loadFitmentDataset();
		expect(first.dataset).toBeNull();
		expect(spy).toHaveBeenCalledTimes(1);

		// Still inside the negative window: no second request.
		await loadFitmentDataset();
		expect(spy).toHaveBeenCalledTimes(1);

		__resetFitmentMemo();
		await loadFitmentDataset();
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it("does not serve one URL's dataset for another", async () => {
		const spy = vi.fn(async () => new Response(delivered(), { status: 200 }));
		vi.stubGlobal("fetch", spy);

		const { loadFitmentDataset } = await freshModule();
		await loadFitmentDataset();
		process.env.MAKY_FITMENT_URL = "https://carfitmanager.test/other.json";
		await loadFitmentDataset();

		expect(spy).toHaveBeenCalledTimes(2);
	});

	it("keeps one memo per process, not one per copy of the module", async () => {
		// The page bundles and the sitemap route handlers each carry their own copy of the
		// provider. Each copy used to hold, and reload, its own 8 MB dataset.
		const spy = vi.fn(async () => new Response(delivered(), { status: 200 }));
		vi.stubGlobal("fetch", spy);

		const pages = await freshModule();
		const sitemap = await freshModule();
		expect(sitemap).not.toBe(pages);

		const a = await pages.loadFitmentDataset();
		const b = await sitemap.loadFitmentDataset();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(b.dataset).toBe(a.dataset);
	});
});

/**
 * Everything below is about the moment the held dataset goes stale.
 *
 * The first memo refetched in front of the render that noticed: that render waited for
 * 8 MB, and for a parse and a validation that held the event loop. In production those
 * reloads line up with the prerender bailouts (a bare 500). Now the held dataset answers
 * at once — fresh or stale — and the refresh happens behind it, outside the render.
 */
describe("a stale dataset is answered at once and refreshed behind the read", () => {
	type Handler = (request: { url: string; headers: Headers }) => Promise<Response>;

	/** A fetch whose behaviour each test can change between calls, recording every call. */
	function upstream(initial: Handler) {
		let handler = initial;
		const calls: { url: string; headers: Headers }[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = { url: String(input), headers: new Headers(init?.headers) };
			calls.push(request);
			return handler(request);
		});
		vi.stubGlobal("fetch", fetchMock);
		return {
			calls,
			respond(next: Handler) {
				handler = next;
			},
		};
	}

	const ok =
		(body: string, headers: Record<string, string> = {}): Handler =>
		async () =>
			new Response(body, { status: 200, headers });

	/** A response the test releases by hand, to observe what readers get meanwhile. */
	function gate() {
		let open: (response: Response) => void = () => {};
		const pending = new Promise<Response>((resolve) => {
			open = resolve;
		});
		return { handler: (() => pending) as Handler, open };
	}

	function logs() {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const lines = (spy: typeof log) => spy.mock.calls.map((args) => args.map(String).join(" "));
		return {
			log: () => lines(log),
			warn: () => lines(warn),
			error: () => lines(error),
		};
	}

	/** Loaded once, then left to go stale: one second of TTL, run down on a fake clock. */
	async function heldThenStale(first: string, handler: Handler = ok(first)) {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const net = upstream(handler);
		vi.resetModules();
		const provider = await import("./provider");
		const held = await provider.loadFitmentDataset();
		expect(held.dataset).not.toBeNull();
		vi.advanceTimersByTime(1_001);
		return { provider, net, held };
	}

	it("logs one line per dataset taken into use: version, datasetHash, bytes, time", async () => {
		const out = logs();
		const body = delivered({ datasetVersion: "3.0.0-full-20260915.2" });
		respondWith(body);
		const { dataset } = await load();

		const loaded = out.log().filter((line) => line.startsWith("[fitment] loaded "));
		expect(loaded).toHaveLength(1);
		expect(loaded[0]).toBe(
			`[fitment] loaded 3.0.0-full-20260915.2 ${dataset?.datasetHash} (${Buffer.byteLength(body)} B, ` +
				loaded[0].match(/, (\d+) ms\)$/)?.[1] +
				" ms)",
		);
		expect(dataset?.datasetHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("answers from the held dataset while the refresh is still downloading", async () => {
		const out = logs();
		const { provider, net, held } = await heldThenStale(delivered({ datasetVersion: "v1" }));

		const slow = gate();
		net.respond(slow.handler);
		const during = await provider.loadFitmentDataset();

		// The download has not finished — it has not even been answered — and the reader
		// already has its dataset: the one it had before.
		expect(net.calls).toHaveLength(2);
		expect(during.dataset).toBe(held.dataset);

		slow.open(new Response(delivered({ datasetVersion: "v2" }), { status: 200 }));
		await provider.__settleFitmentRefreshes();

		const after = await provider.loadFitmentDataset();
		expect(after.dataset?.datasetVersion).toBe("v2");
		expect(out.log().filter((line) => line.startsWith("[fitment] loaded "))).toHaveLength(2);
	});

	it("starts one refresh however many readers find the entry stale", async () => {
		logs();
		const { provider, net } = await heldThenStale(delivered());
		const slow = gate();
		net.respond(slow.handler);

		await Promise.all(Array.from({ length: 10 }, () => provider.loadFitmentDataset()));
		expect(net.calls).toHaveLength(2);

		slow.open(new Response(delivered(), { status: 200 }));
		await provider.__settleFitmentRefreshes();
	});

	/**
	 * Next learns what a render is doing from `AsyncLocalStorage`, and that context rides
	 * along into every promise the render starts — a background refresh included. This
	 * stands in for Next's work-unit store: the refresh must not be able to see it.
	 */
	it("runs the refresh outside the render that noticed it", async () => {
		logs();
		const renderStore = new AsyncLocalStorage<{ route: string }>();
		captureRootContext(); // what `register()` does at boot, before any request

		const { provider, net } = await heldThenStale(delivered());
		let seenByFetch: { route: string } | undefined = { route: "not called" };
		net.respond(async () => {
			seenByFetch = renderStore.getStore();
			return new Response(delivered(), { status: 200 });
		});

		await renderStore.run({ route: "/[channel]" }, () => provider.loadFitmentDataset());
		await provider.__settleFitmentRefreshes();

		expect(net.calls).toHaveLength(2);
		expect(seenByFetch).toBeUndefined();
	});

	it("would run it inside the render if boot had captured no context", async () => {
		// The contrast that makes the previous test mean something.
		logs();
		const renderStore = new AsyncLocalStorage<{ route: string }>();

		const { provider, net } = await heldThenStale(delivered());
		let seenByFetch: { route: string } | undefined;
		net.respond(async () => {
			seenByFetch = renderStore.getStore();
			return new Response(delivered(), { status: 200 });
		});

		await renderStore.run({ route: "/[channel]" }, () => provider.loadFitmentDataset());
		await provider.__settleFitmentRefreshes();

		expect(seenByFetch).toEqual({ route: "/[channel]" });
	});
});

describe("a failed refresh keeps the dataset it failed to replace", () => {
	async function heldThenStale() {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const spy = vi.fn(async () => new Response(delivered({ datasetVersion: "good" }), { status: 200 }));
		vi.stubGlobal("fetch", spy);
		vi.resetModules();
		const provider = await import("./provider");
		const held = await provider.loadFitmentDataset();
		expect(held.dataset?.datasetVersion).toBe("good");
		vi.advanceTimersByTime(1_001);
		return { provider, spy, held };
	}

	function quiet() {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		return vi.spyOn(console, "error").mockImplementation(() => {});
	}

	const failures: [string, () => Promise<Response>, string][] = [
		[
			"the network fails",
			async () => {
				throw new TypeError("fetch failed");
			},
			"fetch-failed",
		],
		["CFM answers 503", async () => new Response("unwell", { status: 503 }), "http-503"],
		["the file is gone (404)", async () => new Response("gone", { status: 404 }), "http-404"],
		[
			"a proxy answers with HTML",
			async () => new Response("<!doctype html>", { status: 200 }),
			"payload-not-json",
		],
	];

	it.each(failures)("keeps serving the old dataset when %s", async (_what, failure, reason) => {
		const errors = quiet();
		const { provider, spy, held } = await heldThenStale();
		spy.mockImplementation(failure);

		// The read that finds the entry stale is still answered from it.
		const during = await provider.loadFitmentDataset();
		expect(during.dataset).toBe(held.dataset);
		await provider.__settleFitmentRefreshes();

		// And so is every read after the refresh has failed.
		const after = await provider.loadFitmentDataset();
		expect(after.dataset).toBe(held.dataset);
		expect(after.status.unavailableReason).toBeNull();

		const lines = errors.mock.calls.map((args) => args.map(String).join(" "));
		expect(lines).toContainEqual(
			`[fitment] refresh failed (${reason}) from carfitmanager.test/fitment.json; keeping good ${held.dataset?.datasetHash}, next attempt in 30 s`,
		);
	});

	it("says which status CFM answered with", async () => {
		const errors = quiet();
		const { provider, spy } = await heldThenStale();
		spy.mockImplementation(async () => new Response("unwell", { status: 503 }));

		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();

		const lines = errors.mock.calls.map((args) => args.map(String).join(" "));
		expect(lines).toContainEqual("[fitment] provider answered HTTP 503 for carfitmanager.test/fitment.json");
	});

	it("waits 30 s before the next attempt, not one read", async () => {
		quiet();
		const { provider, spy } = await heldThenStale();
		spy.mockImplementation(async () => new Response("unwell", { status: 503 }));

		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();
		expect(spy).toHaveBeenCalledTimes(2);

		for (let i = 0; i < 5; i++) await provider.loadFitmentDataset();
		expect(spy).toHaveBeenCalledTimes(2);

		vi.advanceTimersByTime(30_001);
		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();
		expect(spy).toHaveBeenCalledTimes(3);
	});

	it("takes the new dataset once CFM is back", async () => {
		quiet();
		const { provider, spy } = await heldThenStale();
		spy.mockImplementation(async () => new Response("unwell", { status: 503 }));
		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();

		spy.mockImplementation(
			async () => new Response(delivered({ datasetVersion: "recovered" }), { status: 200 }),
		);
		vi.advanceTimersByTime(30_001);
		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();

		expect((await provider.loadFitmentDataset()).dataset?.datasetVersion).toBe("recovered");
	});
});

describe("a payload that fails validation never replaces a good one", () => {
	async function heldThenStale() {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const spy = vi.fn(async () => new Response(delivered({ datasetVersion: "good" }), { status: 200 }));
		vi.stubGlobal("fetch", spy);
		vi.resetModules();
		const provider = await import("./provider");
		const held = await provider.loadFitmentDataset();
		vi.advanceTimersByTime(1_001);
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		return { provider, spy, held, errors };
	}

	const tampered = (() => {
		// Content changed after hashing, hash kept — the in-flight tamper the semantic
		// `datasetHash` recomputation exists to catch.
		const d = JSON.parse(delivered({ datasetVersion: "good" })) as Record<string, unknown>;
		(d.makes as { name: string }[])[0].name = "Tampered";
		d.datasetVersion = "tampered";
		return JSON.stringify(d);
	})();

	const refused: [string, string][] = [
		["content changed under its datasetHash", tampered],
		["a payload built for another Saleor instance", delivered({ saleorInstance: "staging.example.test" })],
		["a schema this build does not implement", delivered({ schemaVersion: "3.1.0" })],
	];

	it.each(refused)("keeps the good dataset when the refresh brings %s", async (_what, body) => {
		const { provider, spy, held, errors } = await heldThenStale();
		spy.mockImplementation(async () => new Response(body, { status: 200 }));

		// The read that notices the stale entry is answered from it, not from the refresh.
		expect((await provider.loadFitmentDataset()).dataset).toBe(held.dataset);
		await provider.__settleFitmentRefreshes();

		const after = await provider.loadFitmentDataset();
		expect(after.dataset).toBe(held.dataset);
		expect(after.dataset?.datasetVersion).toBe("good");
		expect(after.status.unavailableReason).toBeNull();

		const lines = errors.mock.calls.map((args) => args.map(String).join(" "));
		expect(lines.some((line) => line.startsWith("[fitment] provider payload failed validation:"))).toBe(true);
		expect(lines.some((line) => line.startsWith("[fitment] refresh failed (payload-invalid)"))).toBe(true);
	});

	it("still validates a changed payload in full, datasetHash included", async () => {
		const { provider, spy } = await heldThenStale();
		// Same version string, different content, correct hash: new bytes, so it is checked
		// and — being valid — taken.
		const changed = JSON.parse(delivered({ datasetVersion: "good" })) as Record<string, unknown>;
		(changed.makes as { name: string }[])[0].name = "Renamed by CFM";
		delete changed.datasetHash;
		changed.datasetHash = datasetHashFromText(JSON.stringify(changed));
		spy.mockImplementation(async () => new Response(JSON.stringify(changed), { status: 200 }));

		// Until it has been checked, the reader keeps the dataset it had.
		expect((await provider.loadFitmentDataset()).dataset?.makes[0].name).not.toBe("Renamed by CFM");
		await provider.__settleFitmentRefreshes();

		const after = await provider.loadFitmentDataset();
		expect(after.dataset?.makes[0].name).toBe("Renamed by CFM");
	});
});

describe("an unchanged file is not parsed or validated again", () => {
	function quiet() {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		return { log, warn };
	}

	async function boot(first: () => Promise<Response>) {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const headersSeen: Headers[] = [];
		const spy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			headersSeen.push(new Headers(init?.headers));
			return first();
		});
		vi.stubGlobal("fetch", spy);
		vi.resetModules();
		const provider = await import("./provider");
		const held = await provider.loadFitmentDataset();
		vi.advanceTimersByTime(1_001);
		return { provider, spy, held, headersSeen };
	}

	it("asks conditionally and keeps the dataset on 304", async () => {
		const { log } = quiet();
		const body = delivered({ datasetVersion: "3.0.0-full-20260915.2" });
		const { provider, spy, held, headersSeen } = await boot(
			async () =>
				new Response(body, {
					status: 200,
					headers: { etag: '"6aa947a3-79b8d5"', "last-modified": "Tue, 15 Sep 2026 13:26:59 GMT" },
				}),
		);
		spy.mockImplementation(async (_input, init) => {
			headersSeen.push(new Headers(init?.headers));
			return new Response(null, { status: 304 });
		});

		expect((await provider.loadFitmentDataset()).dataset).toBe(held.dataset);
		await provider.__settleFitmentRefreshes();

		expect(headersSeen[0].get("if-none-match")).toBeNull();
		expect(headersSeen[1].get("if-none-match")).toBe('"6aa947a3-79b8d5"');
		expect(headersSeen[1].get("if-modified-since")).toBe("Tue, 15 Sep 2026 13:26:59 GMT");

		const after = await provider.loadFitmentDataset();
		expect(after.dataset).toBe(held.dataset);
		const lines = log.mock.calls.map((args) => args.map(String).join(" "));
		expect(lines.at(-1)).toMatch(
			new RegExp(
				`^\\[fitment\\] unchanged 3\\.0\\.0-full-20260915\\.2 ${held.dataset?.datasetHash} \\(304 not modified, \\d+ ms\\)$`,
			),
		);
	});

	it("recognises the same bytes from a server with no validators", async () => {
		const { log, warn } = quiet();
		// A version whose window overruns its generation, so a load prints a warning.
		const body = delivered();
		const { provider, spy, held } = await boot(async () => new Response(body, { status: 200 }));
		const warnedAtFirstLoad = warn.mock.calls.length;
		spy.mockImplementation(async () => new Response(body, { status: 200 }));

		expect((await provider.loadFitmentDataset()).dataset).toBe(held.dataset);
		await provider.__settleFitmentRefreshes();

		const after = await provider.loadFitmentDataset();
		expect(after.dataset).toBe(held.dataset);
		// Nothing new was validated, so nothing new was warned about.
		expect(warn.mock.calls.length).toBe(warnedAtFirstLoad);
		const lines = log.mock.calls.map((args) => args.map(String).join(" "));
		expect(lines.at(-1)).toMatch(/^\[fitment\] unchanged \S+ [0-9a-f]{64} \(\d+ B, same bytes, \d+ ms\)$/);
	});

	it("takes different bytes through the whole validation", async () => {
		quiet();
		const { provider, spy } = await boot(
			async () => new Response(delivered({ datasetVersion: "one" }), { status: 200 }),
		);
		spy.mockImplementation(async () => new Response(delivered({ datasetVersion: "two" }), { status: 200 }));

		// Stale-while-revalidate: the read that starts the refresh still gets "one".
		expect((await provider.loadFitmentDataset()).dataset?.datasetVersion).toBe("one");
		await provider.__settleFitmentRefreshes();

		expect((await provider.loadFitmentDataset()).dataset?.datasetVersion).toBe("two");
	});
});

describe("boot loads the dataset before the first request", () => {
	it("prewarms in http mode, so the first render finds it held", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const spy = vi.fn(async () => new Response(delivered(), { status: 200 }));
		vi.stubGlobal("fetch", spy);

		vi.resetModules();
		const { prewarmFitmentDataset, loadFitmentDataset } = await import("./provider");
		await prewarmFitmentDataset();
		expect(spy).toHaveBeenCalledTimes(1);

		const first = await loadFitmentDataset();
		expect(first.dataset).not.toBeNull();
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("does nothing when the provider is not http", async () => {
		const spy = vi.fn();
		vi.stubGlobal("fetch", spy);
		for (const mode of ["off", "fixture", ""]) {
			process.env.MAKY_FITMENT_PROVIDER = mode;
			vi.resetModules();
			await (await import("./provider")).prewarmFitmentDataset();
		}
		expect(spy).not.toHaveBeenCalled();
	});
});

/**
 * The runtime status — what the RUNNING process holds.
 *
 * CFM opens each batch only after the storefront confirms the `datasetHash` it loaded, and neither
 * a file nor an environment variable can say that: `.env` is what a restart WOULD load, and the
 * file at the URL is what CFM published. This reads the process's own memory. It must never cause
 * the load it reports on, and it must say what happened when the last attempt did not go well.
 */
describe("the runtime status says what this process holds", () => {
	it("says nothing is loaded before anything is, and loads nothing to find out", async () => {
		const spy = vi.fn();
		vi.stubGlobal("fetch", spy);
		vi.resetModules();
		const { fitmentRuntimeStatus } = await import("./provider");

		expect(fitmentRuntimeStatus()).toMatchObject({
			mode: "http",
			loaded: false,
			datasetVersion: null,
			datasetHash: null,
			transportSha256: null,
			takenIntoUseAt: null,
			lastCheck: null,
			unavailableReason: "not-loaded-yet",
		});
		expect(spy, "a status read must not be able to cause a load").not.toHaveBeenCalled();
	});

	it("reports the hash the process RECOMPUTED, the bytes it weighed and when it took them", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const body = delivered({ datasetVersion: "3.0.0-full-20261001.2" });
		respondWith(body);
		vi.resetModules();
		const { loadFitmentDataset, fitmentRuntimeStatus } = await import("./provider");
		const { dataset } = await loadFitmentDataset();

		const status = fitmentRuntimeStatus();
		expect(status.loaded).toBe(true);
		expect(status.datasetVersion).toBe("3.0.0-full-20261001.2");
		expect(status.datasetHash).toBe(dataset?.datasetHash);
		// Not the declared field: the same recomputation the validator makes, from the bytes.
		expect(status.datasetHash).toBe(datasetHashFromText(body));
		expect(status.transportSha256).toMatch(/^[0-9a-f]{64}$/);
		expect(status.bytes).toBe(Buffer.byteLength(body));
		expect(status.loadMs).toBeGreaterThanOrEqual(0);
		expect(status.takenIntoUseAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(status.lastCheck).toMatchObject({ outcome: "new", reason: null });
		expect(status.counts).toMatchObject({ makes: expect.any(Number), applications: expect.any(Number) });
		expect(status.unavailableReason).toBeNull();
	});

	it("names the source by host and path only — never a query string or a credential", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		process.env.MAKY_FITMENT_URL = "https://user:pw@carfitmanager.test/media/fitment/x.json?token=SECRET";
		respondWith(delivered());
		vi.resetModules();
		const { loadFitmentDataset, fitmentRuntimeStatus } = await import("./provider");
		await loadFitmentDataset();

		const json = JSON.stringify(fitmentRuntimeStatus());
		expect(json).toContain("carfitmanager.test/media/fitment/x.json");
		expect(json).not.toContain("SECRET");
		expect(json).not.toContain("pw");
		expect(json).not.toContain("token");
	});

	it("says when the dataset stops answering YES, and whether it already has", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		// Generated an hour ago by the clock the status reads, so it is fresh on whatever day this runs.
		// A date written out here went stale on that date (the live dataset's, 2026-10-31 17:48 UTC),
		// and the deploy preflight, which runs this suite, refused every deploy from that minute on.
		const generatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		respondWith(delivered({ generatedAt, validity: { validUntil: null, staleAfterDays: 30 } }));
		vi.resetModules();
		const { loadFitmentDataset, fitmentRuntimeStatus } = await import("./provider");
		await loadFitmentDataset();

		const status = fitmentRuntimeStatus();
		// 30 days after generation — the date the owner has to have a new export by.
		expect(status.staleAfter).toBe(
			new Date(Date.parse(generatedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
		);
		expect(status.stale).toBe(false);

		respondWith(
			delivered({ generatedAt: "2020-01-01T00:00:00Z", validity: { validUntil: null, staleAfterDays: 30 } }),
		);
		vi.resetModules();
		const old = await import("./provider");
		// The memo lives on `globalThis`, so a fresh module still sees the last one's entry.
		old.__resetFitmentMemo();
		await old.loadFitmentDataset();
		expect(old.fitmentRuntimeStatus().stale).toBe(true);
	});

	it("keeps the loaded dataset in view when a refresh fails, and says how the attempt ended", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const fetchMock = vi.fn(async () => new Response(delivered({ datasetVersion: "good" }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		vi.resetModules();
		const provider = await import("./provider");
		await provider.loadFitmentDataset();
		const before = provider.fitmentRuntimeStatus();
		vi.advanceTimersByTime(1_001);

		fetchMock.mockImplementation(async () => new Response("unwell", { status: 503 }));
		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();

		const after = provider.fitmentRuntimeStatus();
		// The dataset it was answering from did not change, and neither did when it was taken…
		expect(after.datasetHash).toBe(before.datasetHash);
		expect(after.takenIntoUseAt).toBe(before.takenIntoUseAt);
		expect(after.loaded).toBe(true);
		// …and the failed attempt is on record.
		expect(after.lastCheck).toMatchObject({ outcome: "failed", reason: "http-503" });
	});

	it("records a 304 as an unchanged check, not a new load", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		process.env.MAKY_FITMENT_REVALIDATE_SECONDS = "1";
		const fetchMock = vi.fn(
			async () => new Response(delivered(), { status: 200, headers: { etag: '"abc"' } }),
		);
		vi.stubGlobal("fetch", fetchMock);
		vi.resetModules();
		const provider = await import("./provider");
		await provider.loadFitmentDataset();
		const first = provider.fitmentRuntimeStatus();
		vi.advanceTimersByTime(1_001);

		fetchMock.mockImplementation(async () => new Response(null, { status: 304 }));
		await provider.loadFitmentDataset();
		await provider.__settleFitmentRefreshes();

		const second = provider.fitmentRuntimeStatus();
		expect(second.lastCheck).toMatchObject({ outcome: "unchanged" });
		expect(second.takenIntoUseAt).toBe(first.takenIntoUseAt);
		expect(second.datasetHash).toBe(first.datasetHash);
	});

	it("is honest when the provider is not http", async () => {
		process.env.MAKY_FITMENT_PROVIDER = "off";
		vi.resetModules();
		const { fitmentRuntimeStatus } = await import("./provider");
		expect(fitmentRuntimeStatus()).toMatchObject({
			mode: "disabled",
			loaded: false,
			datasetHash: null,
			unavailableReason: "provider-not-http",
		});
	});
});
