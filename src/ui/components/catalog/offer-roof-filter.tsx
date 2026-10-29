"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CARD_GRID } from "@/ui/components/listing/card-layout";

export type RoofFilterItem = { id: string; roof: string | null; node: ReactNode };
export type RoofFilterGroup = { key: string; label: string; count: number };

/**
 * One list of sets with a way to narrow it to one roof.
 *
 * A generation page lists every set of the generation, and the roofs differ in how the bars are
 * mounted, so a shopper has to be able to say theirs. This is a view over the same list, not a
 * different page: it changes nothing in the address, writes nothing to the garage and never
 * touches the active vehicle. The cards are server-rendered and arrive as nodes, so all of them
 * are in the HTML; the filter only chooses which ones are shown, and "all" is the starting state.
 *
 * The chips are the shop's own pill style (as the category chips above its listings).
 */
export function RoofFilteredList({
	items,
	groups,
	labels,
}: {
	items: readonly RoofFilterItem[];
	groups: readonly RoofFilterGroup[];
	labels: { group: string; all: string };
}) {
	const [active, setActive] = useState<string | null>(null);
	const shown = active === null ? items : items.filter((item) => (item.roof ?? "none") === active);

	const chip = (selected: boolean) =>
		cn(
			"inline-flex h-10 items-center justify-center gap-2 rounded-xs border px-4 text-sm font-semibold whitespace-nowrap shadow-xs transition-colors",
			"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
			selected
				? "border-brand bg-brand text-brand-text"
				: "border-border-default bg-surface-card text-text-primary hover:border-brand hover:text-brand",
		);

	return (
		<>
			<div
				role="group"
				aria-label={labels.group}
				className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
			>
				<button
					type="button"
					aria-pressed={active === null}
					onClick={() => setActive(null)}
					className={chip(active === null)}
				>
					{labels.all}
					<span className="text-[0.8125rem] font-medium tabular-nums opacity-80">{items.length}</span>
				</button>
				{groups.map((group) => (
					<button
						key={group.key}
						type="button"
						aria-pressed={active === group.key}
						onClick={() => setActive(group.key)}
						className={chip(active === group.key)}
					>
						{group.label}
						<span className="text-[0.8125rem] font-medium tabular-nums opacity-80">{group.count}</span>
					</button>
				))}
			</div>
			<ul className={`${CARD_GRID} mt-4`}>
				{shown.map((item) => (
					<FragmentKeyed key={item.id}>{item.node}</FragmentKeyed>
				))}
			</ul>
		</>
	);
}

function FragmentKeyed({ children }: { children: ReactNode }) {
	return <>{children}</>;
}
