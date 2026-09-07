"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Ceiling used when the catalogue reports no usable availability number.
 * Not a stock claim — just a sane upper bound for a text field.
 */
// Defined in a directive-free module so a server action can read it too; see
// `quantity-limits.ts` for what went wrong when it lived here.
export { QUANTITY_FALLBACK_MAX } from "./quantity-limits";
import { QUANTITY_FALLBACK_MAX } from "./quantity-limits";

export interface QuantityStepperProps {
	/** Controlled value. Omit for an uncontrolled stepper seeded from `defaultValue`. */
	value?: number;
	onChange?: (value: number) => void;
	defaultValue?: number;
	min?: number;
	/**
	 * Upper bound. On the PDP this is `variant.quantityAvailable`, which Saleor
	 * CAPS (≈50) rather than reporting real stock — fine as a ceiling, never as
	 * a "only N left" claim.
	 */
	max?: number;
	/** Form field name. The value is submitted with the surrounding <form>. */
	name?: string;
	disabled?: boolean;
	className?: string;
	/**
	 * Narrower control for tight rows such as a listing card, where the stepper
	 * must not crowd out the add-to-cart button. Still 44px tall, so the touch
	 * target stays within EAA.
	 */
	compact?: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * `[ − ] n [ + ]` — integer quantity control.
 *
 * Deliberately generic: the cart reuses it, so it holds no PDP-specific
 * knowledge. Submits its value under `name` so a server action can read it
 * straight off the FormData; the surrounding form is the single source of
 * truth for both the main and the sticky CTA.
 */
export function QuantityStepper({
	value,
	onChange,
	defaultValue = 1,
	min = 1,
	max = QUANTITY_FALLBACK_MAX,
	name,
	disabled = false,
	className,
	compact = false,
}: QuantityStepperProps) {
	const t = useTranslations("product");
	const inputId = useId();
	const [internal, setInternal] = useState(() => clamp(defaultValue, min, max));

	const current = clamp(value ?? internal, min, max);

	const set = (next: number) => {
		const clamped = clamp(Number.isFinite(next) ? Math.trunc(next) : min, min, max);
		if (value === undefined) setInternal(clamped);
		onChange?.(clamped);
	};

	const atMin = current <= min;
	const atMax = current >= max;

	const button =
		`flex h-11 ${
			compact ? "w-8" : "w-11"
		} shrink-0 items-center justify-center text-text-secondary transition-colors ` +
		"hover:bg-control-bg-hover hover:text-text-primary " +
		"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset " +
		"disabled:pointer-events-none disabled:opacity-40";

	return (
		<div
			className={cn(
				"border-control-border bg-surface-primary inline-flex h-11 shrink-0 items-center rounded-md border",
				disabled && "pointer-events-none opacity-50",
				className,
			)}
		>
			<button
				type="button"
				className={button}
				onClick={() => set(current - 1)}
				disabled={disabled || atMin}
				aria-label={t("decreaseQuantity")}
				aria-controls={inputId}
			>
				<Minus className="h-4 w-4" aria-hidden />
			</button>

			<input
				id={inputId}
				name={name}
				type="number"
				inputMode="numeric"
				className={cn(
					compact ? "h-11 w-9" : "h-11 w-10",
					"border-0 bg-transparent text-center text-sm font-medium tabular-nums",
					"text-text-primary focus:outline-hidden",
					// Native spinners duplicate the −/+ buttons.
					"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				)}
				value={current}
				min={min}
				max={max}
				step={1}
				disabled={disabled}
				aria-label={t("quantity")}
				onChange={(e) => set(Number.parseInt(e.target.value, 10))}
				// A half-typed value must not escape as NaN or an out-of-range number.
				onBlur={(e) => set(Number.parseInt(e.target.value, 10))}
			/>

			<button
				type="button"
				className={button}
				onClick={() => set(current + 1)}
				disabled={disabled || atMax}
				aria-label={t("increaseQuantity")}
				aria-controls={inputId}
			>
				<Plus className="h-4 w-4" aria-hidden />
			</button>
		</div>
	);
}
