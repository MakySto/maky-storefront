import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	FRESH_MS,
	MAX_BACKGROUND_BUILDS,
	MAX_STALE_MS,
	MIN_REFRESH_AFTER_EVENT_MS,
	markSitemapStale,
	peekSnapshot,
	readSnapshot,
	resetSitemapSnapshotsForTests,
	RETRY_AFTER_FAILURE_MS,
	warmSnapshot,
} from "./sitemap-snapshot";

/**
 * The kept answer is what lets a crawler read a shard in milliseconds while the catalogue walk behind it
 * takes 14 to 18 seconds. What must hold: nobody waits for a rebuild that has an older COMPLETE answer to
 * show, a failed rebuild never replaces it, and an answer too old to trust fails loudly.
 */

const KEY = "sk-eur\u0000sk-SK";
const CHANNEL = "sk-eur";

/** A build whose results are numbered, so a test can tell which one it was handed. */
function numbered() {
	let calls = 0;
	return {
		build: vi.fn(async () => ++calls),
		get calls() {
			return calls;
		},
	};
}

/** Let the background rebuild (a few microtasks) finish. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
	resetSitemapSnapshotsForTests();
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	resetSitemapSnapshotsForTests();
});

describe("with nothing kept yet", () => {
	it("builds once and lets every asker join that build", async () => {
		const source = numbered();
		const [a, b, c] = await Promise.all([
			readSnapshot(KEY, CHANNEL, source.build),
			readSnapshot(KEY, CHANNEL, source.build),
			readSnapshot(KEY, CHANNEL, source.build),
		]);
		expect([a, b, c]).toEqual([1, 1, 1]);
		expect(source.calls).toBe(1);
	});

	it("fails the asker when the build fails — an error, never an empty answer — and tries again next time", async () => {
		const build = vi.fn<() => Promise<number>>().mockRejectedValueOnce(new Error("page 3 did not resolve"));
		build.mockResolvedValueOnce(7);

		await expect(readSnapshot(KEY, CHANNEL, build)).rejects.toThrow("page 3 did not resolve");
		await expect(readSnapshot(KEY, CHANNEL, build)).resolves.toBe(7);
	});

	it("peek answers nothing and starts no build", () => {
		const source = numbered();
		expect(peekSnapshot(KEY, CHANNEL, source.build)).toBeUndefined();
		expect(source.calls).toBe(0);
	});
});

describe("with an answer kept", () => {
	it("hands it out without building again while it is fresh", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);

		vi.setSystemTime(Date.now() + FRESH_MS - 1_000);
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(1);
		await settle();
		expect(source.calls).toBe(1);
	});

	it("answers from the old list at once when it is due, and the next asker gets the rebuilt one", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);

		vi.setSystemTime(Date.now() + FRESH_MS + 1);
		// Not 2: the asker is not made to wait for the rebuild.
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(1);
		await settle();
		expect(source.calls).toBe(2);
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(2);
	});

	it("runs one rebuild however many askers arrive while it is due", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);

		vi.setSystemTime(Date.now() + FRESH_MS + 1);
		await Promise.all(Array.from({ length: 20 }, () => readSnapshot(KEY, CHANNEL, source.build)));
		await settle();
		expect(source.calls).toBe(2);
	});

	it("does not rebuild for an event at once: a publish is hundreds of events, and one rebuild covers them", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);

		vi.setSystemTime(Date.now() + 1_000);
		for (let event = 0; event < 300; event++) markSitemapStale(CHANNEL);
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(1);
		await settle();
		expect(source.calls).toBe(1);

		vi.setSystemTime(Date.now() + MIN_REFRESH_AFTER_EVENT_MS);
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(1);
		await settle();
		expect(source.calls).toBe(2);
		expect(await readSnapshot(KEY, CHANNEL, source.build)).toBe(2);
	});

	it("takes an event for another channel as nothing", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);

		markSitemapStale("cz-czk");
		vi.setSystemTime(Date.now() + MIN_REFRESH_AFTER_EVENT_MS + 1);
		await readSnapshot(KEY, CHANNEL, source.build);
		await settle();
		expect(source.calls).toBe(1);
	});

	it("rebuilds again for an event that arrived while the last rebuild was running", async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		let calls = 0;
		const build = vi.fn(async () => {
			const mine = ++calls;
			if (mine === 2) await gate;
			return mine;
		});
		await readSnapshot(KEY, CHANNEL, build);

		vi.setSystemTime(Date.now() + FRESH_MS + 1);
		await readSnapshot(KEY, CHANNEL, build); // starts rebuild 2, which waits at the gate
		markSitemapStale(CHANNEL); // after rebuild 2 began: it may not contain this change
		vi.setSystemTime(Date.now() + 1_000);
		release();
		await settle();
		expect(await readSnapshot(KEY, CHANNEL, build)).toBe(2);

		vi.setSystemTime(Date.now() + MIN_REFRESH_AFTER_EVENT_MS);
		await readSnapshot(KEY, CHANNEL, build);
		await settle();
		expect(calls).toBe(3);
	});

	it("keeps the old complete list when the rebuild fails, and waits before trying again", async () => {
		const build = vi.fn<() => Promise<string>>().mockResolvedValueOnce("complete");
		await readSnapshot(KEY, CHANNEL, build);

		build.mockRejectedValueOnce(new Error("page 40 did not resolve"));
		vi.setSystemTime(Date.now() + FRESH_MS + 1);
		expect(await readSnapshot(KEY, CHANNEL, build)).toBe("complete");
		await settle();
		expect(build).toHaveBeenCalledTimes(2);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining("rebuild failed"),
			"page 40 did not resolve",
		);

		// Still the complete list, and no new attempt on every request.
		expect(await readSnapshot(KEY, CHANNEL, build)).toBe("complete");
		await settle();
		expect(build).toHaveBeenCalledTimes(2);

		build.mockResolvedValueOnce("newer");
		vi.setSystemTime(Date.now() + RETRY_AFTER_FAILURE_MS + 1);
		expect(await readSnapshot(KEY, CHANNEL, build)).toBe("complete");
		await settle();
		expect(await readSnapshot(KEY, CHANNEL, build)).toBe("newer");
	});

	it("stops serving a list older than a day, and fails when it cannot be rebuilt", async () => {
		const build = vi.fn<() => Promise<string>>().mockResolvedValueOnce("complete");
		await readSnapshot(KEY, CHANNEL, build);

		vi.setSystemTime(Date.now() + MAX_STALE_MS + 1);
		build.mockRejectedValueOnce(new Error("Saleor is down"));
		await expect(readSnapshot(KEY, CHANNEL, build)).rejects.toThrow("Saleor is down");
		expect(peekSnapshot(KEY, CHANNEL, build)).toBeUndefined();

		build.mockResolvedValueOnce("rebuilt");
		await expect(readSnapshot(KEY, CHANNEL, build)).resolves.toBe("rebuilt");
	});

	it("lets the index peek at it, and keeps it fresh by asking", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);
		expect(peekSnapshot(KEY, CHANNEL, source.build)).toBe(1);

		vi.setSystemTime(Date.now() + FRESH_MS + 1);
		expect(peekSnapshot(KEY, CHANNEL, source.build)).toBe(1);
		await settle();
		expect(peekSnapshot(KEY, CHANNEL, source.build)).toBe(2);
	});
});

describe("warming", () => {
	it("never rejects: a market that fails is built by the request that needs it", async () => {
		const build = vi.fn<() => Promise<number>>().mockRejectedValueOnce(new Error("no Saleor yet"));
		await expect(warmSnapshot(KEY, CHANNEL, build)).resolves.toBe(false);

		build.mockResolvedValueOnce(5);
		await expect(readSnapshot(KEY, CHANNEL, build)).resolves.toBe(5);
	});

	it("has nothing to do for a list that is kept and fresh", async () => {
		const source = numbered();
		await readSnapshot(KEY, CHANNEL, source.build);
		await expect(warmSnapshot(KEY, CHANNEL, source.build)).resolves.toBe(true);
		expect(source.calls).toBe(1);
	});

	it("walks Saleor on a few connections at a time, not on all twelve", async () => {
		let running = 0;
		let peak = 0;
		const releases: Array<() => void> = [];
		const build = vi.fn(
			() =>
				new Promise<number>((resolve) => {
					running++;
					peak = Math.max(peak, running);
					releases.push(() => {
						running--;
						resolve(1);
					});
				}),
		);

		const markets = Array.from({ length: 12 }, (_, index) => `market-${index}`);
		const all = Promise.all(markets.map((market) => warmSnapshot(`${market}\u0000x`, market, build)));
		await settle();
		expect(running).toBe(MAX_BACKGROUND_BUILDS);

		// Finish them as they come: the next one in line starts as each place frees.
		while (releases.length > 0 || running > 0) {
			releases.shift()?.();
			await settle();
		}
		await all;
		expect(build).toHaveBeenCalledTimes(12);
		expect(peak).toBe(MAX_BACKGROUND_BUILDS);
	});
});
