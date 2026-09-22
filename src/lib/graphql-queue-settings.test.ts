import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The queue settings decide how fast the whole storefront can be, and they fail silently.
 *
 * Two distinct failures are asserted here, both of which the code had:
 *
 *   - a 200 ms floor under every query, which cost a flat ~170 ms of idle wait on every page
 *     against a self-hosted Saleor that answers in 35 ms. The default must stay at no floor,
 *     so that a box without the env vars is fast rather than quietly throttled;
 *   - `parseInt("")` is `NaN`, and `activeRequests < NaN` is false for every value — a
 *     mistyped env var would have parked every query in the queue forever and taken the site
 *     down with nothing in the logs. A bad value must fall back, never propagate.
 *
 * The settings are read once at module load, so each case needs a fresh module registry.
 */
async function settingsWith(env: Record<string, string | undefined>) {
	vi.resetModules();
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	const { saleorQueueSettings } = await import("./graphql");
	return saleorQueueSettings();
}

const KEYS = ["SALEOR_MAX_CONCURRENT_REQUESTS", "SALEOR_MIN_REQUEST_DELAY_MS"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
	for (const k of KEYS) saved[k] = process.env[k];
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
});

afterEach(() => {
	for (const k of KEYS) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
	vi.resetModules();
});

describe("Saleor request queue settings", () => {
	it("defaults to no artificial delay", async () => {
		const s = await settingsWith({
			SALEOR_MAX_CONCURRENT_REQUESTS: undefined,
			SALEOR_MIN_REQUEST_DELAY_MS: undefined,
		});
		expect(s.minDelayMs).toBe(0);
		expect(s.maxConcurrent).toBe(12);
	});

	it("takes explicit values from the environment", async () => {
		const s = await settingsWith({
			SALEOR_MAX_CONCURRENT_REQUESTS: "4",
			SALEOR_MIN_REQUEST_DELAY_MS: "250",
		});
		expect(s).toEqual({ maxConcurrent: 4, minDelayMs: 250 });
	});

	it("accepts an explicit zero delay rather than treating it as unset", async () => {
		const s = await settingsWith({
			SALEOR_MAX_CONCURRENT_REQUESTS: undefined,
			SALEOR_MIN_REQUEST_DELAY_MS: "0",
		});
		expect(s.minDelayMs).toBe(0);
	});

	it.each(["", "   ", "abc", "-1", "0"])(
		"falls back rather than letting %j reach the concurrency limit",
		async (raw) => {
			const s = await settingsWith({
				SALEOR_MAX_CONCURRENT_REQUESTS: raw,
				SALEOR_MIN_REQUEST_DELAY_MS: undefined,
			});
			// Never NaN and never below one: either would stall the queue permanently.
			expect(Number.isFinite(s.maxConcurrent)).toBe(true);
			expect(s.maxConcurrent).toBeGreaterThanOrEqual(1);
		},
	);

	it("never lets a negative delay through", async () => {
		const s = await settingsWith({
			SALEOR_MAX_CONCURRENT_REQUESTS: undefined,
			SALEOR_MIN_REQUEST_DELAY_MS: "-5",
		});
		expect(s.minDelayMs).toBe(0);
	});
});
