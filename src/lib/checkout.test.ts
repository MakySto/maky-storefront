import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeAuthenticatedGraphQL, cookies } = vi.hoisted(() => ({
	executeAuthenticatedGraphQL: vi.fn(),
	cookies: vi.fn(),
}));

vi.mock("@/lib/graphql", () => ({ executeAuthenticatedGraphQL }));
vi.mock("next/headers", () => ({ cookies }));

import { findOrCreate, lookup } from "./checkout";

const CHECKOUT = { id: "Q2hlY2tvdXQ6MQ==", lines: [], totalPrice: {} };

/** A transport failure, as `executeAuthenticatedGraphQL` reports one. */
const transportFailure = (message: string) => ({
	ok: false as const,
	error: { type: "network", message, isRetryable: true },
});

beforeEach(() => {
	vi.clearAllMocks();
	cookies.mockResolvedValue({ get: () => undefined, set: vi.fn(), delete: vi.fn(), getAll: () => [] });
});

/**
 * `null` used to mean both "Saleor says this checkout is gone" and "we could not
 * ask", and `findOrCreate` acted on the second as though it were the first.
 */
describe("lookup", () => {
	it("reports found when Saleor returns the checkout", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({ ok: true, data: { checkout: CHECKOUT } });

		await expect(lookup("Q2hlY2tvdXQ6MQ==")).resolves.toEqual({ status: "found", checkout: CHECKOUT });
	});

	it("reports not-found only when Saleor actually answered", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({ ok: true, data: { checkout: null } });

		await expect(lookup("Q2hlY2tvdXQ6MQ==")).resolves.toEqual({ status: "not-found" });
	});

	it("reports upstream-error for a transport failure — never not-found", async () => {
		// The whole distinction. A timeout is not evidence about the checkout.
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure("Request timed out"));

		await expect(lookup("Q2hlY2tvdXQ6MQ==")).resolves.toEqual({
			status: "upstream-error",
			reason: "Request timed out",
		});
	});

	it("treats an empty id as nothing to find, not as an outage", async () => {
		await expect(lookup("")).resolves.toEqual({ status: "not-found" });
		expect(executeAuthenticatedGraphQL).not.toHaveBeenCalled();
	});
});

describe("findOrCreate", () => {
	it("returns the existing checkout without creating anything", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({ ok: true, data: { checkout: CHECKOUT } });

		await expect(findOrCreate({ channel: "sk-eur", checkoutId: CHECKOUT.id })).resolves.toEqual({
			status: "ready",
			checkout: CHECKOUT,
			created: false,
		});
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});

	it("NEVER creates a replacement when the lookup failed upstream", async () => {
		// The defect. One `checkoutCreate` here means the shopper's basket has just
		// been replaced by an empty one because Saleor was briefly unreachable.
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure("Request timed out"));

		await expect(findOrCreate({ channel: "sk-eur", checkoutId: CHECKOUT.id })).resolves.toEqual({
			status: "unavailable",
			reason: "Request timed out",
		});
		// Exactly one call: the lookup. No create followed it.
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});

	it("creates exactly one replacement for a CONFIRMED not-found", async () => {
		executeAuthenticatedGraphQL
			.mockResolvedValueOnce({ ok: true, data: { checkout: null } })
			.mockResolvedValueOnce({ ok: true, data: { checkoutCreate: { checkout: CHECKOUT } } });

		await expect(findOrCreate({ channel: "sk-eur", checkoutId: "stale" })).resolves.toEqual({
			status: "ready",
			checkout: CHECKOUT,
			created: true,
		});
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(2);
	});

	it("creates a first checkout when there is no cookie at all", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({
			ok: true,
			data: { checkoutCreate: { checkout: CHECKOUT } },
		});

		const result = await findOrCreate({ channel: "sk-eur" });

		expect(result).toMatchObject({ status: "ready", created: true });
		expect(executeAuthenticatedGraphQL).toHaveBeenCalledTimes(1);
	});

	it("reports unavailable rather than ready when the create itself fails", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue(transportFailure("socket hang up"));

		await expect(findOrCreate({ channel: "sk-eur" })).resolves.toEqual({
			status: "unavailable",
			reason: "socket hang up",
		});
	});

	it("does not call a create that answered without a checkout a success", async () => {
		executeAuthenticatedGraphQL.mockResolvedValue({ ok: true, data: { checkoutCreate: { checkout: null } } });

		expect((await findOrCreate({ channel: "sk-eur" })).status).toBe("unavailable");
	});
});
