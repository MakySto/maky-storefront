import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuthClient } = vi.hoisted(() => ({ getServerAuthClient: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getServerAuthClient }));

import { CurrentUserDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "./graphql";

/**
 * A signed-in customer's request has the same per-attempt ceiling as everyone else's.
 *
 * Until 2026-09-26 the authenticated path handed the request to the auth SDK with only the
 * caller's deadline, and most callers set none — the account pages among them — so a stalled
 * Saleor could hold a signed-in render indefinitely.
 */
beforeEach(() => {
	vi.clearAllMocks();
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
	process.env.SALEOR_REQUEST_TIMEOUT_MS = "200";
});

afterEach(() => {
	delete process.env.SALEOR_REQUEST_TIMEOUT_MS;
});

describe("the authenticated transport", () => {
	it("ends a request Saleor never answers, without a caller deadline", async () => {
		const fetchWithAuth = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
						once: true,
					});
				}),
		);
		getServerAuthClient.mockResolvedValue({ fetchWithAuth });

		const started = Date.now();
		const result = await executeAuthenticatedGraphQL(CurrentUserDocument, {
			cache: "no-cache",
			retry: false,
		});

		expect(result.ok).toBe(false);
		expect(fetchWithAuth).toHaveBeenCalledTimes(1);
		expect(Date.now() - started).toBeLessThan(2_000);
	});
});
