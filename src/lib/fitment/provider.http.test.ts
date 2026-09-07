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
