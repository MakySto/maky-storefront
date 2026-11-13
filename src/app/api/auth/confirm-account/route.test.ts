import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeRawGraphQL = vi.fn();

vi.mock("@/lib/graphql", () => ({
	executeRawGraphQL: (...args: unknown[]) => executeRawGraphQL(...args),
	getUserMessage: () => "Something went wrong",
}));

vi.mock("@/lib/auth/auth-rate-limit", () => ({
	rejectIfRateLimited: () => null,
}));

const { POST } = await import("./route");

const post = (body: unknown) =>
	POST(
		new NextRequest("https://maky.store/api/auth/confirm-account", {
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);

describe("POST /api/auth/confirm-account", () => {
	beforeEach(() => executeRawGraphQL.mockReset());

	it("confirms the account with Saleor's confirmAccount and the link's email + token", async () => {
		executeRawGraphQL.mockResolvedValue({
			ok: true,
			data: { confirmAccount: { user: { isConfirmed: true }, errors: [] } },
		});

		const response = await post({ email: "a@b.sk", token: "t-1" });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		const [{ query, variables }] = executeRawGraphQL.mock.calls[0] as [{ query: string; variables: unknown }];
		expect(query).toContain("confirmAccount(email: $email, token: $token)");
		expect(variables).toEqual({ email: "a@b.sk", token: "t-1" });
	});

	it("passes Saleor's error code on, for a used or expired link", async () => {
		executeRawGraphQL.mockResolvedValue({
			ok: true,
			data: {
				confirmAccount: {
					user: null,
					errors: [{ field: "token", message: "Invalid token", code: "INVALID" }],
				},
			},
		});

		const response = await post({ email: "a@b.sk", token: "old" });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ errors: [{ message: "Invalid token", code: "INVALID" }] });
	});

	it("rejects a request without email or token before asking Saleor", async () => {
		const response = await post({ email: "a@b.sk" });

		expect(response.status).toBe(400);
		expect(executeRawGraphQL).not.toHaveBeenCalled();
	});

	it("never reports success when Saleor returns no confirmed user", async () => {
		executeRawGraphQL.mockResolvedValue({ ok: true, data: { confirmAccount: { user: null, errors: [] } } });

		const response = await post({ email: "a@b.sk", token: "t" });

		expect(response.status).toBe(400);
	});
});
