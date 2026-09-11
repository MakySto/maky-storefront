import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	SALEOR_WRITES_ENV,
	setDeployedArtifactOverride,
	resetDeployedArtifactProbe,
} from "@/lib/saleor/write-policy";

/**
 * `@saleor/auth-sdk` builds its own requests on `globalThis.fetch`, so the guard in
 * `executeGraphQL` never sees `tokenCreate` or `setPassword`. Without the check in
 * `bff-server.ts` a development session pointed at production could change a real
 * customer's password.
 *
 * The auth client is mocked, and the assertion is that it is never CONSTRUCTED —
 * if the refusal happens after `getServerAuthClient()`, the SDK has already been
 * handed the production URL.
 */
const signIn = vi.fn();
const resetPassword = vi.fn();
const getServerAuthClient = vi.fn(async () => ({ signIn, resetPassword }));

vi.mock("./server", () => ({ getServerAuthClient: () => getServerAuthClient() }));

const PROD = "https://api.maky.store/graphql/";
const SANDBOX = "https://api.example.test/graphql/";
const ORIGINAL_URL = process.env.NEXT_PUBLIC_SALEOR_API_URL;
const ORIGINAL_SETTING = process.env[SALEOR_WRITES_ENV];

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env[SALEOR_WRITES_ENV];
	setDeployedArtifactOverride(false);
});

afterEach(() => {
	if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
	else process.env.NEXT_PUBLIC_SALEOR_API_URL = ORIGINAL_URL;
	if (ORIGINAL_SETTING === undefined) delete process.env[SALEOR_WRITES_ENV];
	else process.env[SALEOR_WRITES_ENV] = ORIGINAL_SETTING;
	resetDeployedArtifactProbe();
});

describe("account mutations honour the write policy", () => {
	it("refuses sign-in against production, without building the auth client", async () => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		const { signInWithPassword } = await import("./bff-server");

		const result = await signInWithPassword("someone@example.invalid", "pw");

		expect(result.ok).toBe(false);
		expect(getServerAuthClient).not.toHaveBeenCalled();
		expect(signIn).not.toHaveBeenCalled();
	});

	it("refuses a password reset against production — the one that changes real data", async () => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		const { resetPasswordWithToken } = await import("./bff-server");

		const result = await resetPasswordWithToken("someone@example.invalid", "tok", "pw");

		expect(result.ok).toBe(false);
		expect(getServerAuthClient).not.toHaveBeenCalled();
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it("allows sign-in against a non-production endpoint", async () => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = SANDBOX;
		signIn.mockResolvedValue({ data: { tokenCreate: { token: "t", errors: [] } } });
		const { signInWithPassword } = await import("./bff-server");

		const result = await signInWithPassword("someone@example.invalid", "pw");

		expect(result.ok).toBe(true);
		expect(signIn).toHaveBeenCalledTimes(1);
	});

	it("allows sign-in on a deployed production artifact", async () => {
		process.env.NEXT_PUBLIC_SALEOR_API_URL = PROD;
		setDeployedArtifactOverride(true);
		signIn.mockResolvedValue({ data: { tokenCreate: { token: "t", errors: [] } } });
		const { signInWithPassword } = await import("./bff-server");

		const result = await signInWithPassword("someone@example.invalid", "pw");

		expect(result.ok).toBe(true);
		expect(signIn).toHaveBeenCalledTimes(1);
	});
});
