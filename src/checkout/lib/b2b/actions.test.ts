import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** MOCKS: the public Saleor transport and evaluateB2B's production deps are replaced; nothing leaves the process. */

const executePublicGraphQL = vi.fn();
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: (...args: unknown[]) => executePublicGraphQL(...args),
}));
const paymentLockDeps = vi.fn();
vi.mock("./server/evaluate-b2b-deps", () => ({
	productionEvaluateB2bDeps: () => ({}),
	productionPaymentLockDeps: (...args: unknown[]) => paymentLockDeps(...args),
}));
const evaluateB2b = vi.fn();
vi.mock("./server/evaluate-b2b", () => ({ evaluateB2b: (...args: unknown[]) => evaluateB2b(...args) }));

const { saveB2bInputAction, evaluateB2bAction, releaseB2bPaymentLockAction, readB2bPaymentLockAction } =
	await import("./actions");
const { resetB2bActionGate } = await import("./server/action-gate");

const ID = "Q2hlY2tvdXQ6MTIzNDU2Nzg=";
const company = { schema: 1, isBusiness: true, registrationId: "", taxId: "", vatId: "DE123456789" };
let savedFlag: string | undefined;

/** What `productionPaymentLockDeps` would hand over: a checkout this browser holds, a ready process, a backend answer. */
const release = vi.fn();
const readState = vi.fn();
function lockDeps() {
	return {
		readCheckout: async () => ({
			ok: true,
			checkout: { id: ID, channel: { slug: "de-eur" }, b2bInput: JSON.stringify(company) },
		}),
		cookieCheckoutId: async () => ID,
		uiEnabled: () => process.env.B2B_CHECKOUT_UI_ENABLED === "true",
		readiness: async () => ({ ok: true }),
		release,
		readState,
	};
}

beforeEach(() => {
	savedFlag = process.env.B2B_CHECKOUT_UI_ENABLED;
	process.env.B2B_CHECKOUT_UI_ENABLED = "true";
	executePublicGraphQL.mockReset();
	executePublicGraphQL.mockResolvedValue({ ok: true, data: { updateMetadata: { errors: [] } } });
	evaluateB2b.mockReset();
	paymentLockDeps.mockReset();
	paymentLockDeps.mockImplementation(() => lockDeps());
	resetB2bActionGate();
});

afterEach(() => {
	if (savedFlag === undefined) delete process.env.B2B_CHECKOUT_UI_ENABLED;
	else process.env.B2B_CHECKOUT_UI_ENABLED = savedFlag;
});

describe("saveB2bInputAction", () => {
	it("stores the canonical v1 value in the public metafield", async () => {
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({ ok: true });
		const [, options] = executePublicGraphQL.mock.calls[0]!;
		expect(options.variables).toEqual({
			checkoutId: ID,
			input: [
				{
					key: "maky.b2b.input.v1",
					value: '{"schema":1,"isBusiness":true,"registrationId":"","taxId":"","vatId":"DE123456789"}',
				},
			],
		});
	});

	it("leaving the company purchase stores isBusiness false and drops the numbers", async () => {
		await saveB2bInputAction({ checkoutId: ID, input: { ...company, isBusiness: false } });
		const [, options] = executePublicGraphQL.mock.calls[0]!;
		expect(JSON.parse(options.variables.input[0].value)).toEqual({
			schema: 1,
			isBusiness: false,
			registrationId: "",
			taxId: "",
			vatId: "",
		});
	});

	it("refuses what the form would not have sent", async () => {
		for (const input of [
			null,
			"string",
			{ ...company, vatId: "de 123 456 789" },
			{ ...company, vatId: "DE12" },
			{ ...company, isBusiness: "true" },
			{ ...company, registrationId: "x".repeat(40) },
		]) {
			expect(await saveB2bInputAction({ checkoutId: ID, input })).toEqual({ ok: false, code: "INVALID" });
		}
		expect(await saveB2bInputAction({ checkoutId: "bad id", input: company })).toEqual({
			ok: false,
			code: "INVALID",
		});
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("does nothing while the UI is off", async () => {
		process.env.B2B_CHECKOUT_UI_ENABLED = "false";
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({
			ok: false,
			code: "DISABLED",
		});
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});

	it("maps the backend's lock and context codes", async () => {
		executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: { updateMetadata: { errors: [{ code: "B2B_CHECKOUT_LOCKED", field: null, message: null }] } },
		});
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({
			ok: false,
			code: "CHECKOUT_LOCKED",
		});
		executePublicGraphQL.mockResolvedValue({
			ok: true,
			data: { updateMetadata: { errors: [{ code: "B2B_TAX_CONTEXT_CHANGED", field: null, message: null }] } },
		});
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({
			ok: false,
			code: "CONTEXT_CHANGED",
		});
		executePublicGraphQL.mockResolvedValue({ ok: false, error: { type: "network", message: "x" } });
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({
			ok: false,
			code: "FAILED",
		});
	});

	it("rate-limits one checkout", async () => {
		let last;
		for (let i = 0; i < 41; i++) last = await saveB2bInputAction({ checkoutId: ID, input: company });
		expect(last).toEqual({ ok: false, code: "RATE_LIMITED" });
	});
});

