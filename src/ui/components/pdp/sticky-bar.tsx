"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { throttle } from "lodash-es";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { GateIcon, gateButtonKey, gateButtonLook, HELD_BACK_LABEL, useTyreSizeGate } from "./tyre-fit-box";

/** Scroll threshold (in pixels) before showing the sticky bar */
const SCROLL_THRESHOLD = 500;

function subscribeToScroll(callback: () => void) {
	const handler = throttle(callback, 100);
	window.addEventListener("scroll", handler, { passive: true });
	return () => {
		handler.cancel();
		window.removeEventListener("scroll", handler);
	};
}

function getScrollSnapshot() {
	return window.scrollY > SCROLL_THRESHOLD;
}

function getServerScrollSnapshot() {
	return false;
}

interface StickyBarProps {
	productName: string;
	price: string;
	show?: boolean;
}

function StickyAddButton() {
	const { pending } = useFormStatus();
	// Was hardcoded English — "Add to bag" shipped on the Slovak storefront, on the
	// mobile buy bar of every product page. Both keys already existed in all twelve
	// locales; the button simply never used them.
	const tCommon = useTranslations("common");
	const tProduct = useTranslations("product");
	const tTyre = useTranslations("tyreSize");
	// A snow chain or sock needs its tyre size first: the bar says what the next step is and takes the customer to it
	// instead of submitting.
	const gate = useTyreSizeGate();
	const holdBack = gate !== null && !gate.complete ? gate : null;
	const look = gateButtonLook(holdBack);

	return (
		<Button
			type={holdBack ? "button" : "submit"}
			onClick={holdBack ? (event) => holdBack.take(event.currentTarget) : undefined}
			size="lg"
			disabled={pending}
			variant={look.variant}
			data-testid="sticky-buy-button"
			className={cn(
				"h-12 min-w-[130px] shrink-0 rounded-xs font-semibold",
				// Override transition to prevent flash on state change
				"transition-none disabled:opacity-100",
				// A held-back label is longer than "Pridať do košíka": it may take two lines but not the room the price
				// needs beside it (without the cap it took 250 px of a 360 px bar and the price wrapped onto two lines).
				holdBack && "max-w-[11rem] px-3",
				look.className,
			)}
		>
			<GateIcon gate={holdBack} className="h-4 w-4 shrink-0" />
			<span className={holdBack && !pending ? HELD_BACK_LABEL : "truncate"}>
				{pending
					? tProduct("addingToCart")
					: holdBack
						? tTyre(gateButtonKey(holdBack))
						: tCommon("addToCart")}
			</span>
		</Button>
	);
}

export function StickyBar({ productName, price, show = false }: StickyBarProps) {
	const scrolledPastThreshold = useSyncExternalStore(
		subscribeToScroll,
		getScrollSnapshot,
		getServerScrollSnapshot,
	);

	// Only show if both conditions are met
	const isVisible = show && scrolledPastThreshold;

	return (
		<div
			className={cn(
				"border-border-subtle bg-surface-card fixed right-0 bottom-0 left-0 z-[var(--z-header)] border-t shadow-xl transition-transform duration-300 md:hidden",
				// Not part of the form's flow: the form spaces its children with `space-y-6`, whose bottom margin
				// lifts a fixed bar off the screen edge by 24px whenever something follows it (the tyre gate's
				// quiet "I know the code" line does). Hidden, 24px of the bar then showed under every phone screen.
				"mb-0!",
				isVisible ? "translate-y-0" : "translate-y-full",
			)}
		>
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
				<div className="min-w-0 flex-1">
					<p className="text-text-secondary truncate text-[0.8125rem]">{productName}</p>
					<p className="text-price-current text-lg leading-tight font-bold tabular-nums">{price}</p>
				</div>
				<StickyAddButton />
			</div>
		</div>
	);
}
