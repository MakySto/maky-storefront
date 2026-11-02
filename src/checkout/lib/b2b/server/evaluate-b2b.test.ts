import { describe, expect, it, vi } from "vitest";

import type { ServerCheckout } from "@/checkout/lib/checkout-types";

import { serializeB2bInput } from "../b2b-input";
import type { B2bInputV1 } from "../contract";
import type {
	B2bTaxStateFields,
	CheckoutB2bTaxAttestationInput,
	MakyB2bApplyVerificationMutation,
	MakyB2bCheckoutStateQuery,
} from "../graphql";
import type { B2bAppResult } from "./b2b-saleor-client";
import { deliveryKindOf, evaluateB2b, type EvaluateB2bDeps } from "./evaluate-b2b";
import { runPaymentPreflight } from "./payment-preflight";
import type { ViesResult } from "./vies-client";

/**
 * MOCKS. `FakeBackend` plays the Saleor backend of the PROPOSED contract (`maky-b2b-v1.graphql`): a `contextVersion`
 * that moves with the context, `checkoutB2bTaxAttestationUpdate` that refuses a stale version, decides, and returns
 * the recalculated totals. It is the storefront's reading of the contract, not the backend's code; the real backend
 * is tested in its own session. VIES is a stub. Prices are the brief's example: 154,98 s DPH, 126,00 bez DPH.
 */

const NOW = Date.parse("2026-11-02T12:00:00.000Z");
const ID = "Q2hlY2tvdXQ6ZmFrZS1pZC0wMDAx";

const TAXED = { gross: 154.98, tax: 28.98 };
const EXEMPT = { gross: 126.0, tax: 0 };

type Decision = B2bTaxStateFields["decision"];

const companyInput = (patch: Partial<B2bInputV1> = {}): B2bInputV1 => ({
	schema: 1,
	isBusiness: true,
	registrationId: "",
	taxId: "",
	vatId: "DE123456789",
	...patch,
});

class FakeBackend {
	version = 1;
	decision: Decision = "TAXED_UNVERIFIED";
	effective = false;
	expiresAt: string | null = null;
	channel = "de-eur";
	input: B2bInputV1 | null = companyInput();
	shippingCountry = "DE";
	companyName: string | null = "Muster GmbH";
	deliveryMethodId: string | null = Buffer.from("ShippingMethod:7").toString("base64");
	/** What the PUBLIC read shows; normally follows the decision, a test may break it. */
	publicTotalsOverride: { gross: number; tax: number } | null = null;
	applyCalls: CheckoutB2bTaxAttestationInput[] = [];
	applyResponder:
		| ((input: CheckoutB2bTaxAttestationInput) => B2bAppResult<MakyB2bApplyVerificationMutation> | null)
		| null = null;

	totals() {
		return this.effective ? EXEMPT : TAXED;
	}

	publicCheckout(): ServerCheckout {
		const totals = this.publicTotalsOverride ?? this.totals();
		return {
			id: ID,
			channel: { slug: this.channel },
			b2bInput: this.input ? serializeB2bInput(this.input) : null,
			billingAddress: this.companyName
				? { companyName: this.companyName, country: { code: this.shippingCountry } }
				: null,
			shippingAddress: { country: { code: this.shippingCountry } },
			deliveryMethod: this.deliveryMethodId ? { id: this.deliveryMethodId } : null,
			totalPrice: {
				gross: { amount: totals.gross, currency: "EUR" },
				tax: { amount: totals.tax, currency: "EUR" },
			},
		} as unknown as ServerCheckout;
	}

	stateCheckout(): NonNullable<MakyB2bCheckoutStateQuery["checkout"]> {
		const totals = this.totals();
		return {
			id: ID,
			b2bTaxState: {
				contextVersion: `v${this.version}`,
				decision: this.decision,
				effectiveTaxExemption: this.effective,
				checkedAt: this.effective ? new Date(NOW).toISOString() : null,
				expiresAt: this.expiresAt,
			},
			totalPrice: {
				net: { amount: totals.gross - totals.tax, currency: "EUR" },
				tax: { amount: totals.tax, currency: "EUR" },
				gross: { amount: totals.gross, currency: "EUR" },
			},
		};
	}

