"use client";

import { createContext, type ReactNode, use, useCallback, useMemo, useRef, useState } from "react";

import { evaluateB2bAction } from "@/checkout/lib/b2b/actions";
import { parseB2bInput } from "@/checkout/lib/b2b/b2b-input";
import type { B2bEvaluationView } from "@/checkout/lib/b2b/b2b-view";
import {
	isB2bEuChannel,
	type B2bInputV1,
	type B2bUiOutcome,
	type B2bVatVerificationStatus,
} from "@/checkout/lib/b2b/contract";
import { b2bPaymentGate, taxedQuoteKey, type B2bPaymentGate } from "@/checkout/lib/b2b/payment-gate";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { rethrowNextInternalError } from "@/checkout/lib/rethrow-next-internal-error";
import { resolveCheckoutLocale } from "@/lib/checkout-locale";

/** What the RSC loader knows about this process (no secret, no token — two booleans). */
export type CheckoutB2bConfig = {
	/** `B2B_CHECKOUT_UI_ENABLED=true`: the company block is offered. */
	uiEnabled: boolean;
	/** The automatic exemption can be offered on this checkout (EU market, readiness passed). */
	exemptionAvailable: boolean;
};

export const B2B_CONFIG_OFF: CheckoutB2bConfig = { uiEnabled: false, exemptionAvailable: false };

export type CheckoutB2bContextValue = {
	config: CheckoutB2bConfig;
	/** The company input stored on the checkout (`maky.b2b.input.v1`), parsed strictly. */
	input: B2bInputV1 | null;
	/** UI on and the stored input says "Nakupujem na firmu". */
	businessMode: boolean;
	/** The checkout's market is an EU one (VIES applies); US/CA are export markets. */
	euMarket: boolean;
	/** The latest backend outcome this page saw, or `null` before the first evaluation (or after an edit). */
	outcome: B2bUiOutcome | null;
	vies: B2bVatVerificationStatus | null;
	exemptionAvailable: boolean;
	pending: boolean;
	/** Ask the server. A newer call makes every older answer irrelevant: a late answer is dropped, not shown. */
	evaluate: (mode: "evaluate" | "confirm") => Promise<B2bEvaluationView | null>;
	/** The company data are being edited: whatever was said before no longer describes them. */
	invalidate: () => void;
	/**
	 * The customer accepts a taxed total ("Pokračovať s DPH"). Bound to that quote (reason, currency, amount): a new
	 * quote needs a new confirmation. Without a key, the quote shown now.
	 */
	confirmTaxed: (forQuote?: string | null) => void;
	/** The quote a "Pokračovať s DPH" would confirm now (`taxedQuoteKey`), `null` when there is none. */
	quoteKey: string | null;
	gate: B2bPaymentGate;
};

const CheckoutB2bContext = createContext<CheckoutB2bContextValue | null>(null);

export function CheckoutB2bProvider({
	config,
	children,
}: {
	config: CheckoutB2bConfig;
	children: ReactNode;
}) {
	const { checkout, setCheckout } = useCheckoutData();
	const [outcome, setOutcome] = useState<B2bUiOutcome | null>(null);
	const [vies, setVies] = useState<B2bVatVerificationStatus | null>(null);
	const [exemptionAvailable, setExemptionAvailable] = useState(config.exemptionAvailable);
	const [pending, setPending] = useState(false);
	const [taxedConfirmedFor, setTaxedConfirmedFor] = useState<string | null>(null);
	const sequence = useRef(0);

	const input = useMemo(() => parseB2bInput(checkout?.b2bInput), [checkout?.b2bInput]);
	const euMarket = isB2bEuChannel(checkout?.channel.slug);
	const businessMode = config.uiEnabled && input?.isBusiness === true;
	const checkoutId = checkout?.id ?? null;
	const localeSlug = resolveCheckoutLocale(checkout?.channel.slug);

	const evaluate = useCallback(
		async (mode: "evaluate" | "confirm"): Promise<B2bEvaluationView | null> => {
			if (!config.uiEnabled || !checkoutId) return null;
			const mine = ++sequence.current;
			setPending(true);
			try {
				const result = await evaluateB2bAction({ checkoutId, localeSlug, mode });
				if (mine !== sequence.current) return null;
				setOutcome(result.outcome);
				setVies(result.vies);
				setExemptionAvailable(result.exemptionAvailable);
				if (result.checkout && result.checkout.id === checkoutId) {
					setCheckout(result.checkout);
				}
				return result;
			} catch (error) {
				rethrowNextInternalError(error);
				if (mine === sequence.current) setOutcome({ kind: "unconfirmed" });
				return null;
			} finally {
				if (mine === sequence.current) setPending(false);
			}
		},
		[checkoutId, config.uiEnabled, localeSlug, setCheckout],
	);

	const invalidate = useCallback(() => {
		sequence.current++;
		setPending(false);
		setOutcome(null);
		setVies(null);
	}, []);

	const quoteKey = checkout && outcome ? taxedQuoteKey(checkout, outcome) : null;
	const confirmTaxed = useCallback(
		(forQuote?: string | null) => setTaxedConfirmedFor(typeof forQuote === "string" ? forQuote : quoteKey),
		[quoteKey],
	);

	const taxedConfirmed = quoteKey !== null && taxedConfirmedFor === quoteKey;
	const gate = useMemo(
		() => b2bPaymentGate({ businessMode, euMarket, outcome, pending, taxedConfirmed }),
		[businessMode, euMarket, outcome, pending, taxedConfirmed],
	);

	const value = useMemo<CheckoutB2bContextValue>(
		() => ({
			config,
			input,
			businessMode,
			euMarket,
			outcome,
			vies,
			exemptionAvailable,
			pending,
			evaluate,
			invalidate,
			confirmTaxed,
			quoteKey,
			gate,
		}),
		[
			config,
			input,
			businessMode,
			euMarket,
			outcome,
			vies,
			exemptionAvailable,
			pending,
			evaluate,
			invalidate,
			confirmTaxed,
			quoteKey,
			gate,
		],
	);

	return <CheckoutB2bContext.Provider value={value}>{children}</CheckoutB2bContext.Provider>;
}

const OFF_VALUE: CheckoutB2bContextValue = {
	config: B2B_CONFIG_OFF,
	input: null,
	businessMode: false,
	euMarket: false,
	outcome: null,
	vies: null,
	exemptionAvailable: false,
	pending: false,
	evaluate: async () => null,
	invalidate: () => {},
	confirmTaxed: () => {},
	quoteKey: null,
	gate: { allowed: true, state: "ready" },
};

/** Outside the provider (or with the UI off) the checkout behaves exactly as before: B2B is off. */
export function useCheckoutB2b(): CheckoutB2bContextValue {
	return use(CheckoutB2bContext) ?? OFF_VALUE;
}
