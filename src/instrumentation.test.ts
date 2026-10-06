import { afterEach, describe, expect, it, vi } from "vitest";

// The live list has its own tests, against a fake Saleor. Here it is only asked whether boot calls
// it — and the stubbed `fetch` of the fitment tests below must not be answered for it.
const { prewarmLiveCategories } = vi.hoisted(() => ({
	prewarmLiveCategories: vi.fn(async (): Promise<void> => {}),
}));
vi.mock("./lib/live-categories", () => ({ prewarmLiveCategories }));

import { register } from "./instrumentation";
import { __forgetRootContext, hasRootContext } from "./lib/async/detached";
import { datasetHashFromText } from "./lib/fitment/dataset-hash";
import fixtureDataset from "./lib/fitment/fixtures/dataset-v1.json";
import { __resetFitmentMemo } from "./lib/fitment/provider";

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
	// Off unless a test asks for it: boot loads the fitment dataset, and no test may reach
	// for a real one because the shell it runs in happens to have MAKY_FITMENT_* set.
	vi.stubEnv("MAKY_FITMENT_PROVIDER", "");
	vi.stubEnv("NEXT_PHASE", "");
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
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	prewarmLiveCategories.mockClear();
	__resetFitmentMemo();
	__forgetRootContext();
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

/**
 * The fitment dataset is loaded by boot, not by the first page that needs it — so no render
 * waits for the download — and boot captures the context that background refreshes run in
 * before any request exists (see `src/lib/async/detached.ts`).
 */
describe("the fitment dataset at boot", () => {
	const SALEOR_HOST = "api.maky.store";

	function delivery(): string {
		const d = JSON.parse(JSON.stringify(fixtureDataset)) as Record<string, unknown>;
		delete d.demoCatalogue;
		d.source = { system: "cfm" };
		d.saleorInstance = SALEOR_HOST;
		d.datasetVersion = "3.0.0-full-boot";
		delete d.datasetHash;
		d.datasetHash = datasetHashFromText(JSON.stringify(d));
		return JSON.stringify(d);
	}

	const HTTP = {
		MAKY_FITMENT_PROVIDER: "http",
		MAKY_FITMENT_URL: "https://carfitmanager.test/fitment.json",
		NEXT_PUBLIC_SALEOR_API_URL: `https://${SALEOR_HOST}/graphql/`,
	};

	it("captures the boot context and loads the dataset before any request", async () => {
		const upstream = vi.fn(async () => new Response(delivery(), { status: 200 }));
		vi.stubGlobal("fetch", upstream);

		const captured = await boot({ ...SECRETS, ...HTTP });

		expect(hasRootContext()).toBe(true);
		expect(upstream).toHaveBeenCalledTimes(1);
		expect(
			captured.log.some((line) =>
				/^\[fitment\] loaded 3\.0\.0-full-boot [0-9a-f]{64} \(\d+ B, \d+ ms\)$/.test(line),
			),
		).toBe(true);
	});

	it("does neither during next build, whose prerenders must wait for their own load", async () => {
		const upstream = vi.fn();
		vi.stubGlobal("fetch", upstream);

		await boot({ ...SECRETS, ...HTTP, NEXT_PHASE: "phase-production-build" });

		expect(hasRootContext()).toBe(false);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("still starts when CFM is down at boot, and says so", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
		);

		const captured = await boot({ ...SECRETS, ...HTTP });

		expect(captured.error.join("\n")).toContain("[fitment] load failed (fetch-failed)");
		// The rest of boot ran: the deploy script's read-back lines are all there.
		expect(captured.log.some((line) => line.startsWith("[market-state] live="))).toBe(true);
	});
});

/**
 * Owner, 2026-10-06: a category created in Saleor gets its root URL with no edit and no deploy. The
 * live category list that makes it so is loaded at boot — before the first request, so a cache
 * filled at start-up does not bake a `/categories/…` link for a category that already has a root.
 */
describe("the live category list at boot", () => {
	it("is loaded before the process answers anything, and boot waits for it", async () => {
		let loaded = false;
		prewarmLiveCategories.mockImplementationOnce(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			loaded = true;
		});

		await boot({ ...SECRETS });

		expect(prewarmLiveCategories).toHaveBeenCalledTimes(1);
		expect(loaded).toBe(true);
	});

	it("is left alone during next build, which reaches out from nothing in here", async () => {
		await boot({ ...SECRETS, NEXT_PHASE: "phase-production-build" });

		expect(prewarmLiveCategories).not.toHaveBeenCalled();
	});

	it("is not run in the edge runtime", async () => {
		vi.stubEnv("NEXT_RUNTIME", "edge");
		vi.spyOn(console, "log").mockImplementation(() => {});

		await register();

		expect(prewarmLiveCategories).not.toHaveBeenCalled();
	});
});
