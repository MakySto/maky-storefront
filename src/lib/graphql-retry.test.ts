import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CheckoutAddLineDocument, ProductDetailsDocument, LanguageCodeEnum } from "@/gql/graphql";
import { executePublicGraphQL } from "./graphql";

/**
 * Retries are counted at the WIRE, not at the helper.
 *
 * One call to `executeAuthenticatedGraphQL` never proved one HTTP request:
 * `fetchWithRetry` sits underneath and, with the default budget of three
 * retries, replays on a 5xx, a 429 and — the dangerous one — a timeout, which is
 * precisely the case where the request most likely DID reach Saleor.
 *
 * `checkoutLinesAdd` is not idempotent. Verified against live Saleor on
 * 2026-09-05: the same call three times on one checkout took a line from
 * quantity 1 to 2 to 3. So a replay is not a repeated question, it is a repeated
 * purchase — four of an item from one click.
 */
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
	fetchMock = vi.fn();
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	vi.useRealTimers();
	globalThis.fetch = originalFetch;
});

/** Run a request while letting the retry backoff timers fire. */
async function run(promise: Promise<unknown>) {
	await vi.runAllTimersAsync();
	return promise;
}

describe("a mutation is put on the wire exactly once", () => {
	it("does not replay checkoutLinesAdd after a 500", async () => {
		fetchMock.mockResolvedValue(json({ errors: [{ message: "boom" }] }, 500));

		await run(
			executePublicGraphQL(CheckoutAddLineDocument, {
				variables: { id: "c1", productVariantId: "v1", quantity: 1 },
			}),
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not replay checkoutLinesAdd after a timeout", async () => {
		// The case that duplicates a line: the request very likely arrived.
		const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
		fetchMock.mockRejectedValue(abort);

		await run(
			executePublicGraphQL(CheckoutAddLineDocument, {
				variables: { id: "c1", productVariantId: "v1", quantity: 1 },
			}),
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not replay checkoutLinesAdd after a 429", async () => {
		fetchMock.mockResolvedValue(json({ errors: [{ message: "slow down" }] }, 429));

		await run(
			executePublicGraphQL(CheckoutAddLineDocument, {
				variables: { id: "c1", productVariantId: "v1", quantity: 1 },
			}),
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("a read-only query still retries", () => {
	it("replays a product query after a 500", async () => {
		// Asking twice cannot change anything, so resilience is free here and the
		// mutation fix must not have taken it away.
		fetchMock.mockResolvedValue(json({ errors: [{ message: "boom" }] }, 500));

		await run(
			executePublicGraphQL(ProductDetailsDocument, {
				variables: { slug: "x", channel: "sk-eur", lang: LanguageCodeEnum.Sk, slugLang: null },
			}),
		);

		expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
	});

	it("succeeds on a retry after one transient failure", async () => {
		fetchMock
			.mockResolvedValueOnce(json({ errors: [{ message: "boom" }] }, 503))
			.mockResolvedValue(json({ data: { product: { id: "p1" } } }));

		const result = (await run(
			executePublicGraphQL(ProductDetailsDocument, {
				variables: { slug: "x", channel: "sk-eur", lang: LanguageCodeEnum.Sk, slugLang: null },
			}),
		)) as { ok: boolean };

		expect(result.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe("an explicit opt-in is still possible", () => {
	it("retries a mutation when the caller asks for it", async () => {
		fetchMock.mockResolvedValue(json({ errors: [{ message: "boom" }] }, 500));

		await run(
			executePublicGraphQL(CheckoutAddLineDocument, {
				variables: { id: "c1", productVariantId: "v1", quantity: 1 },
				retry: true,
			}),
		);

		expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
	});
});