	/** The backend's decision on an attestation for the CURRENT context. */
	decide(input: CheckoutB2bTaxAttestationInput) {
		const verification = input.verification;
		if (!verification) {
			this.decision = this.input?.vatId ? "TAXED_COUNTRY_MISMATCH" : "TAXED_NO_VAT_ID";
			this.effective = false;
		} else if (verification.status === "VALID") {
			this.decision = "EXEMPT";
			this.effective = true;
			this.expiresAt = new Date(NOW + 24 * 3600 * 1000).toISOString();
		} else {
			this.decision = verification.status === "INVALID" ? "TAXED_INVALID" : "TAXED_UNAVAILABLE";
			this.effective = false;
		}
		this.version++;
	}

	deps(
		overrides: Partial<EvaluateB2bDeps> = {},
	): EvaluateB2bDeps & { verifyVatId: ReturnType<typeof vi.fn> } {
		const verifyVatId = vi.fn(
			async (vatId: string): Promise<ViesResult> => ({
				status: "VALID",
				vatId,
				checkedAt: new Date(NOW).toISOString(),
				requestIdentifier: "WAPI-1",
				name: "MUSTER GMBH",
				address: "BERLIN",
				detail: "valid",
			}),
		);
		return {
			readCheckout: vi.fn(async () => ({ ok: true as const, checkout: this.publicCheckout() })),
			cookieCheckoutId: vi.fn(async () => ID),
			uiEnabled: () => true,
			readiness: async () => ({ ok: true }),
			readState: vi.fn(async () => ({ ok: true as const, data: { checkout: this.stateCheckout() } })),
			applyAttestation: vi.fn(async (_id: string, input: CheckoutB2bTaxAttestationInput) => {
				this.applyCalls.push(input);
				const custom = this.applyResponder?.(input);
				if (custom) return custom;
				if (input.expectedContextVersion !== `v${this.version}`) {
					return {
						ok: true as const,
						data: {
							checkoutB2bTaxAttestationUpdate: {
								errors: [{ field: "expectedContextVersion", code: "STALE_CONTEXT", message: null }],
								checkout: null,
							},
						},
					};
				}
				this.decide(input);
				return {
					ok: true as const,
					data: { checkoutB2bTaxAttestationUpdate: { errors: [], checkout: this.stateCheckout() } },
				};
			}),
			verifyVatId,
			now: () => NOW,
			...overrides,
		} as EvaluateB2bDeps & { verifyVatId: ReturnType<typeof vi.fn> };
	}
}

const evaluate = (deps: EvaluateB2bDeps, mode: "evaluate" | "confirm" = "evaluate") =>
	evaluateB2b({ checkoutId: ID, mode }, deps);

describe("evaluateB2B: who it applies to", () => {
	it("export markets never reach the token, VIES or the backend", async () => {
		const backend = new FakeBackend();
		backend.channel = "us-usd";
		const deps = backend.deps();
		expect(await evaluate(deps)).toMatchObject({ outcome: { kind: "off" }, cause: "export-market" });
		expect(deps.readState).not.toHaveBeenCalled();
		expect(deps.verifyVatId).not.toHaveBeenCalled();
	});

	it("UI off, or no company input: off, nothing privileged, no cookie check", async () => {
		const backend = new FakeBackend();
		const off = backend.deps({ uiEnabled: () => false });
		expect(await evaluate(off)).toMatchObject({ outcome: { kind: "off" }, cause: "ui-disabled" });

		backend.input = null;
		const b2c = backend.deps({ cookieCheckoutId: vi.fn(async () => "another-checkout") });
		expect(await evaluate(b2c)).toMatchObject({ outcome: { kind: "off" }, cause: "no-input" });
		expect(b2c.cookieCheckoutId).not.toHaveBeenCalled();
		expect(b2c.readState).not.toHaveBeenCalled();
	});

	it("a browser whose cookie names another checkout gets nothing privileged and no quote", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps({ cookieCheckoutId: vi.fn(async () => "Q2hlY2tvdXQ6b3RoZXI=") });
		expect(await evaluate(deps)).toEqual(
			expect.objectContaining({
				outcome: { kind: "unconfirmed" },
				checkout: null,
				cause: "checkout-access-denied",
			}),
		);
		expect(deps.readState).not.toHaveBeenCalled();
		expect(deps.verifyVatId).not.toHaveBeenCalled();
	});

	it("readiness failed: off, no VIES answer sent, no exemption offered", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps({ readiness: async () => ({ ok: false }) });
		expect(await evaluate(deps)).toMatchObject({
			outcome: { kind: "off" },
			cause: "readiness-failed",
			exemptionAvailable: false,
		});
		expect(deps.verifyVatId).not.toHaveBeenCalled();
		expect(deps.applyAttestation).not.toHaveBeenCalled();
	});
});

