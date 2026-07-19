import { afterEach, describe, expect, it, vi } from "vitest";
import {
	findStripeGateway,
	getStripePaymentGuardError,
	isStripeGateway,
	isStripeExpressCheckoutEnabled,
	isStripePaymentEnabled,
	STRIPE_GATEWAY_ID,
} from "./stripe";

describe("isStripeGateway", () => {
	it("matches the Saleor Stripe app id", () => {
		expect(isStripeGateway(STRIPE_GATEWAY_ID)).toBe(true);
	});

	it("does not match other gateway ids", () => {
		expect(isStripeGateway("custom.stripe.gateway")).toBe(false);
		expect(isStripeGateway("stripe")).toBe(false);
	});
});

describe("findStripeGateway", () => {
	it("returns the stripe gateway from checkout gateways", () => {
		const stripe = { id: STRIPE_GATEWAY_ID, name: "Stripe" };
		expect(findStripeGateway([{ id: "saleor.io.dummy-payment-app", name: "Dummy" }, stripe])).toEqual(stripe);
	});
});

describe("isStripePaymentEnabled", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("allows stripe in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(isStripePaymentEnabled()).toBe(true);
	});

	it("blocks stripe in production by default", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(isStripePaymentEnabled()).toBe(false);
	});

	it("allows stripe in production when NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS is set", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS", "true");
		expect(isStripePaymentEnabled()).toBe(true);
	});

	it("allows stripe in production when ENABLE_STRIPE_PAYMENTS is set", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("ENABLE_STRIPE_PAYMENTS", "true");
		expect(isStripePaymentEnabled()).toBe(true);
	});
});

describe("isStripeExpressCheckoutEnabled", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("is disabled when stripe payments are disabled", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(isStripeExpressCheckoutEnabled()).toBe(false);
	});

	it("is enabled when stripe payments are enabled", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS", "true");
		expect(isStripeExpressCheckoutEnabled()).toBe(true);
	});

	it("can be opted out explicitly", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_STRIPE_EXPRESS_CHECKOUT", "false");
		expect(isStripeExpressCheckoutEnabled()).toBe(false);
	});
});

describe("getStripePaymentGuardError", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns null for non-stripe gateways", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(getStripePaymentGuardError("saleor.io.dummy-payment-app")).toBeNull();
	});

	it("blocks stripe gateway in production without flag", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(getStripePaymentGuardError(STRIPE_GATEWAY_ID)).toMatch(/nie sú v tomto prostredí povolené/i);
	});

	it("allows stripe gateway when enabled", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS", "true");
		expect(getStripePaymentGuardError(STRIPE_GATEWAY_ID)).toBeNull();
	});
});
