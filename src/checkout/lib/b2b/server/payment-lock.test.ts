import { describe, expect, it, vi } from "vitest";

import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import type { MakyB2bCheckoutStateQuery, MakyB2bReleasePaymentLockMutation } from "../graphql";
import type { B2bAppResult } from "./b2b-saleor-client";
import { readB2bPaymentLock, releaseB2bPaymentLock, type PaymentLockDeps } from "./payment-lock";

/**
 * The server half of "Zmeniť údaje" (contract revision 2, §5): the gates every write with the B2B app's token
 * passes, one release call, and the backend's answer passed on as status + boolean + code.
 */

const ID = "Q2hlY2tvdXQ6MTIzNDU2Nzg=";
const OTHER = "Q2hlY2tvdXQ6OTk5OTk5OTk=";
const INPUT = '{"schema":1,"isBusiness":true,"registrationId":"","taxId":"","vatId":"DE123456789"}';

const checkout = (b2bInput: string | null = INPUT) =>
	({ id: ID, channel: { slug: "de-eur" }, b2bInput }) as unknown as ServerCheckout;

const answer = (
	payload: MakyB2bReleasePaymentLockMutation["checkoutB2bPaymentLockRelease"],
): B2bAppResult<MakyB2bReleasePaymentLockMutation> => ({
	ok: true,
	data: { checkoutB2bPaymentLockRelease: payload },
});

const released = (status: string, paymentLocked: boolean | null) =>
	answer({
		status: status as never,
		errors: [],
		checkout:
			paymentLocked === null
				? null
				: { id: ID, b2bTaxState: { contextVersion: "v2", decision: "EXEMPT", paymentLocked } },
	});

function deps(overrides: Partial<PaymentLockDeps> = {}) {
	const release = vi.fn<PaymentLockDeps["release"]>(async () => released("RELEASED", false));
	const log = vi.fn<(cause: string) => void>();
	const all: PaymentLockDeps = {
		readCheckout: async () => ({ ok: true, checkout: checkout() }),
		cookieCheckoutId: async () => ID,
		uiEnabled: () => true,
		readiness: async () => ({ ok: true }),
		release,
		readState: async () => ({ ok: false, error: { kind: "network", message: "unused" } }),
		log,
		...overrides,
	};
	return { all, release: (overrides.release as typeof release | undefined) ?? release, log };
}

