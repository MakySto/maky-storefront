"use client";

import { useEffect, useRef } from "react";

/**
 * The desktop row's category links, laid out on ONE visible line.
 *
 * The container wraps (`flex-wrap`) and clips (`overflow-hidden`) at the row's height, so a link
 * that no longer fits moves whole onto a second line nobody sees — never half a word, never
 * under the vehicle button. That part is CSS alone and holds before any script runs.
 *
 * What CSS cannot do is take the wrapped links out of reach: they would still take keyboard
 * focus and be read out, invisible. This marks each one `inert` while it sits below the first
 * line. Every category is also in "Všetky kategórie", so nothing becomes unreachable.
 */
export function NavOverflowRow({ className, children }: { className?: string; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const row = ref.current;
		if (!row) return;
		const items = Array.from(row.children) as HTMLElement[];
		const update = () => {
			const top = row.getBoundingClientRect().top;
			for (const item of items) item.inert = item.getBoundingClientRect().top - top > 1;
		};
		update();
		// The row's own width changes with the window; a link's changes when the web font lands.
		const observer = new ResizeObserver(update);
		observer.observe(row);
		for (const item of items) observer.observe(item);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className={className}>
			{children}
		</div>
	);
}
