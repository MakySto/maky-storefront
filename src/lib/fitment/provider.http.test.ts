import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * to get a fresh one rather than the previous test's memoised answer.
 */

const SALEOR_HOST = "api.maky.store";

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

const SAVED = { ...process.env };

beforeEach(() => {
	process.env.MAKY_FITMENT_PROVIDER = "http";
	process.env.MAKY_FITMENT_URL = "https://carfitmanager.test/fitment.json";
	process.env.NEXT_PUBLIC_SALEOR_API_URL = `https://${SALEOR_HOST}/graphql/`;
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const k of ["MAKY_FITMENT_PROVIDER", "MAKY_FITMENT_URL", "NEXT_PUBLIC_SALEOR_API_URL"]) {
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
});
