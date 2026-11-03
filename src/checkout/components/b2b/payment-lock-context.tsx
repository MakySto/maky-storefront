"use client";

import { createContext, useContext } from "react";

/**
 * Lets a payment form tell the payment step "a payment for this checkout is already in progress" (the server preflight
 * or `transactionInitialize` answered `CHECKOUT_LOCKED`), so the step can offer the way out (`PaymentLockRecovery`)
 * instead of an error line. A code, not a translated string, travels; without a provider the forms show their error
 * as before.
 */
const PaymentLockReporter = createContext<(() => void) | null>(null);

export const PaymentLockReporterProvider = PaymentLockReporter.Provider;

export function usePaymentLockReporter(): (() => void) | null {
	return useContext(PaymentLockReporter);
}
