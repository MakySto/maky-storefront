"use client";

import { useState, useTransition } from "react";
import { AlertCircle, LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { QUANTITY_FALLBACK_MAX } from "@/ui/components/ui/quantity-limits";
import { PaymentLockRecovery } from "@/checkout/components/b2b/payment-lock-recovery";
import { buildCheckoutPath } from "@/session-bridge";
import { deleteCartLine, updateCartLineQuantity, type CartMutationResult } from "./actions";

type CartLineActionsProps = {
	channel: string;
	checkoutId: string;
	lineId: string;
	productName: string;
	quantity: number;
	trackInventory?: boolean | null;
	quantityAvailable?: number | null;
	quantityLimitPerCustomer?: number | null;
	className?: string;
};

export function resolveMaximumQuantity({
	quantity,
	trackInventory,
	quantityAvailable,
	quantityLimitPerCustomer,
}: Pick<
	CartLineActionsProps,
	"quantity" | "trackInventory" | "quantityAvailable" | "quantityLimitPerCustomer"
>) {
	const limits = [quantityLimitPerCustomer].filter(
		(value): value is number => typeof value === "number" && value >= 0,
	);
	if (trackInventory === true && typeof quantityAvailable === "number") {
		limits.push(Math.max(0, quantityAvailable));
	}
	const configuredLimit = limits.length > 0 ? Math.min(...limits) : QUANTITY_FALLBACK_MAX;

	// An existing checkout can temporarily contain more units than Saleor now
	// reports as available. Never strand the shopper with an invalid control.
	return Math.max(quantity, configuredLimit);
}

export function CartLineActions({
	channel,
	checkoutId,
	lineId,
	productName,
	quantity,
	trackInventory,
	quantityAvailable,
	quantityLimitPerCustomer,
	className,
}: CartLineActionsProps) {
	const t = useTranslations("cart");
	const tCommon = useTranslations("common");
	const [isPending, startTransition] = useTransition();
	const [operation, setOperation] = useState<"update" | "remove" | null>(null);
	const [failed, setFailed] = useState(false);
	// A change refused because a payment is in progress: the way out instead of "try again". The key starts it afresh.
	const [paymentLock, setPaymentLock] = useState({ key: 0, shown: false });
	const settle = (result: CartMutationResult) => {
		if (!result.ok && result.reason === "payment-locked") {
			setFailed(false);
			setPaymentLock((current) => ({ key: current.key + 1, shown: true }));
			return;
		}
		setFailed(!result.ok);
	};
	const maximum = resolveMaximumQuantity({
		quantity,
		trackInventory,
		quantityAvailable,
		quantityLimitPerCustomer,
	});

	const update = (nextQuantity: number) => {
		if (isPending || nextQuantity < 1 || nextQuantity > maximum) return;
		setOperation("update");
		setFailed(false);
		setPaymentLock((current) => (current.shown ? { ...current, shown: false } : current));
		startTransition(async () => {
			try {
				settle(await updateCartLineQuantity(channel, checkoutId, lineId, nextQuantity));
			} catch {
				setFailed(true);
			} finally {
				setOperation(null);
			}
		});
	};

	const remove = () => {
		if (isPending) return;
		setOperation("remove");
		setFailed(false);
		setPaymentLock((current) => (current.shown ? { ...current, shown: false } : current));
		startTransition(async () => {
			try {
				settle(await deleteCartLine(channel, checkoutId, lineId));
			} catch {
				setFailed(true);
			} finally {
				setOperation(null);
			}
		});
	};

	const controlClass =
		"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors " +
		"hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring " +
		"disabled:pointer-events-none disabled:opacity-40";
	const isUpdating = isPending && operation === "update";
	const isRemoving = isPending && operation === "remove";

	return (
		<div className={cn("flex flex-wrap items-center gap-3", className)}>
			<div className="border-border bg-background inline-flex h-11 items-center rounded-lg border">
				<button
					type="button"
					onClick={() => update(quantity - 1)}
					disabled={isPending || quantity <= 1}
					className={controlClass}
					aria-label={`${t("decreaseQuantity")}: ${productName}`}
				>
					<Minus className="h-4 w-4" aria-hidden />
				</button>
				<span
					className="w-9 text-center text-sm font-semibold tabular-nums"
					role="status"
					aria-live="polite"
					aria-label={t("quantityLabel", { quantity })}
				>
					{quantity}
				</span>
				<button
					type="button"
					onClick={() => update(quantity + 1)}
					disabled={isPending || quantity >= maximum}
					className={controlClass}
					aria-label={`${t("increaseQuantity")}: ${productName}`}
				>
					<Plus className="h-4 w-4" aria-hidden />
				</button>
			</div>

			<button
				type="button"
				onClick={remove}
				disabled={isPending}
				className={cn(controlClass, "text-muted-foreground hover:text-destructive")}
				aria-label={t("removeItemAria", { product: productName })}
				title={isRemoving ? t("removing") : t("remove")}
			>
				{isRemoving ? (
					<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
				) : (
					<Trash2 className="h-4 w-4" aria-hidden />
				)}
			</button>

			{isUpdating ? (
				<span className="sr-only" role="status">
					{tCommon("loading")}
				</span>
			) : null}

			{failed && (
				<p role="alert" className="text-destructive flex basis-full items-center gap-1.5 text-xs">
					<AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
					{t("updateFailed")}
				</p>
			)}

			{paymentLock.shown ? (
				<PaymentLockRecovery
					key={paymentLock.key}
					className="basis-full"
					checkoutId={checkoutId}
					channelSlug={channel}
					subject="cart"
					payOriginal={{ href: buildCheckoutPath({ checkoutId, step: "payment" }) }}
					finishOrder={{ href: buildCheckoutPath({ checkoutId, step: "payment" }) }}
				/>
			) : null}
		</div>
	);
}
