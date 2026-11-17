import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installRevalidateShutdown, onRevalidateShutdown } from "./revalidate-shutdown";
import { __resetRevalidateStats, recordRevalidateRequest } from "./revalidate-stats";
import { __resetRevalidateThrottle, submitThrottled } from "./revalidate-throttle";

let lines: string[];

beforeEach(() => {
	__resetRevalidateStats();
	__resetRevalidateThrottle();
	lines = [];
	vi.spyOn(console, "log").mockImplementation((line: string) => {
		lines.push(line);
	});
});

afterEach(() => {
	__resetRevalidateStats();
	__resetRevalidateThrottle();
	vi.restoreAllMocks();
});

const fakeProcess = (env: Record<string, string> = {}) =>
	Object.assign(new EventEmitter(), { env, pid: 4242, kill: vi.fn() }) as unknown as NodeJS.Process;

describe("what /api/revalidate does when the process is stopped", () => {
	it("writes the minute in progress and says nothing about owed work when none is owed", () => {
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 3 });
		onRevalidateShutdown();
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("[revalidate-events] window=");
		expect(lines[0]).toContain("total=1");
	});

	it("names how many keys were owed throttled work, and does not run it", () => {
		const first = vi.fn();
		const held = vi.fn();
		submitThrottled("list:at-eur", first, 0);
		submitThrottled("list:at-eur", held, 1_000);
		submitThrottled("market:at-eur", vi.fn(), 0);
		submitThrottled("market:at-eur", vi.fn(), 1_000);
		submitThrottled("menu:at-eur", vi.fn(), 0);

		onRevalidateShutdown();

		expect(held).not.toHaveBeenCalled();
		expect(lines.join("\n")).toContain("owed for 2 key(s)");
	});

	it("hooks SIGTERM and SIGINT once, and the hook writes the window and does not exit", () => {
		const target = fakeProcess();
		expect(installRevalidateShutdown(target)).toBe(true);
		expect(installRevalidateShutdown(target)).toBe(false);
		expect(target.listenerCount("SIGTERM")).toBe(1);
		expect(target.listenerCount("SIGINT")).toBe(1);

		// Next's own handler is there too: it ends the process, so ours must not.
		target.on("SIGINT", () => {});
		recordRevalidateRequest({ type: "ProductUpdated", outcome: "applied", ms: 3 });
		target.emit("SIGINT");
		expect(lines[0]).toContain("total=1");
		expect(target.kill).not.toHaveBeenCalled();
	});

	it("gives the default of dying back when it is the only listener", () => {
		const target = fakeProcess();
		installRevalidateShutdown(target);
		target.emit("SIGTERM");
		expect(target.kill).toHaveBeenCalledWith(4242, "SIGTERM");
		expect(target.listenerCount("SIGTERM")).toBe(0);
	});

	it("stays out when Next's own signal handling is switched off, since nothing would then end the process", () => {
		const target = fakeProcess({ NEXT_MANUAL_SIG_HANDLE: "1" });
		expect(installRevalidateShutdown(target)).toBe(false);
		expect(target.listenerCount("SIGTERM")).toBe(0);
	});
});
