"use client";

import { createContext, useActionState, useContext } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

import type { AddToCartResult } from "./add-to-cart-result";

type CartFormAction = (previous: AddToCartResult | null, formData: FormData) => Promise<AddToCartResult>;

const CartFormResultContext = createContext<AddToCartResult | null>(null);

/**
 * The last outcome of the surrounding `<CartForm>` — a new object for every submission, so a
 * button can tell one add from the next. Null before the first submission and outside a form.
 */
export function useCartFormResult(): AddToCartResult | null {
	return useContext(CartFormResultContext);
}

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
	quietSuccess = false,
	children,
}: {
	action: CartFormAction;
	className?: string;
	/**
	 * The listing card's form: a success is told by the button itself ("Pridané", then back) and
	 * to assistive tech by a hidden status line, not by a visible line under the button. A line
	 * appearing in one card of a grid pushed that card's purchase row out of line with the rest of
	 * its row. A refusal, and a "we do not know", still show — a shopper must see those.
	 */
	quietSuccess?: boolean;
	children: React.ReactNode;
}) {
	const [result, formAction] = useActionState(action, null);

	return (
		<form action={formAction} className={className}>
			<CartFormResultContext.Provider value={result}>{children}</CartFormResultContext.Provider>
			<AddToCartStatus result={result} quietSuccess={quietSuccess} />
		</form>
	);
}

function AddToCartStatus({
	result,
	quietSuccess,
}: {
	result: AddToCartResult | null;
	quietSuccess: boolean;
}) {
	const t = useTranslations("cart");

	// The quiet form keeps its status region in the DOM from the start, so the announcement is a
	// change to a region that already exists — the form assistive tech reliably reads.
	if (quietSuccess && (!result || result.status === "added")) {
		return (
			<p role="status" className="sr-only">
				{result ? t("addedToCart") : ""}
			</p>
		);
	}

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
