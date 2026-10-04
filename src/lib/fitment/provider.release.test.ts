import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __forgetRootContext } from "@/lib/async/detached";
import {
	type Harness,
	arrangeRelease,
	contentFile,
	fitmentFile,
	respond,
	status as httpStatus,
} from "@/lib/catalog-release/fixtures/fake-cfm";
import { releaseSyncOnce } from "@/lib/catalog-release/sync";

/**
 * The fitment provider, with a release manifest in play.
 *
 * Same handover as the content loader: the modes `MAKY_FITMENT_PROVIDER` selects answer until the manifest
 * has verified a dataset in this process, and the verified dataset answers after that, from memory, with
 * no request made. Test data is the one thing a delivery never replaces.
 */

const LEGACY_URL = "https://carfitmanager.test/fitment.json";

let world: Harness;

beforeEach(() => {
	world = arrangeRelease();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	__forgetRootContext();
	world.restore();
});

/** A fresh copy of the provider, as `provider.http.test.ts` takes one: its loader is memoised per module. */
async function freshProvider() {
	vi.resetModules();
	const provider = await import("./provider");
	provider.__resetFitmentMemo();
	return provider;
}

function olderHttpSetting(datasetVersion: string): void {
	process.env.MAKY_FITMENT_PROVIDER = "http";
	process.env.MAKY_FITMENT_URL = LEGACY_URL;
	const legacy = fitmentFile(datasetVersion);
	world.cfm.override(LEGACY_URL, () => respond(legacy.bytes));
}

async function release(datasetVersion = "3.0.0-release.1") {
	const released = fitmentFile(datasetVersion);
	world.cfm.publish({
		version: 1,
		targets: { sk: { file: contentFile("sk"), release: 1 } },
		fitment: { file: released, release: 2 },
	});
	await releaseSyncOnce();
	return released;
}

describe("before the manifest has verified a dataset", () => {
	it("the older setting answers exactly as it always did", async () => {
		olderHttpSetting("3.0.0-older.1");
		const { loadFitmentDataset } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(status).toMatchObject({ mode: "http", isFixture: false, datasetVersion: "3.0.0-older.1" });
		expect(dataset?.datasetVersion).toBe("3.0.0-older.1");
		expect(world.cfm.count(LEGACY_URL)).toBe(1);
	});

	it("says it has no dataset, and why, as before, when nothing is configured", async () => {
		const { loadFitmentDataset, fitmentRuntimeStatus } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(dataset).toBeNull();
		expect(status).toMatchObject({ mode: "disabled", unavailableReason: "provider-disabled" });
		expect(fitmentRuntimeStatus()).toMatchObject({
			mode: "disabled",
			loaded: false,
			unavailableReason: "provider-not-http",
		});
	});
});

describe("once the manifest has verified a dataset", () => {
	it("answers instead of the older http setting, from memory, without asking the older source anything", async () => {
		olderHttpSetting("3.0.0-older.1");
		const released = await release("3.0.0-release.1");
		world.cfm.forget();
		const { loadFitmentDataset } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(status).toMatchObject({
			mode: "release",
			isFixture: false,
			unavailableReason: null,
			datasetVersion: "3.0.0-release.1",
		});
		expect(dataset?.datasetHash).toBe(released.datasetHash);
		expect(world.cfm.hits).toEqual([]);
	});

	it("answers even when no provider is configured at all: following a manifest is the configuration", async () => {
		const released = await release();
		const { loadFitmentDataset } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(status.mode).toBe("release");
		expect(dataset?.datasetHash).toBe(released.datasetHash);
	});

	it("never replaces test data: a fixture provider stays a fixture, and says so", async () => {
		process.env.MAKY_FITMENT_PROVIDER = "fixture";
		await release();
		const { loadFitmentDataset } = await freshProvider();

		const { dataset, status } = await loadFitmentDataset();

		expect(status).toMatchObject({ mode: "fixture", isFixture: true });
		expect(dataset?.datasetVersion).toBe("demo-2026-09-05-a");
	});

	it("is what the runtime status reports, down to the bytes and the hash this process recomputed", async () => {
		olderHttpSetting("3.0.0-older.1");
		const released = await release("3.0.0-release.1");
		const { fitmentRuntimeStatus } = await freshProvider();

		const reported = fitmentRuntimeStatus();

		expect(reported).toMatchObject({
			mode: "release",
			source: released.name,
			loaded: true,
			datasetVersion: "3.0.0-release.1",
			datasetHash: released.datasetHash,
			transportSha256: released.sha256,
			schemaVersion: "3.0.0",
			bytes: released.bytes.byteLength,
			takenIntoUseAt: new Date(world.clock.now).toISOString(),
			lastCheck: { at: new Date(world.clock.now).toISOString(), outcome: "new", reason: null },
			unavailableReason: null,
		});
		expect(reported.loadMs).toBeGreaterThanOrEqual(0);
		expect(reported.counts).not.toBeNull();
	});

	it("keeps the dataset in use when a newer one cannot be had, and the runtime status says the last check failed", async () => {
		const released = await release("3.0.0-release.1");
		const missing = fitmentFile("3.0.0-release.2");
		world.cfm.override(missing.name, () => httpStatus(404));
		world.cfm.publish({
			version: 2,
			targets: { sk: { file: contentFile("sk"), release: 1 } },
			fitment: { file: missing, release: 3 },
		});
		world.clock.now += 1_000;
		await releaseSyncOnce();
		const { loadFitmentDataset, fitmentRuntimeStatus } = await freshProvider();

		const { dataset } = await loadFitmentDataset();

		expect(dataset?.datasetHash).toBe(released.datasetHash);
		expect(fitmentRuntimeStatus()).toMatchObject({
			datasetHash: released.datasetHash,
			lastCheck: {
				at: new Date(world.clock.now).toISOString(),
				outcome: "failed",
				reason: "file_unreachable",
			},
		});
	});
});