describe("evaluateB2B: the decision path", () => {
	it("VIES VALID → attestation with the read version → EXEMPT with the recalculated public quote", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps();
		const result = await evaluate(deps);
		expect(result).toMatchObject({ outcome: { kind: "exempt" }, cause: "applied-EXEMPT", vies: "VALID" });
		expect(result.checkout?.totalPrice?.gross?.amount).toBe(126);
		expect(backend.applyCalls).toEqual([
			{
				expectedContextVersion: "v1",
				verification: {
					vatId: "DE123456789",
					status: "VALID",
					checkedAt: new Date(NOW).toISOString(),
					requestIdentifier: "WAPI-1",
					name: "MUSTER GMBH",
					address: "BERLIN",
				},
			},
		]);
		expect(deps.verifyVatId).toHaveBeenCalledWith("DE123456789", ID);
	});

	it("a VIES answer that arrives after the context moved is not applied to it; one retry decides anew", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps();
		let first = true;
		deps.verifyVatId.mockImplementation(async (vatId: string) => {
			if (first) {
				first = false;
				backend.version++; // the customer changed the delivery address while VIES answered
			}
			return {
				status: "VALID",
				vatId,
				checkedAt: new Date(NOW).toISOString(),
				requestIdentifier: "WAPI-2",
				name: null,
				address: null,
				detail: "valid",
			} satisfies ViesResult;
		});
		const result = await evaluate(deps);
		expect(backend.applyCalls.map((call) => call.expectedContextVersion)).toEqual(["v1", "v2"]);
		expect(result).toMatchObject({ outcome: { kind: "exempt" }, cause: "applied-EXEMPT" });
	});

	it("STALE_CONTEXT twice: at most one retry, then 'changed' with the newest quote", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps();
		deps.verifyVatId.mockImplementation(async (vatId: string) => {
			backend.version++;
			return {
				status: "VALID",
				vatId,
				checkedAt: new Date(NOW).toISOString(),
				requestIdentifier: null,
				name: null,
				address: null,
				detail: "valid",
			};
		});
		const result = await evaluate(deps);
		expect(deps.applyAttestation).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({ outcome: { kind: "changed" }, cause: "context-still-changing" });
		expect(result.checkout?.totalPrice?.gross?.amount).toBe(154.98);
	});

	it("VIES UNAVAILABLE: taxed, the customer confirms the taxed total; never called invalid", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps();
		deps.verifyVatId.mockImplementation(async (vatId: string) => ({
			status: "UNAVAILABLE",
			vatId,
			checkedAt: new Date(NOW).toISOString(),
			requestIdentifier: null,
			name: null,
			address: null,
			detail: "MS_UNAVAILABLE",
		}));
		const result = await evaluate(deps);
		expect(result).toMatchObject({
			outcome: { kind: "taxed", reason: "unavailable", needsTaxedConfirmation: true },
			vies: "UNAVAILABLE",
			cause: "applied-TAXED_UNAVAILABLE",
		});
		expect(result.checkout?.totalPrice?.gross?.amount).toBe(154.98);
	});

	it("revokes an approval the context no longer supports (delivery moved to another country)", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW + 3600_000).toISOString();
		backend.shippingCountry = "AT";
		const deps = backend.deps();
		const result = await evaluate(deps);
		expect(deps.verifyVatId).not.toHaveBeenCalled();
		expect(backend.applyCalls).toEqual([{ expectedContextVersion: "v1", verification: null }]);
		expect(result).toMatchObject({ outcome: { kind: "taxed", reason: "country_mismatch" } });
	});

	it("no write when the backend already says what a revocation would", async () => {
		const backend = new FakeBackend();
		backend.input = companyInput({ vatId: "" });
		backend.decision = "TAXED_NO_VAT_ID";
		const deps = backend.deps();
		expect(await evaluate(deps)).toMatchObject({
			outcome: { kind: "taxed", reason: "no_vat_id" },
			cause: "reused-TAXED_NO_VAT_ID",
		});
		expect(deps.applyAttestation).not.toHaveBeenCalled();
	});

	it("TAXED_DISABLED asks a confirmation only from a company that typed a VAT ID", async () => {
		const backend = new FakeBackend();
		backend.decision = "TAXED_DISABLED";
		const withVat = await evaluate(backend.deps());
		expect(withVat.outcome).toEqual({ kind: "taxed", reason: "disabled", needsTaxedConfirmation: true });

		backend.input = companyInput({ vatId: "" });
		const withoutVat = await evaluate(backend.deps());
		expect(withoutVat.outcome).toEqual({ kind: "taxed", reason: "disabled", needsTaxedConfirmation: false });
	});
});

