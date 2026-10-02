import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { describePointer, releaseEnabled, releaseSetting } from "./config";

/**
 * The one switch that turns release mode on, and what it refuses.
 *
 * The address decides what a whole market serves, so it is held to a standard of its own: https only, no
 * credentials in it, and read from the environment at call time so that the deploy's restart is the only
 * thing that ever changes it.
 */

const ENV = [
	"MAKY_RELEASE_MANIFEST_URL",
	"MAKY_RELEASE_POLL_SECONDS",
	"MAKY_RELEASE_MANIFEST_TIMEOUT_MS",
	"MAKY_RELEASE_FILE_TIMEOUT_MS",
] as const;
const SAVED = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));

const ADDRESS = "https://cfm.example/media/fitment/releases/MANIFEST.json";

beforeEach(() => {
	for (const key of ENV) delete process.env[key];
});

afterEach(() => {
	for (const key of ENV) {
		if (SAVED[key] === undefined) delete process.env[key];
		else process.env[key] = SAVED[key];
	}
});

function configured() {
	const setting = releaseSetting();
	if (setting.kind !== "on") throw new Error(`expected release mode on, got ${setting.kind}`);
	return setting.config;
}

describe("the release setting", () => {
	it("is off when the address is not set, or is only blanks, and the process behaves as before", () => {
		expect(releaseSetting()).toEqual({ kind: "off" });
		expect(releaseEnabled()).toBe(false);

		process.env.MAKY_RELEASE_MANIFEST_URL = "   ";
		expect(releaseSetting()).toEqual({ kind: "off" });
	});

	it.each([
		["not a URL", "this is not a url", "is not a URL"],
		["plain http", "http://cfm.example/media/fitment/releases/MANIFEST.json", "is not https"],
		["another scheme", "ftp://cfm.example/MANIFEST.json", "is not https"],
		["a file path", "file:///srv/MANIFEST.json", "is not https"],
		[
			"credentials in the address",
			"https://user:secret@cfm.example/MANIFEST.json",
			"must not carry credentials",
		],
	])("refuses %s, and stays off rather than half on", (_what, address, reason) => {
		process.env.MAKY_RELEASE_MANIFEST_URL = address;

		const setting = releaseSetting();

		expect(setting.kind).toBe("invalid");
		expect(setting).toMatchObject({ reason: expect.stringContaining(reason) });
		expect(releaseEnabled()).toBe(false);
	});

	it("never repeats the credentials it refused", () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = "https://user:hunter2@cfm.example/MANIFEST.json";

		expect(JSON.stringify(releaseSetting())).not.toContain("hunter2");
	});

	it("is on for an https address, with the defaults the contract states", () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = ADDRESS;

		expect(releaseEnabled()).toBe(true);
		expect(configured()).toEqual({
			manifestUrl: ADDRESS,
			pollMs: 30_000,
			manifestTimeoutMs: 10_000,
			fileTimeoutMs: 60_000,
		});
	});

	it("keeps the poll interval within 10 to 300 seconds, and ignores what is not a positive number", () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = ADDRESS;

		for (const [given, ms] of [
			["45", 45_000],
			["1", 10_000],
			["5000", 300_000],
			["abc", 30_000],
			["0", 30_000],
			["-20", 30_000],
			["", 30_000],
		] as const) {
			process.env.MAKY_RELEASE_POLL_SECONDS = given;
			expect(configured().pollMs, `poll seconds ${JSON.stringify(given)}`).toBe(ms);
		}
	});

	it("keeps the timeouts within sane bounds", () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = ADDRESS;

		process.env.MAKY_RELEASE_MANIFEST_TIMEOUT_MS = "100";
		process.env.MAKY_RELEASE_FILE_TIMEOUT_MS = "100";
		expect(configured()).toMatchObject({ manifestTimeoutMs: 1_000, fileTimeoutMs: 5_000 });

		process.env.MAKY_RELEASE_MANIFEST_TIMEOUT_MS = "9999999";
		process.env.MAKY_RELEASE_FILE_TIMEOUT_MS = "9999999";
		expect(configured()).toMatchObject({ manifestTimeoutMs: 60_000, fileTimeoutMs: 300_000 });
	});

	it("is read when asked, so the next call sees what the environment says now", () => {
		expect(releaseEnabled()).toBe(false);
		process.env.MAKY_RELEASE_MANIFEST_URL = ADDRESS;
		expect(releaseEnabled()).toBe(true);
		delete process.env.MAKY_RELEASE_MANIFEST_URL;
		expect(releaseEnabled()).toBe(false);
	});
});

describe("naming the pointer in a log line", () => {
	it("is the host and the path, and nothing else", () => {
		process.env.MAKY_RELEASE_MANIFEST_URL = `${ADDRESS}?token=not-for-logs#fragment`;

		expect(describePointer(configured())).toBe("cfm.example/media/fitment/releases/MANIFEST.json");
	});
});
