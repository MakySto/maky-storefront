"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { ShoppingBag } from "lucide-react";
import { throttle } from "lodash-es";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";

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

	return (
		<Button
			type="submit"
			size="lg"
			disabled={pending}
			className={cn(
				"min-w-[130px] shrink-0",
				// Override transition to prevent flash on state change
				"transition-none disabled:opacity-100",
			)}
		>
			<ShoppingBag className="h-4 w-4" />
			{pending ? "Adding..." : "Add to bag"}
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
				"bg-background fixed right-0 bottom-0 left-0 z-[var(--z-header)] border-t transition-transform duration-300 md:hidden",
				isVisible ? "translate-y-0" : "translate-y-full",
			)}
		>
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{productName}</p>
					<p className="text-muted-foreground text-sm">{price}</p>
				</div>
				<StickyAddButton />
			</div>
		</div>
	);
}
