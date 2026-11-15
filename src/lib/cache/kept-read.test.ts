import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __forgetAllKept, createKeptRead, invalidateKept } from "./kept-read";

/**
 * The scenario this exists for (2026-11-15, `/sk/stresne-nosice`): Saleor needs 1.7 s for a read whose
 * caller used to give up after 2 s and throw the work away, and a fault was remembered for 5 s, so the
 * visitor after every pause paid the whole deadline again.
 */

const FRESH = 60_000;
const PAUSE = 10_000;
const LOAD = 8_000;

/** A source whose answer takes `delay` ms to arrive and can be made to fail. */
function source() {
	const state = { delay: 1_700, answer: "A", fail: false, calls: 0, aborted: 0 };
	const load = vi.fn(async (_arg: string, signal: AbortSignal) => {
		state.calls += 1;
		await new Promise<void>((resolve) => setTimeout(resolve, state.delay));
		if (signal.aborted) state.aborted += 1;
		if (state.fail) throw new Error("[test] source unavailable: deadline exceeded");
		return state.answer;
	});
	return { state, load };
}

function keeper(load: (arg: string, signal: AbortSignal) => Promise<string>) {
	return createKeptRead<string, string>({
		name: "test-read",
		freshMs: FRESH,
		pauseMs: PAUSE,
		loadDeadlineMs: LOAD,
		load,
	});
}