describe("evaluateB2bAction", () => {
	it("passes only the checkout id and a known mode; the browser sends nothing else", async () => {
		evaluateB2b.mockResolvedValue({
			outcome: { kind: "off" },
			checkout: null,
			vies: null,
			exemptionAvailable: false,
			cause: "x",
		});
		await evaluateB2bAction({ checkoutId: ID, mode: "confirm" });
		await evaluateB2bAction({ checkoutId: ID, mode: "anything" as never });
		expect(evaluateB2b.mock.calls.map(([params]) => params)).toEqual([
			{ checkoutId: ID, mode: "confirm" },
			{ checkoutId: ID, mode: "evaluate" },
		]);
	});

	it("an implausible id is unconfirmed without a call", async () => {
		expect(await evaluateB2bAction({ checkoutId: "<script>" })).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "invalid",
		});
		expect(evaluateB2b).not.toHaveBeenCalled();
	});
});

describe("releaseB2bPaymentLockAction", () => {
	beforeEach(() => {
		release.mockReset();
		release.mockResolvedValue({
			ok: true,
			data: {
				checkoutB2bPaymentLockRelease: {
					status: "CANCELATION_REQUESTED",
					errors: [],
					checkout: {
						id: ID,
						b2bTaxState: { contextVersion: "v2", decision: "EXEMPT", paymentLocked: true },
					},
				},
			},
		});
	});

	it("hands the backend's status and lock to the browser, nothing else", async () => {
		expect(await releaseB2bPaymentLockAction({ checkoutId: ID, localeSlug: "de-DE" })).toEqual({
			kind: "release",
			status: "CANCELATION_REQUESTED",
			paymentLocked: true,
			cause: "release-CANCELATION_REQUESTED",
		});
		expect(release).toHaveBeenCalledWith(ID);
		expect(paymentLockDeps).toHaveBeenCalledWith("de-DE");
	});

	it("does nothing while the UI is off, and nothing for an id the storefront would not send", async () => {
		process.env.B2B_CHECKOUT_UI_ENABLED = "false";
		expect(await releaseB2bPaymentLockAction({ checkoutId: ID })).toEqual({
			kind: "unavailable",
			cause: "ui-disabled",
		});
		process.env.B2B_CHECKOUT_UI_ENABLED = "true";
		expect(await releaseB2bPaymentLockAction({ checkoutId: "<script>" })).toEqual({
			kind: "failed",
			cause: "invalid",
		});
		expect(paymentLockDeps).not.toHaveBeenCalled();
		expect(release).not.toHaveBeenCalled();
	});

	it("shares the budget of the other writes for one checkout", async () => {
		for (let i = 0; i < 40; i++) await saveB2bInputAction({ checkoutId: ID, input: company });
		expect(await releaseB2bPaymentLockAction({ checkoutId: ID })).toEqual({
			kind: "unavailable",
			cause: "rate-limited",
		});
		expect(release).not.toHaveBeenCalled();
	});
});

describe("readB2bPaymentLockAction", () => {
	beforeEach(() => {
		readState.mockReset();
		readState.mockResolvedValue({
			ok: true,
			data: {
				checkout: {
					id: ID,
					b2bTaxState: {
						contextVersion: "v2",
						decision: "EXEMPT",
						effectiveTaxExemption: true,
						checkedAt: null,
						expiresAt: null,
						paymentLocked: false,
					},
					totalPrice: null,
				},
			},
		});
	});

	it("reads the lock without asking for the release", async () => {
		expect(await readB2bPaymentLockAction({ checkoutId: ID })).toEqual({
			kind: "state",
			paymentLocked: false,
			cause: "unlocked",
		});
		expect(readState).toHaveBeenCalledWith(ID);
		expect(release).not.toHaveBeenCalled();
	});

	it("does nothing while the UI is off, and nothing for an implausible id", async () => {
		process.env.B2B_CHECKOUT_UI_ENABLED = "false";
		expect(await readB2bPaymentLockAction({ checkoutId: ID })).toEqual({
			kind: "unavailable",
			cause: "ui-disabled",
		});
		process.env.B2B_CHECKOUT_UI_ENABLED = "true";
		expect(await readB2bPaymentLockAction({ checkoutId: "x" })).toEqual({ kind: "failed", cause: "invalid" });
		expect(readState).not.toHaveBeenCalled();
	});

	it("has its own budget: waiting for a cancelation never uses up the writes, and a script is stopped", async () => {
		let last;
		for (let i = 0; i < 121; i++) last = await readB2bPaymentLockAction({ checkoutId: ID });
		expect(last).toEqual({ kind: "unavailable", cause: "rate-limited" });
		expect(readState).toHaveBeenCalledTimes(120);
		expect(await saveB2bInputAction({ checkoutId: ID, input: company })).toEqual({ ok: true });
	});
});
