import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** MOCKS: the public Saleor transport and evaluateB2B's production deps are replaced; nothing leaves the process. */

const executePublicGraphQL = vi.fn();
vi.mock("@/lib/graphql", () => ({
	executePublicGraphQL: (...args: unknown[]) => executePublicGraphQL(...args),
}));
vi.mock("./server/evaluate-b2b-deps", () => ({ productionEvaluateB2bDeps: () => ({}) }));
const evaluateB2b = vi.fn();
vi.mock("./server/evaluate-b2b", () => ({ evaluateB2b: (...args: unknown[]) => evaluateB2b(...args) }));

const { saveB2bInputAction, evaluateB2bAction } = await import("./actions");
const { resetB2bActionGate } = await import("./server/action-gate");

const ID = "Q2hlY2tvdXQ6MTIzNDU2Nzg=";
const company = { schema: 1, isBusiness: true, registrationId: "", taxId: "", vatId: "DE123456789" };
let savedFlag: string | undefined;

beforeEach(() => {
	savedFlag = process.env.B2B_CHECKOUT_UI_ENABLED;
	process.env.B2B_CHECKOUT_UI_ENABLED = "true";
	executePublicGraphQL.mockReset();
	executePublicGraphQL.mockResolvedValue({ ok: true, data: { updateMetadata: { errors: [] } } });
	evaluateB2b.mockReset();
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
