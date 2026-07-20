import { describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en-US.json";
import {
	buildCheckoutGatewayMessages,
	getCheckoutPaymentLibMessages,
	getUnsupportedGatewayMessage,
	type CheckoutPaymentLibMessages,
} from "./gateway-messages";

const enPayment = enMessages.checkout.payment;

describe("FALLBACK_PAYMENT_LIB_MESSAGES", () => {
	it("stays in sync with the en-US catalog (EN is the source language — no market-specific fallback)", () => {
		// The registry starts empty in tests, so this returns the module fallback.
		const fallback = getCheckoutPaymentLibMessages();

		const expected: CheckoutPaymentLibMessages = {
			billingSaveFailed: enPayment.billingSaveFailed,
			invalidValue: enPayment.invalidValue,
			gatewayInitFailed: enPayment.gatewayInitFailed,
			stripeWebhookFailed: enPayment.stripeWebhookFailed,
			stripeProcessFailed: enPayment.stripeProcessFailed,
			paymentFailed: enPayment.failed,
			notFullyPaid: enPayment.notFullyPaid,
			alreadyCompleted: enPayment.alreadyCompleted,
			freeOrderTotalChanged: enPayment.freeOrderTotalChanged,
		};

		expect(fallback).toEqual(expected);
	});
});

describe("getUnsupportedGatewayMessage", () => {
	const messages = buildCheckoutGatewayMessages((key) => `msg:${key}`);

	it("returns customer-safe copy and logs the gateway list (names + ids) to the console only", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const result = getUnsupportedGatewayMessage([{ id: "app.example.gateway", name: "Example" }], messages);

		expect(result).toBe("msg:unsupported");
		expect(result).not.toContain("app.example.gateway");
		expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("Example (app.example.gateway)"));
		consoleError.mockRestore();
	});

	it("returns the same customer-safe copy without logging when the list is empty", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		expect(getUnsupportedGatewayMessage([], messages)).toBe("msg:unsupported");
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
