"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckIcon, ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { addListingItemToCartAction } from "./actions";
import { CartForm, useCartFormResult } from "./cart-form";
import type { AddToCartResult } from "./add-to-cart-result";

/** How long the button says "Pridané" after a successful add. */
const ADDED_MS = 2400;

export function AddButton({ withIcon }: { withIcon: boolean }) {
	const { pending } = useFormStatus();
	const tCommon = useTranslations("common");
	const result = useCartFormResult();
	// Every submission yields a new result object, so "the add that has already been shown" is
	// that object: the button says "Pridané" until the timer marks it seen, and a second add of
	// the same product says it again.
	const [seen, setSeen] = useState<AddToCartResult | null>(null);
	const added = result?.status === "added" && seen !== result && !pending;
	useEffect(() => {
		if (result?.status !== "added") return;
		const timer = window.setTimeout(() => setSeen(result), ADDED_MS);
		return () => window.clearTimeout(timer);
	}, [result]);

	const Icon = added ? CheckIcon : ShoppingCartIcon;
	return (
		// "Do košíka", the short label: beside the stepper the button has ~120px, and the long
		// "Pridať do košíka" ellipsised there. The cart icon rides wherever the button runs the
		// card's width. The hidden status line of the form tells assistive tech what happened;
		// this label is the sighted half of the same answer.
		<Button
			type="submit"
			disabled={pending}
			className="h-11 min-w-0 flex-1 gap-2 rounded-xs px-2.5 text-sm font-semibold shadow-none"
		>
			<Icon
				className={cn("h-4 w-4 shrink-0", !withIcon && !added && "lg:hidden")}
				strokeWidth={added ? 3 : 2.25}
				aria-hidden
			/>
			<span className="truncate">{added ? tCommon("addedShort") : tCommon("addToCartShort")}</span>
		</Button>
	);
}

/**
 * The listing's one-click add: the same form, the same action and the same button as the category
 * card's (`ProductCard`, `purchase="button"`), for a card that is rendered on the server and so
 * cannot hold the form itself. One unit, no quantity to choose — the cart changes it.
 */
export function ListingAddToCart({ channel, variantId }: { channel: string; variantId: string }) {
	return (
		<CartForm action={addListingItemToCartAction} quietSuccess>
			<div className="flex items-stretch gap-2">
				<input type="hidden" name="channel" value={channel} />
				<input type="hidden" name="variantId" value={variantId} />
				<input type="hidden" name="maxQuantity" value="" />
				<input type="hidden" name="quantity" value="1" />
				<AddButton withIcon />
			</div>
		</CartForm>
	);
}
