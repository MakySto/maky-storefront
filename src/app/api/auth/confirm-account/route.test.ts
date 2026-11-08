import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRawGraphQL } = vi.hoisted(() => ({ executeRawGraphQL: vi.fn() }));

vi.mock("@/lib/graphql", () => ({
	executeRawGraphQL,
	getUserMessage: () => "Something went wrong",
}));
vi.mock("@/lib/auth/auth-rate-limit", () => ({ rejectIfRateLimited: () => null }));

const { POST } = await import("./route");

type Body = { success?: boolean; errors?: Array<{ code: string | null; message: string }> };

function post(body: unknown) {
	return POST(
		new NextRequest("https://maky.store/api/auth/confirm-account", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

describe("POST /api/auth/confirm-account", () => {
	beforeEach(() => executeRawGraphQL.mockReset());

	it("calls Saleor confirmAccount with the e-mail and token from the link", async () => {
		executeRawGraphQL.mockResolvedValue({
			ok: true,
			data: { confirmAccount: { user: { isActive: true, isConfirmed: true }, errors: [] } },
		});

		const response = await post({ email: "jana@example.com", token: "abc-123" });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		const call = executeRawGraphQL.mock.calls[0][0];
		expect(call.query).toContain("confirmAccount(email: $email, token: $token)");
		expect(call.variables).toEqual({ email: "jana@example.com", token: "abc-123" });
	});

	it("passes a rejected token back by code, never with Saleor's message", async () => {
		executeRawGraphQL.mockResolvedValue({
			ok: true,
			data: {
				confirmAccount: {
					user: null,
					errors: [{ field: "token", message: "Invalid or expired token.", code: "INVALID" }],
				},
			},
		});

		const response = await post({ email: "jana@example.com", token: "used" });

		expect(response.status).toBe(400);
		const body = (await response.json()) as Body;
		expect(body.errors?.[0].code).toBe("INVALID");
		expect(JSON.stringify(body)).not.toContain("expired token");
	});

	it("refuses a link without e-mail or token before asking Saleor", async () => {
		const response = await post({ email: "jana@example.com" });

		expect(response.status).toBe(400);
		expect(((await response.json()) as Body).errors?.[0].code).toBe("REQUIRED");
		expect(executeRawGraphQL).not.toHaveBeenCalled();
	});

	it("does not report success unless Saleor says the user is confirmed", async () => {
		executeRawGraphQL.mockResolvedValue({ ok: true, data: { confirmAccount: { user: null, errors: [] } } });

		const response = await post({ email: "jana@example.com", token: "abc" });

		expect(response.status).toBe(400);
	});
});
