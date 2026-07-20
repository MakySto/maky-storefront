"use client";

import { useState, useCallback, useEffect, useRef, type FC } from "react";
import { Truck, Clock, Leaf, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/ui/components/ui/button";
import { useLocale } from "@/providers/locale-provider";
import { cn } from "@/lib/utils";
import { type CheckoutFragment } from "@/checkout/graphql";
import { checkoutDeliveryMethodUpdateAction } from "@/checkout/lib/actions";
import { CheckoutSummaryContext, buildShippingSummaryRows } from "./checkout-summary-context";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { formatShippingPrice } from "@/checkout/lib/utils/money";
import { localizeCountryName } from "@/checkout/lib/utils/locale";
import {
	resolvePersistedMethodId,
	resolveSoleMethodToAutoSave,
} from "@/checkout/lib/shipping-method-selection";
import { MobileStickyAction } from "./mobile-sticky-action";
import { getStepNumber } from "./flow";

interface ShippingStepProps {
	checkout: CheckoutFragment;
	onBack: () => void;
	onNext: () => void;
}

export const ShippingStep: FC<ShippingStepProps> = ({ checkout: initialCheckout, onBack, onNext }) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	// Use live checkout data that updates after mutations
	const { checkout: liveCheckout, fetching, refetch } = useCheckout();
	const checkout = liveCheckout || initialCheckout;

	const shippingMethods = checkout.shippingMethods || [];
	const hasShippingAddress = !!checkout.shippingAddress;
	// The fragment does not select __typename on deliveryMethod, so it is absent at runtime (same
	// class of bug as the summary "Method —" fix); the selection invariants live in
	// shipping-method-selection.ts (unit-tested there — vitest env has no DOM renderer).
	const currentMethodId = resolvePersistedMethodId(checkout.deliveryMethod?.id, shippingMethods);

	// Selection saves IMMEDIATELY on pick (summary + total must be truthful already on this
	// step); Continue only navigates. On a failed save the previous choice is restored.
	// The UI must never mark a method the server does not have: the only initial selection is
	// the server-persisted one. A sole available method is auto-SAVED (effect below), not just
	// visually preselected.
	const [selectedMethod, setSelectedMethod] = useState<string | undefined>(currentMethodId);
	const [isSavingMethod, setIsSavingMethod] = useState(false);
	const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Summary rows for context display
	const summaryRows = buildShippingSummaryRows(checkout, locale);

	const getMethodIcon = (name: string) => {
		const lowerName = name.toLowerCase();
		if (lowerName.includes("express") || lowerName.includes("fast")) return Clock;
		if (lowerName.includes("eco") || lowerName.includes("green")) return Leaf;
		return Truck;
	};

	const isEcoMethod = (name: string) => {
		const lowerName = name.toLowerCase();
		return lowerName.includes("eco") || lowerName.includes("green");
	};

	/** Persist a picked method and refresh the checkout context (live shipping + total). */
	const saveMethod = useCallback(
		async (methodId: string): Promise<boolean> => {
			const result = await checkoutDeliveryMethodUpdateAction(
				{
					checkoutId: checkout.id,
					deliveryMethodId: methodId,
				},
				locale,
			);

			const fieldErrors = result.data?.checkoutDeliveryMethodUpdate?.errors;
			if (result.error || fieldErrors?.length) {
				return false;
			}

			await refetch();
			return true;
		},
		[checkout.id, refetch, locale],
	);

	// The server-persisted method is the source of truth for what reads as selected. When it
	// (re)appears — hard refresh, back-navigation from Payment, refetch after save — mirror it,
	// unless the user already has a pick in flight.
	useEffect(() => {
		if (currentMethodId) {
			setSelectedMethod((prev) => prev ?? currentMethodId);
		}
	}, [currentMethodId]);

	// A sole available method is committed immediately and idempotently: save first, mark as
	// selected only after the server confirms (summary + total are then already truthful on this
	// step). One-shot per mount — a failed save leaves the method unselected for a manual pick,
	// never a retry loop. With multiple methods nothing is preselected until the user picks.
	const autoSaveRan = useRef(false);
	useEffect(() => {
		const soleMethodId = resolveSoleMethodToAutoSave(currentMethodId, shippingMethods);
		if (autoSaveRan.current || !soleMethodId) {
			return;
		}
		autoSaveRan.current = true;
		setIsSavingMethod(true);
		void saveMethod(soleMethodId)
			.then((saved) => {
				if (saved) {
					setSelectedMethod(soleMethodId);
				}
			})
			.finally(() => setIsSavingMethod(false));
	}, [currentMethodId, shippingMethods, saveMethod]);

	const handleSelectMethod = useCallback(
		async (methodId: string) => {
			if (isSavingMethod) {
				return;
			}

			const previous = selectedMethod;
			setSelectedMethod(methodId);
			setError(null);

			if (methodId === currentMethodId) {
				return;
			}

			setIsSavingMethod(true);
			try {
				const saved = await saveMethod(methodId);
				if (!saved) {
					setSelectedMethod(previous);
					setError(t("shipping.methodSaveFailed"));
				}
			} finally {
				setIsSavingMethod(false);
			}
		},
		[currentMethodId, isSavingMethod, saveMethod, selectedMethod, t],
	);

	const handleSubmit = useCallback(
		async (event?: React.FormEvent) => {
			if (event) {
				event.preventDefault();
			}

			if (!selectedMethod) {
				setError(t("shipping.selectMethod"));
				// Focus the first radio option
				const firstRadio = document.querySelector('input[name="shipping"]') as HTMLElement;
				firstRadio?.focus();
				return;
			}

			if (isSavingMethod) {
				return;
			}

			// Selection is saved on pick — Continue just navigates. The mutation below is only
			// the retry path after a failed immediate save.
			if (selectedMethod === currentMethodId) {
				onNext();
				return;
			}

			setIsSubmittingLocal(true);
			setError(null);

			try {
				const saved = await saveMethod(selectedMethod);
				if (!saved) {
					setError(t("shipping.methodSaveFailed"));
					return;
				}
				onNext();
			} finally {
				setIsSubmittingLocal(false);
			}
		},
		[selectedMethod, currentMethodId, isSavingMethod, onNext, saveMethod, t],
	);

	const buttonText = isSubmittingLocal ? t("common.saving") : t("common.continueToPayment");

	return (
		<form className="space-y-8" onSubmit={handleSubmit}>
			{/* Summary Context */}
			<CheckoutSummaryContext checkout={checkout} rows={summaryRows} onGoToStep={() => onBack()} />

			{/* Shipping Methods */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">{t("shipping.title")}</h2>

				{error && <p className="text-destructive text-sm">{error}</p>}

				{fetching ? (
					<div className="border-border flex items-center gap-3 rounded-lg border p-4">
						<div className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
						<p className="text-muted-foreground text-sm">{t("shipping.loadingMethods")}</p>
					</div>
				) : shippingMethods.length === 0 ? (
					<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
						<p className="text-sm text-amber-800">
							{!hasShippingAddress
								? t("shipping.noAddressYet")
								: (() => {
										const countryName = localizeCountryName(
											checkout.shippingAddress?.country?.code,
											checkout.shippingAddress?.country?.country,
											locale,
										);
										return countryName
											? t("shipping.noMethodsForCountry", { countryName })
											: t("shipping.noMethodsForCountryGeneric");
									})()}
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{shippingMethods.map((method) => {
							const Icon = getMethodIcon(method.name);
							const isSelected = selectedMethod === method.id;
							const isEco = isEcoMethod(method.name);
							const priceDisplay = formatShippingPrice(method.price, locale);

							return (
								<label
									key={method.id}
									className={cn(
										"flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors",
										"focus-within:ring-foreground focus-within:ring-2 focus-within:ring-offset-2",
										isSelected
											? "bg-secondary/50 border-foreground"
											: "hover:border-muted-foreground/50 border-border",
									)}
								>
									<input
										type="radio"
										name="shipping"
										value={method.id}
										checked={isSelected}
										disabled={isSavingMethod}
										onChange={() => void handleSelectMethod(method.id)}
										className="sr-only"
									/>
									<div
										className={cn(
											"flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
											isSelected ? "border-foreground" : "border-muted-foreground/50",
										)}
									>
										{isSelected && <div className="bg-foreground h-2.5 w-2.5 rounded-full" />}
									</div>
									<Icon className={cn("h-5 w-5", isEco ? "text-green-600" : "text-muted-foreground")} />
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium">{method.name}</span>
											{isEco && (
												<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
													{t("shipping.ecoBadge")}
												</span>
											)}
										</div>
										{method.minimumDeliveryDays && method.maximumDeliveryDays && (
											<p className="text-muted-foreground text-sm">
												{t("shipping.deliveryEstimate", {
													min: method.minimumDeliveryDays,
													max: method.maximumDeliveryDays,
												})}
											</p>
										)}
									</div>
									<span className="font-medium">{priceDisplay}</span>
								</label>
							);
						})}
					</div>
				)}
			</section>

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
				>
					<ChevronLeft className="h-4 w-4" />
					{t("common.backToInformation")}
				</button>
				<Button
					type="submit"
					disabled={!selectedMethod || isSavingMethod || isSubmittingLocal}
					className="hidden h-12 px-8 md:flex"
				>
					{buttonText}
				</Button>
			</div>

			<MobileStickyAction
				step={getStepNumber("SHIPPING", true)}
				isShippingRequired={true}
				type="submit"
				onAction={handleSubmit}
				isLoading={isSubmittingLocal || isSavingMethod}
				disabled={!selectedMethod || isSavingMethod}
				loadingText={t("common.saving")}
			/>
		</form>
	);
};
