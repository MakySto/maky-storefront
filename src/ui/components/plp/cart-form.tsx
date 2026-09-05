"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

import type { AddToCartResult } from "./add-to-cart-result";

type CartFormAction = (previous: AddToCartResult | null, formData: FormData) => Promise<AddToCartResult>;

/**
 * The add-to-cart form, with the outcome shown to the customer.
 *
 * Both add-to-cart surfaces used `<form action={serverAction}>`, which can carry
 * a pending state and nothing else — so a refusal from Saleor reached a server
 * `console.error` and the shopper saw a button that had simply finished. On a
 * catalogue sold to order, "out of stock" and "silence" must not look the same.
 *
 * `useActionState` is what makes the result reachable in the DOM; the action,
 * the variant selection and the session are otherwise untouched.
 */
export function CartForm({
	action,
	className,
	children,
}: {
	action: CartFormAction;
	className?: string;
	children: React.ReactNode;
}) {
	const [result, formAction] = useActionState(action, null);

	return (
		<form action={formAction} className={className}>
			{children}
			<AddToCartStatus result={result} />
		</form>
	);
}

function AddToCartStatus({ result }: { result: AddToCartResult | null }) {
	const t = useTranslations("cart");

	if (!result) return null;

	if (result.status === "added") {
		return (
			<p role="status" className="text-status-success mt-2 flex items-center gap-1.5 text-sm">
				<CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
				{t("addedToCart")}
			</p>
		);
	}

	// Deliberately not an error: we do not know that it failed, and telling a
	// customer to try again could put the item in twice.
	if (result.status === "unconfirmed") {
		return (
			<p role="status" className="text-text-secondary mt-2 flex items-center gap-1.5 text-sm">
				<HelpCircle className="size-4 shrink-0" aria-hidden="true" />
				{t("addUnconfirmed")}
			</p>
		);
	}

	const message =
		result.reason === "unavailable"
			? t("addUnavailable")
			: result.reason === "invalid"
				? t("addInvalid")
				: result.reason === "not-found"
					? t("addNotFound")
					: t("addFailed");

	return (
		<p role="alert" className="text-status-danger mt-2 flex items-center gap-1.5 text-sm">
			<AlertCircle className="size-4 shrink-0" aria-hidden="true" />
			{message}
		</p>
	);
}
