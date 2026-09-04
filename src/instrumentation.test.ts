import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "./instrumentation";

/**
 * The boot line for the § 20a online function.
 *
 * It exists so that "is the withdrawal transport configured?" can be answered from the
 * deploy output — the same way `[market-state]` and `[route-existence]` already are —
 * instead of by opening `/opt/storefront/.env` and reading a Cloudflare Access token
 * and an HMAC secret off a terminal. So the property under test is not only that the
 * line is right, but that it says nothing it read.
 */

const FORMS_VARS = [
	"PAYLOAD_CMS_URL",
	"PAYLOAD_CF_ACCESS_CLIENT_ID",
	"PAYLOAD_CF_ACCESS_CLIENT_SECRET",
	"MAKY_FORMS_HMAC_SECRET",
] as const;

// Values chosen to be recognisable in any output. If one of these strings appears in a
// log line, something printed a setting instead of naming it.
const SECRETS: Record<(typeof FORMS_VARS)[number], string> = {
	PAYLOAD_CMS_URL: "https://cms.example.invalid",
	PAYLOAD_CF_ACCESS_CLIENT_ID: "canary-access-id-3f2504e0",
	PAYLOAD_CF_ACCESS_CLIENT_SECRET: "canary-access-secret-4f8941d3",
	MAKY_FORMS_HMAC_SECRET: "canary-hmac-9a0c0305e82c3301",
};

interface Captured {
	readonly log: string[];
	readonly warn: string[];
	readonly error: string[];
	readonly all: string;
}

async function boot(env: Record<string, string | undefined>): Promise<Captured> {
	vi.stubEnv("NEXT_RUNTIME", "nodejs");
	for (const [name, value] of Object.entries(env)) {
		vi.stubEnv(name, value as string);
	}

	const log: string[] = [];
	const warn: string[] = [];
	const error: string[] = [];
	const join = (parts: unknown[]) => parts.map(String).join(" ");

	vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => log.push(join(parts)));
	vi.spyOn(console, "warn").mockImplementation((...parts: unknown[]) => warn.push(join(parts)));
	vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => error.push(join(parts)));

	await register();

	return { log, warn, error, all: [...log, ...warn, ...error].join("\n") };
}

const withdrawalLine = (c: Captured): string =>
	[...c.log, ...c.warn, ...c.error].find((line) => line.startsWith("[withdrawal] form=")) ?? "";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("the withdrawal configuration read-back", () => {
	it("reports a fully configured transport by readiness, never by value", async () => {
		const captured = await boot({ ...SECRETS, WITHDRAWAL_BACKEND_LIVE: "true" });

		expect(withdrawalLine(captured)).toBe("[withdrawal] form=on transport=configured missing=");

		// The point of the whole line.
		for (const value of Object.values(SECRETS)) {
			expect(captured.all).not.toContain(value);
		}
	});

	it("names what is unset, and only the names", async () => {
		const captured = await boot({
			PAYLOAD_CMS_URL: SECRETS.PAYLOAD_CMS_URL,
			PAYLOAD_CF_ACCESS_CLIENT_ID: undefined,
			PAYLOAD_CF_ACCESS_CLIENT_SECRET: undefined,
			MAKY_FORMS_HMAC_SECRET: SECRETS.MAKY_FORMS_HMAC_SECRET,
		});

		const line = withdrawalLine(captured);
		expect(line).toContain("transport=incomplete");
		expect(line).toContain("missing=PAYLOAD_CF_ACCESS_CLIENT_ID,PAYLOAD_CF_ACCESS_CLIENT_SECRET");
		expect(line).not.toContain(SECRETS.PAYLOAD_CMS_URL);
		expect(line).not.toContain(SECRETS.MAKY_FORMS_HMAC_SECRET);
	});

	it("shouts about the one combination that looks fine from outside", async () => {
		// Form offered, nothing behind it: the page renders, the customer fills it in,
		// and every submission comes back "we did not record your notice".
		const captured = await boot({
			PAYLOAD_CMS_URL: undefined,
			PAYLOAD_CF_ACCESS_CLIENT_ID: undefined,
			PAYLOAD_CF_ACCESS_CLIENT_SECRET: undefined,
			MAKY_FORMS_HMAC_SECRET: undefined,
			WITHDRAWAL_BACKEND_LIVE: "true",
		});

		expect(withdrawalLine(captured)).toContain("form=on transport=incomplete");
		expect(captured.error.join("\n")).toContain("the form is being offered but the forms transport");
	});

	it("says why the form is off rather than leaving a blank", async () => {
		// Only production consults the interlock — development is where the form is
		// exercised, so it is exempt there and this has to be pinned in both modes.
		const captured = await boot({
			...SECRETS,
			NODE_ENV: "production",
			WITHDRAWAL_BACKEND_LIVE: undefined,
		});

		expect(withdrawalLine(captured)).toContain("form=off");
		expect(captured.warn.join("\n")).toContain("[withdrawal] online-function-off");
		expect(captured.warn.join("\n")).toContain("WITHDRAWAL_BACKEND_LIVE");
	});

	it("keeps the interlock a per-process reading, not a build-time constant", async () => {
		const off = await boot({ ...SECRETS, NODE_ENV: "production", WITHDRAWAL_BACKEND_LIVE: "TRUE" });
		expect(withdrawalLine(off)).toContain("form=off");

		vi.unstubAllEnvs();
		vi.restoreAllMocks();

		const on = await boot({ ...SECRETS, NODE_ENV: "production", WITHDRAWAL_BACKEND_LIVE: "true" });
		expect(withdrawalLine(on)).toContain("form=on");
	});

	it("still prints the lines the deploy script already reads back", async () => {
		const captured = await boot({ ...SECRETS, MAKY_LIVE_MARKETS: "sk" });

		expect(captured.log.some((line) => line.startsWith("[market-state] live="))).toBe(true);
		expect(captured.log.some((line) => line.startsWith("[route-existence] gate="))).toBe(true);
	});

	it("stays out of the edge runtime, where the env is not the same one", async () => {
		vi.stubEnv("NEXT_RUNTIME", "edge");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await register();

		expect(log).not.toHaveBeenCalled();
	});
});
