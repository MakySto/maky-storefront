"use client";

import type { ReactNode } from "react";
import { LayoutGridIcon, ListIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useListingView, type ListingView } from "./view-preference";

/**
 * The root of a listing that can be a grid or a list.
 *
 * It only publishes the choice as `data-view` on a `group/lv` element. The cards — server or client
 * components, it makes no difference — answer with `group-data-[view=list]/lv:` variants, so the
 * layout switches in CSS without re-rendering a single card and without any card needing to know
 * the preference. Outside this root a card keeps its grid layout, which is why the homepage's
 * product rows are untouched.
 */
export function ListingViewRoot({ children, className }: { children: ReactNode; className?: string }) {
	const [view] = useListingView();
	return (
		<div data-view={view} className={cn("group/lv", className)}>
			{children}
		</div>
	);
}

const OPTIONS: readonly { view: ListingView; Icon: typeof LayoutGridIcon }[] = [
	{ view: "grid", Icon: LayoutGridIcon },
	{ view: "list", Icon: ListIcon },
];

export type ListingViewLabels = { group: string; grid: string; list: string };

/**
 * "Mriežka / Zoznam". Two native buttons in a labelled group: focusable, operable with Enter and
 * Space, and each says its state with `aria-pressed`. The words arrive as props so the toggle is the
 * same component on a server-rendered page and in a client toolbar, and needs no translation
 * context. The icon is decoration: the words are always in the DOM (visible from `sm`, screen-reader
 * only below), so assistive technology gets the same names a sighted reader gets.
 */
export function ListingViewToggle({ labels, className }: { labels: ListingViewLabels; className?: string }) {
	const [view, setView] = useListingView();

	return (
		<div
			role="group"
			aria-label={labels.group}
			className={cn("border-border-default bg-surface-card inline-flex rounded-xs border p-0.5", className)}
		>
			{OPTIONS.map(({ view: option, Icon }) => {
				const active = view === option;
				return (
					<button
						key={option}
						type="button"
						aria-pressed={active}
						onClick={() => setView(option)}
						className={cn(
							"focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-[0.1875rem] px-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
							active
								? "bg-surface-secondary text-text-primary ring-border-strong ring-1 ring-inset"
								: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
						)}
					>
						<Icon className="h-4 w-4" aria-hidden="true" />
						<span className="sr-only sm:not-sr-only">{labels[option]}</span>
					</button>
				);
			})}
		</div>
	);
}
