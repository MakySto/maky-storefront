import { describe, expect, it } from "vitest";

import { buildCheckoutQueryUrl } from "./checkout-search-params";

/**
 * Pure URL-construction unit tests for the shallow `?step=` machinery (Track B.4.3).
 * `buildCheckoutQueryUrl` is the browser-free core of `updateCheckoutQuery`; the History-API
 * write side (`window.history.pushState` + `useSyncExternalStore`) is exercised by the runtime
 * browser smoke, not here. Updates use INTERNAL param keys (mapped to URL keys by
 * `createQueryString`, e.g. `orderId` → `order`, `step` → `step`).
 */
describe("buildCheckoutQueryUrl", () => {
	it("appends step to the live query, preserving the checkout id", () => {
		expect(buildCheckoutQueryUrl("checkout=abc", { step: "payment" }, "/checkout")).toBe(
			"/checkout?checkout=abc&step=payment",
		);
	});

	it("replaces an existing step in place", () => {
		expect(buildCheckoutQueryUrl("checkout=abc&step=contact", { step: "payment" }, "/checkout")).toBe(
			"/checkout?checkout=abc&step=payment",
		);
	});

	it("deletes a param when the value is null", () => {
		expect(buildCheckoutQueryUrl("checkout=abc&step=payment", { step: null }, "/checkout")).toBe(
			"/checkout?checkout=abc",
		);
	});

	it("never drops ephemeral params it does not touch (e.g. Stripe payment_intent)", () => {
		expect(
			buildCheckoutQueryUrl("checkout=abc&payment_intent=pi_123", { step: "shipping" }, "/checkout"),
		).toBe("/checkout?checkout=abc&payment_intent=pi_123&step=shipping");
	});

	it("maps the internal orderId key to the URL order key", () => {
		expect(buildCheckoutQueryUrl("checkout=abc", { orderId: "ord-1" }, "/checkout")).toBe(
			"/checkout?checkout=abc&order=ord-1",
		);
	});

	it("returns a bare pathname when the resulting query is empty", () => {
		expect(buildCheckoutQueryUrl("step=payment", { step: null }, "/checkout")).toBe("/checkout");
	});
});
