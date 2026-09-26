import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageCodeEnum } from "@/gql/graphql";

import { CheckoutFindDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "./graphql";

/**
 * A deadline is only real if it can end a request that never answers.
 *
 * The read-back budget used to be a `Date.now()` check performed AFTER the read
 * returned, so a stuck fetch meant the check was never reached. Worse, the
 * authenticated path handed `RequestInit` straight to the auth SDK without a
 * signal, so the transport's own 15 s ceiling did not apply to it either.
 *
 * These assert the property that matters — nothing goes out, or stays out,
 * past the caller's deadline — against a fetch that behaves badly on purpose.
 */
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example.test/graphql/";
	fetchMock = vi.fn();
	globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/** A fetch that never settles unless its signal aborts. */
const neverAnswers = () =>
	vi.fn(
		(_url: string, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
					once: true,
				});
			}),
	);

const find = (signal: AbortSignal) =>
	executePublicGraphQL(CheckoutFindDocument, {
		variables: { id: "Q2hlY2tvdXQ6MQ==", languageCode: LanguageCodeEnum.Sk },
		cache: "no-cache",
		retry: false,
		signal,
	});

describe("a caller deadline reaches the wire", () => {
	it("ends a request that would otherwise never answer", async () => {
		fetchMock = neverAnswers();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const deadline = AbortSignal.timeout(120);
		const started = Date.now();
		const result = await find(deadline);

		expect(result.ok).toBe(false);
		// Generously bounded: the point is that it returns at all, and near the
		// deadline rather than at the transport's own 15 s ceiling.
		expect(Date.now() - started).toBeLessThan(3_000);
	});

	it("forwards the signal to fetch rather than dropping it", async () => {
		// The whole defect on the authenticated path was a signal that never
		// reached `fetch`. Compose, do not discard.
		fetchMock = neverAnswers();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await find(AbortSignal.timeout(80));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("does not put a request on the wire at all once the deadline has passed", async () => {
		fetchMock = vi.fn(async () => json({ data: { checkout: null } }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const already = new AbortController();
		already.abort();

		const result = await find(already.signal);

		expect(result.ok).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not retry a query once the deadline has passed", async () => {
		// Queries normally keep three attempts with exponential backoff. Retrying
		// after the caller stopped waiting spends the budget on an answer nobody
		// will read — and can outlive the deadline several times over.
		fetchMock = neverAnswers();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await executePublicGraphQL(CheckoutFindDocument, {
			variables: { id: "Q2hlY2tvdXQ6MQ==", languageCode: LanguageCodeEnum.Sk },
			cache: "no-cache",
			signal: AbortSignal.timeout(80),
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("ends a response whose body never arrives", async () => {
		// Headers can arrive promptly and the stream then stall. The body read sits
		// outside `fetchWithRetry`, so it used to be covered by no timeout at all.
		fetchMock = vi.fn(
			async () =>
				({
					ok: true,
					status: 200,
					statusText: "OK",
					json: () => new Promise(() => {}),
					text: async () => "",
					headers: new Headers(),
				}) as unknown as Response,
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const started = Date.now();
		const result = await find(AbortSignal.timeout(120));

		expect(result.ok).toBe(false);
		expect(Date.now() - started).toBeLessThan(3_000);
	});

	it("still works normally when no deadline is given", async () => {
		fetchMock = vi.fn(async () => json({ data: { checkout: null } }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await executePublicGraphQL(CheckoutFindDocument, {
			variables: { id: "Q2hlY2tvdXQ6MQ==", languageCode: LanguageCodeEnum.Sk },
			cache: "no-cache",
		});

		expect(result.ok).toBe(true);
	});
});

describe("a caller deadline also ends the wait for a queue slot", () => {
	// With every slot held by a slow Saleor, a query with a 1.5 s deadline used to sit in the
	// queue for as long as the slow ones took — a Googlebot request for a product page took
	// 43.8 s that way (2026-09-25). A caller who has given up must leave the queue at once.
	it("returns at its deadline while every slot is held, and never reaches the wire", async () => {
		fetchMock = neverAnswers();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const holders = Array.from({ length: 12 }, () => new AbortController());
		const held = holders.map((holder) => find(holder.signal));
		// Let the twelve take their slots.
		await new Promise((resolve) => setTimeout(resolve, 20));
		const onWire = fetchMock.mock.calls.length;

		const started = Date.now();
		const result = await find(AbortSignal.timeout(100));

		expect(result.ok).toBe(false);
		expect(Date.now() - started).toBeLessThan(2_000);
		expect(fetchMock.mock.calls.length, "the queued query must not go out after its deadline").toBe(onWire);

		for (const holder of holders) holder.abort();
		await Promise.all(held);
	});

	it("still admits a queued caller without a deadline once a slot frees", async () => {
		fetchMock = neverAnswers();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const holders = Array.from({ length: 12 }, () => new AbortController());
		const held = holders.map((holder) => find(holder.signal));
		await new Promise((resolve) => setTimeout(resolve, 20));

		const late = new AbortController();
		const waiting = find(late.signal);
		holders[0]!.abort();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(fetchMock.mock.calls.length, "the waiting query takes the freed slot").toBe(13);

		late.abort();
		for (const holder of holders) holder.abort();
		await Promise.all([...held, waiting]);
	});
});
