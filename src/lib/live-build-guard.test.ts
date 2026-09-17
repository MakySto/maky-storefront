import { afterEach, describe, expect, it, vi } from "vitest";

import { evaluateBuildSafety, main, parsePm2Processes } from "../../scripts/ops/guard-live-build.mjs";

const pm2Process = (name: string, status: string) => ({
	name,
	pm2_env: { status },
});

describe("live build guard", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("does not inspect PM2 outside the canonical live checkout", () => {
		const runPm2 = vi.fn();

		expect(
			main({
				cwd: "/work/storefront",
				liveDir: "/opt/storefront",
				runPm2,
				canonicalize: (path: string) => path,
			}),
		).toBe(0);
		expect(runPm2).not.toHaveBeenCalled();
	});

	it("allows the canonical deploy script to build after PM2 has stopped the app", () => {
		expect(
			main({
				cwd: "/opt/storefront",
				liveDir: "/opt/storefront",
				runPm2: () => ({
					status: 0,
					stdout: JSON.stringify([pm2Process("maky-storefront", "stopped")]),
					stderr: "",
				}),
				log: vi.fn(),
				canonicalize: (path: string) => path,
			}),
		).toBe(0);
	});

	it("blocks a direct build while the production app is online", () => {
		const messages: string[] = [];

		expect(
			main({
				cwd: "/opt/storefront",
				liveDir: "/opt/storefront",
				runPm2: () => ({
					status: 0,
					stdout: JSON.stringify([pm2Process("maky-storefront", "online")]),
					stderr: "",
				}),
				log: (message: string) => messages.push(message),
				canonicalize: (path: string) => path,
			}),
		).toBe(1);
		expect(messages.join("\n")).toContain("deploy-production.sh");
		expect(messages.join("\n")).toContain("status: online");
	});

	it("fails closed when the expected PM2 app is absent", () => {
		const messages: string[] = [];

		expect(
			main({
				cwd: "/opt/storefront",
				liveDir: "/opt/storefront",
				runPm2: () => ({
					status: 0,
					stdout: JSON.stringify([pm2Process("maky-smtp-app", "online")]),
					stderr: "",
				}),
				log: (message: string) => messages.push(message),
				canonicalize: (path: string) => path,
			}),
		).toBe(1);
		expect(messages.join("\n")).toContain('no registered app named "maky-storefront"');
	});

	it("uses hardcoded production defaults even when similarly named environment variables are set", () => {
		vi.stubEnv("LIVE_STOREFRONT_DIR", "/tmp/not-production");
		vi.stubEnv("PM2_APP", "maky-smtp-app");
		const runPm2 = vi.fn(() => ({
			status: 0,
			stdout: JSON.stringify([pm2Process("maky-storefront", "online")]),
			stderr: "",
		}));

		expect(
			main({
				cwd: "/opt/storefront",
				runPm2,
				log: vi.fn(),
				canonicalize: (path: string) => path,
			}),
		).toBe(1);
		expect(runPm2).toHaveBeenCalledOnce();
	});

	it.each(["launching", "stopping", "waiting restart", "unknown"])(
		"blocks the non-stopped PM2 state %s",
		(status) => {
			expect(
				evaluateBuildSafety({
					currentDirectory: "/opt/storefront",
					liveDirectory: "/opt/storefront",
					appName: "maky-storefront",
					processes: [pm2Process("maky-storefront", status)],
				}),
			).toMatchObject({ allowed: false });
		},
	);

	it("treats unrelated PM2 applications as no proof that the storefront is stopped", () => {
		expect(
			evaluateBuildSafety({
				currentDirectory: "/opt/storefront",
				liveDirectory: "/opt/storefront",
				appName: "maky-storefront",
				processes: [pm2Process("maky-smtp-app", "online")],
			}),
		).toMatchObject({
			allowed: false,
			reason: expect.stringContaining("cannot be proven safe"),
		});
	});

	it("fails closed when PM2 cannot be inspected", () => {
		const messages: string[] = [];

		expect(
			main({
				cwd: "/opt/storefront",
				liveDir: "/opt/storefront",
				runPm2: () => ({
					status: 127,
					stdout: "",
					stderr: "pm2: command not found",
				}),
				log: (message: string) => messages.push(message),
				canonicalize: (path: string) => path,
			}),
		).toBe(1);
		expect(messages.join("\n")).toContain("command not found");
	});

	it("rejects malformed PM2 output", () => {
		expect(
			parsePm2Processes({
				status: 0,
				stdout: "not-json",
				stderr: "",
			}),
		).toMatchObject({ ok: false });
	});
});