beforeEach(() => {
	__forgetAllKept();
	vi.useFakeTimers();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("a key never answered", () => {
	it("is loaded once for every visitor asking meanwhile", async () => {
		const { load } = source();
		const kept = keeper(load);
		const visits = [kept.read("k", "arg", 2_000), kept.read("k", "arg", 2_000), kept.read("k", "arg", 2_000)];
		await vi.advanceTimersByTimeAsync(1_700);
		await expect(Promise.all(visits)).resolves.toEqual(["A", "A", "A"]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("keeps loading after the visitor stopped waiting, so the next visitor finds the answer at once", async () => {
		const { state, load } = source();
		state.delay = 2_600; // longer than the 2 s a visitor waits, shorter than the load's own deadline
		const kept = keeper(load);

		const first = kept.read("k", "arg", 2_000);
		const outcome = expect(first).rejects.toThrow("[test-read] still loading for k");
		await vi.advanceTimersByTimeAsync(2_000);
		await outcome;
		expect(state.aborted).toBe(0);

		await vi.advanceTimersByTimeAsync(700); // the load lands
		const next = await kept.read("k", "arg", 2_000);
		expect(next).toBe("A");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("hands the source's own fault to the visitor, and leaves the key alone for the pause", async () => {
		const { state, load } = source();
		state.fail = true;
		state.delay = 50;
		const kept = keeper(load);

		const first = expect(kept.read("k", "arg", 2_000)).rejects.toThrow(
			"source unavailable: deadline exceeded",
		);
		await vi.advanceTimersByTimeAsync(50);
		await first;

		// Within the pause the source is not asked again: the visitor is told at once, not after 2 s.
		await expect(kept.read("k", "arg", 2_000)).rejects.toThrow("source unavailable: deadline exceeded");
		expect(load).toHaveBeenCalledTimes(1);

		state.fail = false;
		await vi.advanceTimersByTimeAsync(PAUSE);
		const again = kept.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(50);
		await expect(again).resolves.toBe("A");
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("writes a slow answer to the log with its duration, and a quick one not at all", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const { state, load } = source();
		const kept = keeper(load);
		state.delay = 50;
		const quick = kept.read("quick", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(50);
		await quick;
		expect(console.log).not.toHaveBeenCalled();

		state.delay = 1_700;
		const slow = kept.read("slow", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(1_700);
		await slow;
		expect(vi.mocked(console.log).mock.calls[0]?.join(" ")).toMatch(
			/\[test-read\] slow answered after \d+ ms$/,
		);
	});

	it("keeps `null` as an answer", async () => {
		const kept = createKeptRead<string, string | null>({
			name: "test-read",
			freshMs: FRESH,
			pauseMs: PAUSE,
			loadDeadlineMs: LOAD,
			load: async () => null,
		});
		await expect(kept.read("k", "arg", 1_000)).resolves.toBeNull();
		await expect(kept.read("k", "arg", 1_000)).resolves.toBeNull();
	});
});

describe("a key with an answer", () => {
	async function answered() {
		const { state, load } = source();
		const kept = keeper(load);
		const first = kept.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(1_700);
		await first;
		load.mockClear();
		return { state, load, kept };
	}

	it("serves it without asking while it is fresh", async () => {
		const { load, kept } = await answered();
		await vi.advanceTimersByTimeAsync(FRESH - 1);
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		expect(load).not.toHaveBeenCalled();
	});

	it("serves the old answer AT ONCE when it is stale, and refreshes once behind it", async () => {
		const { state, load, kept } = await answered();
		await vi.advanceTimersByTimeAsync(FRESH);
		state.answer = "B";

		// Three visitors while Saleor needs 1.7 s: none of them waits, one refresh runs.
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		expect(load).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1_700);
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("B");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("keeps the old answer when the refresh fails, says so in the log once, and pauses the key", async () => {
		const { state, load, kept } = await answered();
		await vi.advanceTimersByTimeAsync(FRESH);
		state.fail = true;

		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		await vi.advanceTimersByTimeAsync(1_700);
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");

		expect(load).toHaveBeenCalledTimes(1);
		expect(console.warn).toHaveBeenCalledTimes(1);
		// With the time, the duration and what the visitors get meanwhile: the server's own log has none of them.
		expect(vi.mocked(console.warn).mock.calls[0]?.join(" ")).toMatch(
			/^\d{4}-\d\d-\d\dT[\d:.]+Z \[test-read\] k failed after \d+ ms, the earlier answer stays: .*deadline exceeded/,
		);

		// After the pause it asks again, and a source that is back replaces the answer.
		state.fail = false;
		state.answer = "C";
		await vi.advanceTimersByTimeAsync(PAUSE);
		await kept.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(1_700);
		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("C");
	});
});

describe("prewarm", () => {
	it("waits for the whole load and leaves the answer kept", async () => {
		const { state, load } = source();
		state.delay = 6_000; // far longer than any visitor would wait
		const kept = keeper(load);

		const warmed = kept.prewarm("k", "arg");
		await vi.advanceTimersByTimeAsync(6_000);
		await expect(warmed).resolves.toBe(true);

		await expect(kept.read("k", "arg", 2_000)).resolves.toBe("A");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("reports a source that did not answer, without throwing", async () => {
		const { state, load } = source();
		state.fail = true;
		state.delay = 10;
		const kept = keeper(load);
		const warmed = kept.prewarm("k", "arg");
		await vi.advanceTimersByTimeAsync(10);
		await expect(warmed).resolves.toBe(false);
	});
});

describe("an answer that is given no life", () => {
	const keeperWith = (
		freshMs: (value: string) => number,
		load: (arg: string, signal: AbortSignal) => Promise<string>,
	) =>
		createKeptRead<string, string>({
			name: "test-life",
			freshMs,
			pauseMs: PAUSE,
			loadDeadlineMs: LOAD,
			load,
		});

	it("is not kept, and replaces the earlier answer so that it is not served stale afterwards", async () => {
		const { state, load } = source();
		state.delay = 10;
		const kept = keeperWith((value) => (value === "A" ? FRESH : 0), load);

		const first = kept.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(10);
		await expect(first).resolves.toBe("A");

		await vi.advanceTimersByTimeAsync(FRESH + 1);
		state.answer = "EMPTY";
		// Stale: the old answer once, the new one behind it.
		const second = kept.read("k", "arg", 2_000);
		await expect(second).resolves.toBe("A");
		await vi.advanceTimersByTimeAsync(10);

		// The new answer has no life: the next visit waits for a load of its own instead of being handed "A".
		const third = kept.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(10);
		await expect(third).resolves.toBe("EMPTY");
		expect(load).toHaveBeenCalledTimes(3);
	});
});

describe("taking answers out of use", () => {
	it("`drop` makes the next visit wait for a new answer; `stale` hands the old one once and reads a new one behind it", async () => {
		const { state, load } = source();
		state.delay = 10;
		const kept = keeper(load);
		const warm = kept.read("a", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(10);
		await warm;
		const warm2 = kept.read("b", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(10);
		await warm2;

		state.answer = "B";
		expect(invalidateKept((name, key) => name === "test-read" && key === "a", "drop")).toBe(1);
		expect(invalidateKept((_name, key) => key === "b", "stale")).toBe(1);

		const dropped = kept.read("a", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(10);
		await expect(dropped).resolves.toBe("B");

		await expect(kept.read("b", "arg", 2_000)).resolves.toBe("A");
		await vi.advanceTimersByTimeAsync(10);
		await expect(kept.read("b", "arg", 2_000)).resolves.toBe("B");
	});

	it("reaches the answers another copy of the module holds, because the state is the process's and not the module's", async () => {
		const { load } = source();
		const one = keeper(load);
		const other = keeper(load);
		const warm = one.read("k", "arg", 2_000);
		await vi.advanceTimersByTimeAsync(1_700);
		await warm;
		load.mockClear();

		await expect(other.read("k", "arg", 2_000)).resolves.toBe("A");
		expect(load).not.toHaveBeenCalled();
	});
});
