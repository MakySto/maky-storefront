import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import {
	updateCheckoutQuery,
	useLiveCheckoutSearchParams,
	type CheckoutQueryHistory,
} from "@/checkout/lib/checkout-search-params";
import {
	getCheckoutSteps,
	getCurrentStepFromParams,
	type CheckoutStepType,
} from "@/checkout/views/saleor-checkout/flow";

/**
 * Shallow `?step=` routing for the checkout SPA (Track B.4.3, MIGRATION step 6).
 *
 * The current step is derived from the LIVE URL query (via `useLiveCheckoutSearchParams`), and
 * `goToStep` writes `?step=` through the History API (`updateCheckoutQuery`) — NOT `router.push`
 * — so switching steps never re-runs the checkout RSC page. Advancing via Continue uses
 * `history: "push"` (the default) so browser Back walks the steps; backward jumps pass `"replace"`
 * to keep the history clean.
 */
export function useCheckoutStep(isShippingRequired: boolean) {
	const serverSearchParams = useSearchParams();
	const searchParams = useLiveCheckoutSearchParams(serverSearchParams);
	const currentStep = getCurrentStepFromParams(searchParams, isShippingRequired);
	const stepRef = useRef<HTMLDivElement>(null);

	const goToStep = useCallback(
		(stepType: CheckoutStepType, history: CheckoutQueryHistory = "push") => {
			const step = getCheckoutSteps(isShippingRequired).find((s) => s.id === stepType);
			if (!step) return;
			updateCheckoutQuery({ step: step.slug }, { history });
		},
		[isShippingRequired],
	);

	// Scroll to top and focus the step container on step change (mobile UX + a11y).
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });
		stepRef.current?.focus();
	}, [currentStep.id]);

	return { currentStep, stepRef, goToStep };
}
