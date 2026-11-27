"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * The list of a breadcrumb trail on a screen too narrow for all of it: one line, scrolled to its end.
 *
 * The end is where the page the shopper is on and the step back from it are; what is cut off is the way
 * back to the shelf, one swipe away. While part of the trail is out of sight on the left its edge fades,
 * which is what tells a thumb there is more. On a screen that fits the whole trail nothing moves and
 * nothing fades. The server renders the trail from its start; this only moves the scroll position, so a
 * visitor without scripts still has every step.
 */
export function BreadcrumbScroller({ className, children }: { className?: string; children: ReactNode }) {
	const ref = useRef<HTMLOListElement>(null);
	const [hiddenLeft, setHiddenLeft] = useState(false);

	useLayoutEffect(() => {
		const list = ref.current;
		if (!list) return;
		const sync = () => setHiddenLeft(list.scrollLeft > 1);
		list.scrollLeft = list.scrollWidth;
		sync();
		list.addEventListener("scroll", sync, { passive: true });
		return () => list.removeEventListener("scroll", sync);
	}, []);

	return (
		<ol
			ref={ref}
			className={className}
			data-hidden-left={hiddenLeft ? "true" : undefined}
			style={
				hiddenLeft
					? {
							maskImage: "linear-gradient(to right, transparent, black 1.75rem)",
							WebkitMaskImage: "linear-gradient(to right, transparent, black 1.75rem)",
						}
					: undefined
			}
		>
			{children}
		</ol>
	);
}
