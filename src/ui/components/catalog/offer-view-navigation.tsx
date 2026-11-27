"use client";

import { type ReactNode, useEffect, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { holdViewChange, isViewChangeUnderWay, subscribeToViewChanges } from "./view-change-store";

/**
 * One view change at a time on a vehicle page.
 *
 * Every control of the list (the year, the maker, the order, the roof) goes to an address the server
 * built for the view the page HAD when it was rendered. While the page for one choice is still on its
 * way, the other controls still hold addresses of the old view, so a second choice made in that moment
 * dropped the first: on the live page a maker chosen and the order changed three seconds later left the
 * address without the maker (2026-11-27). So while one change is under way the others wait, and the list
 * says that it is being replaced.
 *
 * The state is shared by a small store (`view-change-store.ts`) and not a provider: the controls are
 * placed by a server component in different parts of the toolbar, and nothing else has to wrap them.
 */
const never = () => false;

/** True while any control of the page is taking the shopper to another view. */
export function useViewBusy(): boolean {
	return useSyncExternalStore(subscribeToViewChanges, isViewChangeUnderWay, never);
}

/**
 * `go(href)` replaces the address without scrolling, and `busy` is true while this or any other control's
 * change is under way.
 */
export function useViewNavigation(): { busy: boolean; go: (href: string) => void } {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const shared = useViewBusy();

	// A control that leaves the page while its change is under way (the maker select of a list that
	// ends with one maker) releases its hold in the cleanup.
	useEffect(() => (pending ? holdViewChange() : undefined), [pending]);

	return {
		busy: pending || shared,
		// Asked again here and not only through `disabled`: a press that reaches a control in the moment
		// before it is drawn as waiting must not start a second change either.
		go: (href) => {
			if (pending || isViewChangeUnderWay()) return;
			startTransition(() => router.replace(href, { scroll: false }));
		},
	};
}

/**
 * A roof of the list, as a link: an address that can be opened in a new tab, copied and followed by a
 * crawler. A plain press goes through the same shared change as the selects, so it waits for theirs and
 * they wait for it.
 */
export function OfferViewLink({
	href,
	current,
	className,
	children,
}: {
	href: string;
	current: boolean;
	className: string;
	children: ReactNode;
}) {
	const { busy, go } = useViewNavigation();

	return (
		<Link
			href={href}
			scroll={false}
			prefetch={false}
			aria-current={current ? "true" : undefined}
			aria-disabled={busy ? "true" : undefined}
			className={cn(className, busy && "opacity-60")}
			onClick={(event) => {
				// A new tab or window is the browser's to open, with the address as it stands.
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				event.preventDefault();
				go(href);
			}}
		>
			{children}
		</Link>
	);
}

/** The list itself: dimmed, and announced as busy, while the page for the new view is on its way. */
export function OfferViewBusy({ children }: { children: ReactNode }) {
	const busy = useViewBusy();

	return (
		<div aria-busy={busy} className={cn("transition-opacity", busy && "opacity-60")}>
			{children}
		</div>
	);
}
