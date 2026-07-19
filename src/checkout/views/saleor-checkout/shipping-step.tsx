"use client";

import { useState, useCallback, type FC } from "react";
import { Truck, Clock, Leaf, ChevronLeft } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { type CheckoutFragment } from "@/checkout/graphql";
import { checkoutDeliveryMethodUpdateAction } from "@/checkout/lib/actions";
import { CheckoutSummaryContext, buildShippingSummaryRows } from "./checkout-summary-context";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { formatShippingPrice } from "@/checkout/lib/utils/money";
import { MobileStickyAction } from "./mobile-sticky-action";
import { getStepNumber } from "./flow";

interface ShippingStepProps {
	checkout: CheckoutFragment;
	onBack: () => void;
	onNext: () => void;
}

export const ShippingStep: FC<ShippingStepProps> = ({ checkout: initialCheckout, onBack, onNext }) => {
	// Use live checkout data that updates after mutations
	const { checkout: liveCheckout, fetching, refetch } = useCheckout();
	const checkout = liveCheckout || initialCheckout;

	const shippingMethods = checkout.shippingMethods || [];
	const hasShippingAddress = !!checkout.shippingAddress;
	const currentMethod = checkout.deliveryMethod;
	const currentMethodId = currentMethod?.__typename === "ShippingMethod" ? currentMethod.id : undefined;

	// Local state - only saves on Continue
	const [selectedMethod, setSelectedMethod] = useState(currentMethodId || shippingMethods[0]?.id);
	const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Summary rows for context display
	const summaryRows = buildShippingSummaryRows(checkout);

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

	const handleSubmit = useCallback(
		async (event?: React.FormEvent) => {
			if (event) {
				event.preventDefault();
			}

			if (!selectedMethod) {
				setError("Vyberte spôsob dopravy");
				// Focus the first radio option
				const firstRadio = document.querySelector('input[name="shipping"]') as HTMLElement;
				firstRadio?.focus();
				return;
			}

			// Skip API call if method hasn't changed
			if (selectedMethod === currentMethodId) {
				onNext();
				return;
			}

			setIsSubmittingLocal(true);
			setError(null);

			try {
				const result = await checkoutDeliveryMethodUpdateAction({
					checkoutId: checkout.id,
					deliveryMethodId: selectedMethod,
				});

				if (result.error) {
					setError("Nepodarilo sa uložiť spôsob dopravy");
					return;
				}

				// Pull the saved delivery method into the provider before the shallow step change, so the
				// Payment step reads the fresh checkout total. Only after a real save (the unchanged-method
				// path above advances without a mutation or refresh — bare step nav stays shallow).
				await refetch();
				onNext();
			} finally {
				setIsSubmittingLocal(false);
			}
		},
		[selectedMethod, currentMethodId, onNext, checkout.id, refetch],
	);

	const buttonText = isSubmittingLocal ? "Ukladám…" : "Pokračovať na platbu";

	return (
		<form className="space-y-8" onSubmit={handleSubmit}>
			{/* Summary Context */}
			<CheckoutSummaryContext checkout={checkout} rows={summaryRows} onGoToStep={() => onBack()} />

			{/* Shipping Methods */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">Spôsob dopravy</h2>

				{error && <p className="text-destructive text-sm">{error}</p>}

				{fetching ? (
					<div className="border-border flex items-center gap-3 rounded-lg border p-4">
						<div className="border-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
						<p className="text-muted-foreground text-sm">Načítavame spôsoby dopravy…</p>
					</div>
				) : shippingMethods.length === 0 ? (
					<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
						<p className="text-sm text-amber-800">
							{!hasShippingAddress
								? "Najprv sa vráťte späť a zadajte dodaciu adresu."
								: `Pre ${
										checkout.shippingAddress?.country?.country || "vašu adresu"
									} nie sú dostupné žiadne spôsoby dopravy. Skontrolujte adresu alebo nás kontaktujte.`}
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{shippingMethods.map((method) => {
							const Icon = getMethodIcon(method.name);
							const isSelected = selectedMethod === method.id;
							const isEco = isEcoMethod(method.name);
							const priceDisplay = formatShippingPrice(method.price);

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
										onChange={() => {
											setSelectedMethod(method.id);
											setError(null);
										}}
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
													Eko
												</span>
											)}
										</div>
										{method.minimumDeliveryDays && method.maximumDeliveryDays && (
											<p className="text-muted-foreground text-sm">
												{method.minimumDeliveryDays}-{method.maximumDeliveryDays} pracovných dní
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
					Späť na informácie
				</button>
				<Button
					type="submit"
					disabled={!selectedMethod || isSubmittingLocal}
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
				isLoading={isSubmittingLocal}
				disabled={!selectedMethod}
				loadingText="Ukladám…"
			/>
		</form>
	);
};