describe("evaluateB2B: confirm mode (before a payment)", () => {
	it("reuses an effective, unexpired EXEMPT: no VIES call, no write", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW + 3600_000).toISOString();
		const deps = backend.deps();
		expect(await evaluate(deps, "confirm")).toMatchObject({
			outcome: { kind: "exempt" },
			cause: "reused-EXEMPT",
		});
		expect(deps.verifyVatId).not.toHaveBeenCalled();
		expect(deps.applyAttestation).not.toHaveBeenCalled();
	});

	it("an expired EXEMPT is verified again", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW - 1).toISOString();
		const deps = backend.deps();
		expect(await evaluate(deps, "confirm")).toMatchObject({ cause: "applied-EXEMPT" });
		expect(deps.verifyVatId).toHaveBeenCalledTimes(1);
	});

	it("keeps a taxed total the customer accepted (TAXED_INVALID) instead of asking VIES again", async () => {
		const backend = new FakeBackend();
		backend.decision = "TAXED_INVALID";
		const confirm = backend.deps();
		expect(await evaluate(confirm, "confirm")).toMatchObject({ cause: "reused-TAXED_INVALID" });
		expect(confirm.verifyVatId).not.toHaveBeenCalled();

		const again = backend.deps();
		await evaluate(again, "evaluate");
		expect(again.verifyVatId).toHaveBeenCalledTimes(1);
	});
});

describe("evaluateB2B: failures are never a green light", () => {
	it("a failed write is unconfirmed — no fallback exemption, no fallback total", async () => {
		const backend = new FakeBackend();
		backend.applyResponder = () => ({ ok: false, error: { kind: "network", message: "socket hang up" } });
		expect(await evaluate(backend.deps())).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "apply-network",
		});
	});

	it("a failed state read is unconfirmed", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps({
			readState: vi.fn(async () => ({
				ok: false as const,
				error: { kind: "http" as const, statusCode: 502, message: "" },
			})),
		});
		expect(await evaluate(deps)).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "state-read-http",
		});
	});

	it("CHECKOUT_LOCKED is a payment in progress, UNMANAGED_EXEMPTION_CONFLICT is unconfirmed", async () => {
		const locked = new FakeBackend();
		locked.applyResponder = () => ({
			ok: true,
			data: {
				checkoutB2bTaxAttestationUpdate: {
					errors: [{ field: null, code: "CHECKOUT_LOCKED", message: null }],
					checkout: null,
				},
			},
		});
		expect(await evaluate(locked.deps())).toMatchObject({
			outcome: { kind: "locked" },
			cause: "checkout-locked",
		});

		const conflict = new FakeBackend();
		conflict.applyResponder = () => ({
			ok: true,
			data: {
				checkoutB2bTaxAttestationUpdate: {
					errors: [{ field: null, code: "UNMANAGED_EXEMPTION_CONFLICT", message: null }],
					checkout: null,
				},
			},
		});
		expect(await evaluate(conflict.deps())).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "apply-error-UNMANAGED_EXEMPTION_CONFLICT",
		});
	});

	it("'bez DPH' over a public total that still carries tax is a contradiction", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW + 3600_000).toISOString();
		backend.publicTotalsOverride = { gross: 126, tax: 23.56 };
		expect(await evaluate(backend.deps(), "confirm")).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "exempt-but-taxed-total",
		});
	});

	it("a public quote that does not match the decided totals, twice, is unconfirmed", async () => {
		const backend = new FakeBackend();
		backend.publicTotalsOverride = { gross: 150, tax: 28 };
		const deps = backend.deps();
		expect(await evaluate(deps)).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "totals-inconsistent",
		});
	});

	it("an unreadable checkout is unconfirmed", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps({ readCheckout: vi.fn(async () => ({ ok: false as const })) });
		expect(await evaluate(deps)).toMatchObject({
			outcome: { kind: "unconfirmed" },
			cause: "checkout-read-failed",
		});
	});
});

