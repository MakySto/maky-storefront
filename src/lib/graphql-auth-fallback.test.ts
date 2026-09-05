import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuthClient } = vi.hoisted(() => ({ getServerAuthClient: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getServerAuthClient }));

import { CheckoutAddLineDocument } from "@/gql/graphql";
import { executeAuthenticatedGraphQL } from "./graphql";

/**
 * The authenticated path had its own duplicate-send, separate from the wire
 * retries and from the auth SDK.
 *
 * The fallback to an unauthenticated fetch is there for prerendering, where
 * `cookies()` throws before any request exists. But the try wrapped the
 * `fetchWithAuth` CALL as well, so a rejection from the request itself whose
 * message merely mentioned "cookies" was answered by re-sending the identical
 * body. For `checkoutLinesAdd`, which is not idempotent, that is a second line
 * in the customer's basket — produced by the one file written to prevent it.
 */
const json = (body: unknown) =>
	new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

const addLine = () =>
	executeAuthenticatedGraphQL(CheckoutAddLineDocument, {
		variables: { id: "Q2hlY2tvdXQ6MQ==", productVariantId: "UHJvZHVjdFZhcmlhbnQ6MQ==", quantity: 1 },
		cache: "no-cache",
	});

beforeEach(() => {
	vi.clearAllMocks();
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
	fetchMock = vi.fn(async () => json({ data: { checkoutLinesAdd: { checkout: { id: "c" }, errors: [] } } }));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("the authenticated fallback belongs to getting the client, not to the request", () => {
	it("NEVER re-sends a mutation because the request failed mentioning cookies", async () => {
		// The exact shape of the defect: the client is obtained fine, and the
		// REQUEST rejects with a message containing "cookies".
		const fetchWithAuth = vi.fn(async () => {
			throw new Error("failed to read cookies from the upstream connection");
		});
		getServerAuthClient.mockResolvedValue({ fetchWithAuth });

		const result = await addLine();

		expect(result.ok).toBe(false);
		// One attempt at the request, and no unauthenticated repeat of it.
		expect(fetchWithAuth).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("still falls back when the CLIENT cannot be obtained — nothing was sent yet", async () => {
		// Prerendering: `cookies()` throws before any request is built, so an
		// unauthenticated fetch is safe and is the point of the fallback.
		getServerAuthClient.mockRejectedValue(
			Object.assign(new Error("Dynamic server usage: cookies"), { digest: "DYNAMIC_SERVER_USAGE" }),
		);

		const result = await addLine();

		expect(result.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("propagates a client failure that is not a dynamic-server error", async () => {
		getServerAuthClient.mockRejectedValue(new Error("missing refresh token"));

		const result = await addLine();

		expect(result.ok).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sends an authenticated mutation exactly once on the happy path", async () => {
		const fetchWithAuth = vi.fn(async () =>
			json({ data: { checkoutLinesAdd: { checkout: { id: "c" }, errors: [] } } }),
		);
		getServerAuthClient.mockResolvedValue({ fetchWithAuth });

		const result = await addLine();

		expect(result.ok).toBe(true);
		expect(fetchWithAuth).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