describe("releaseB2bPaymentLock", () => {
	it.each([
		["RELEASED", false],
		["CANCELATION_REQUESTED", true],
		["ATTEMPT_BEING_CREATED", true],
		["PAYMENT_HAS_FUNDS", true],
	] as const)(
		"passes %s on as it is, with what the same answer says about the lock",
		async (status, locked) => {
			const { all, release, log } = deps({ release: vi.fn(async () => released(status, locked)) });
			expect(await releaseB2bPaymentLock(ID, all)).toEqual({
				kind: "release",
				status,
				paymentLocked: locked,
				cause: `release-${status}`,
			});
			expect(release).toHaveBeenCalledWith(ID);
			expect(log).toHaveBeenCalledWith(`release-${status}`);
		},
	);

	it("an answer without the checkout says nothing about the lock (null), never `false`", async () => {
		const { all } = deps({ release: vi.fn(async () => released("RELEASED", null)) });
		expect(await releaseB2bPaymentLock(ID, all)).toMatchObject({ status: "RELEASED", paymentLocked: null });
	});

	it("with the B2B checkout switched off nothing is sent with the token", async () => {
		const { all, release } = deps({ uiEnabled: () => false });
		expect(await releaseB2bPaymentLock(ID, all)).toEqual({ kind: "unavailable", cause: "ui-disabled" });
		expect(release).not.toHaveBeenCalled();
	});

	it("a browser whose cookie holds another checkout cannot release this one", async () => {
		const { all, release } = deps({ cookieCheckoutId: async () => OTHER });
		expect(await releaseB2bPaymentLock(ID, all)).toEqual({
			kind: "unavailable",
			cause: "checkout-access-denied",
		});
		expect(release).not.toHaveBeenCalled();
	});

	it("a checkout without the company input is never locked against a change: nothing to release", async () => {
		const { all, release } = deps({ readCheckout: async () => ({ ok: true, checkout: checkout(null) }) });
		expect(await releaseB2bPaymentLock(ID, all)).toEqual({ kind: "unavailable", cause: "no-input" });
		expect(release).not.toHaveBeenCalled();
	});

	it("a process whose B2B app access is not ready (e.g. token-missing) sends nothing", async () => {
		const { all, release } = deps({ readiness: async () => ({ ok: false }) });
		expect(await releaseB2bPaymentLock(ID, all)).toEqual({ kind: "unavailable", cause: "not-ready" });
		expect(release).not.toHaveBeenCalled();
	});

	it("a checkout that cannot be read, or does not exist, is a failure, not a guess", async () => {
		expect(await releaseB2bPaymentLock(ID, deps({ readCheckout: async () => ({ ok: false }) }).all)).toEqual({
			kind: "failed",
			cause: "checkout-read-failed",
		});
		expect(
			await releaseB2bPaymentLock(ID, deps({ readCheckout: async () => ({ ok: true, checkout: null }) }).all),
		).toEqual({ kind: "failed", cause: "checkout-not-found" });
	});

	it.each(["NOT_FOUND", "GRAPHQL_ERROR"])(
		"the backend's %s is a failure with its code, never its message",
		async (code) => {
			const { all } = deps({
				release: vi.fn(async () =>
					answer({
						status: null,
						errors: [{ field: "id", code, message: "Checkout not found." }],
						checkout: null,
					}),
				),
			});
			expect(await releaseB2bPaymentLock(ID, all)).toEqual({
				kind: "failed",
				cause: `release-error-${code}`,
			});
		},
	);

	it("an app without both permissions (GraphQL PermissionDenied), a network error, a missing payload or status", async () => {
		const graphqlError = deps({
			release: vi.fn(async () => ({
				ok: false as const,
				error: { kind: "graphql" as const, message: "You do not have permission to perform this action" },
			})),
		});
		expect(await releaseB2bPaymentLock(ID, graphqlError.all)).toEqual({
			kind: "failed",
			cause: "release-graphql",
		});
		const network = deps({
			release: vi.fn(async () => ({
				ok: false as const,
				error: { kind: "network" as const, message: "reset" },
			})),
		});
		expect(await releaseB2bPaymentLock(ID, network.all)).toEqual({
			kind: "failed",
			cause: "release-network",
		});
		expect(await releaseB2bPaymentLock(ID, deps({ release: vi.fn(async () => answer(null)) }).all)).toEqual({
			kind: "failed",
			cause: "release-no-payload",
		});
		expect(
			await releaseB2bPaymentLock(
				ID,
				deps({
					release: vi.fn(async () =>
						answer({ status: "SOMETHING_NEW" as never, errors: [], checkout: null }),
					),
				}).all,
			),
		).toEqual({ kind: "failed", cause: "release-no-status" });
	});

	it("nothing that leaves the function carries the checkout id or a Saleor message", async () => {
		const { all, log } = deps({
			release: vi.fn(async () =>
				answer({
					status: null,
					errors: [{ field: "id", code: "NOT_FOUND", message: `secret ${ID}` }],
					checkout: null,
				}),
			),
		});
		const result = await releaseB2bPaymentLock(ID, all);
		expect(JSON.stringify(result)).not.toContain(ID);
		expect(JSON.stringify(result)).not.toContain("secret");
		expect(JSON.stringify(log.mock.calls)).not.toContain(ID);
	});
});

describe("readB2bPaymentLock", () => {
	const state = (paymentLocked: boolean | null): B2bAppResult<MakyB2bCheckoutStateQuery> => ({
		ok: true,
		data: {
			checkout: {
				id: ID,
				b2bTaxState:
					paymentLocked === null
						? null
						: {
								contextVersion: "v2",
								decision: "EXEMPT",
								effectiveTaxExemption: true,
								checkedAt: null,
								expiresAt: null,
								paymentLocked,
							},
				totalPrice: null,
			},
		},
	});

	it("says whether the lock is still there, from the public state", async () => {
		expect(
			await readB2bPaymentLock(ID, { uiEnabled: () => true, readState: async () => state(false) }),
		).toEqual({
			kind: "state",
			paymentLocked: false,
			cause: "unlocked",
		});
		expect(
			await readB2bPaymentLock(ID, { uiEnabled: () => true, readState: async () => state(true) }),
		).toEqual({
			kind: "state",
			paymentLocked: true,
			cause: "still-locked",
		});
	});

	it("no state, no checkout or no answer is a failure: never read as unlocked", async () => {
		expect(
			await readB2bPaymentLock(ID, { uiEnabled: () => true, readState: async () => state(null) }),
		).toEqual({
			kind: "failed",
			cause: "state-missing",
		});
		expect(
			await readB2bPaymentLock(ID, {
				uiEnabled: () => true,
				readState: async () => ({ ok: true, data: { checkout: null } }),
			}),
		).toEqual({ kind: "failed", cause: "checkout-not-found" });
		expect(
			await readB2bPaymentLock(ID, {
				uiEnabled: () => true,
				readState: async () => ({ ok: false, error: { kind: "network", message: "reset" } }),
			}),
		).toEqual({ kind: "failed", cause: "state-read-network" });
	});

	it("with the B2B checkout switched off it reads nothing", async () => {
		const readState = vi.fn();
		expect(await readB2bPaymentLock(ID, { uiEnabled: () => false, readState })).toEqual({
			kind: "unavailable",
			cause: "ui-disabled",
		});
		expect(readState).not.toHaveBeenCalled();
	});
});