describe("deliveryKindOf", () => {
	it("tells click & collect (Warehouse) from shipping by the global id", () => {
		const pickup = Buffer.from("Warehouse:3f1a").toString("base64");
		const ship = Buffer.from("ShippingMethod:7").toString("base64");
		expect(deliveryKindOf({ deliveryMethod: { id: pickup } } as never)).toBe("pickup");
		expect(deliveryKindOf({ deliveryMethod: { id: ship } } as never)).toBe("shipping");
		expect(deliveryKindOf({ deliveryMethod: null } as never)).toBe("none");
	});
});

describe("runPaymentPreflight (card, express and zero-total share it)", () => {
	it("ready when the confirmed quote is the amount the customer saw — and without a client amount", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW + 3600_000).toISOString();
		expect(await runPaymentPreflight({ checkoutId: ID, expectedAmount: 126 }, backend.deps())).toMatchObject({
			kind: "ready",
		});
		expect(await runPaymentPreflight({ checkoutId: ID }, backend.deps())).toMatchObject({ kind: "ready" });
	});

	it("an exemption that ran out moves the total: refresh, B2B_CONTEXT_CHANGED, with the new quote", async () => {
		const backend = new FakeBackend();
		backend.decision = "EXEMPT";
		backend.effective = true;
		backend.expiresAt = new Date(NOW - 1).toISOString();
		const deps = backend.deps();
		deps.verifyVatId.mockImplementation(async (vatId: string) => ({
			status: "UNAVAILABLE",
			vatId,
			checkedAt: new Date(NOW).toISOString(),
			requestIdentifier: null,
			name: null,
			address: null,
			detail: "timeout",
		}));
		const result = await runPaymentPreflight({ checkoutId: ID, expectedAmount: 126 }, deps);
		expect(result).toMatchObject({ kind: "refresh_required", code: "B2B_CONTEXT_CHANGED" });
		expect(result.checkout?.totalPrice?.gross?.amount).toBe(154.98);
	});

	it("an ordinary (B2C) total change is TOTAL_CHANGED", async () => {
		const backend = new FakeBackend();
		backend.input = null;
		expect(await runPaymentPreflight({ checkoutId: ID, expectedAmount: 100 }, backend.deps())).toMatchObject({
			kind: "refresh_required",
			code: "TOTAL_CHANGED",
		});
	});

	it("blocked: a payment in progress, or a state nobody could confirm", async () => {
		const locked = new FakeBackend();
		locked.applyResponder = () => ({
			ok: true,
			data: {
				checkoutB2bTaxAttestationUpdate: {
					errors: [{ field: null, code: "CHECKOUT_LOCKED", message: null }],
					checkout: null,
				},
			},
		});
		expect(
			await runPaymentPreflight({ checkoutId: ID, expectedAmount: 154.98 }, locked.deps()),
		).toMatchObject({
			kind: "blocked",
			code: "CHECKOUT_LOCKED",
		});

		const failing = new FakeBackend();
		failing.applyResponder = () => ({ ok: false, error: { kind: "graphql", message: "" } });
		expect(
			await runPaymentPreflight({ checkoutId: ID, expectedAmount: 154.98 }, failing.deps()),
		).toMatchObject({
			kind: "blocked",
			code: "FINAL_STATE_UNCONFIRMED",
		});
	});

	it("STALE twice before a payment: refresh, nothing is paid on the old quote", async () => {
		const backend = new FakeBackend();
		const deps = backend.deps();
		deps.verifyVatId.mockImplementation(async (vatId: string) => {
			backend.version++;
			return {
				status: "VALID",
				vatId,
				checkedAt: new Date(NOW).toISOString(),
				requestIdentifier: null,
				name: null,
				address: null,
				detail: "valid",
			};
		});
		expect(await runPaymentPreflight({ checkoutId: ID, expectedAmount: 154.98 }, deps)).toMatchObject({
			kind: "refresh_required",
			code: "B2B_CONTEXT_CHANGED",
		});
	});
});
