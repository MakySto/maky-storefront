import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";

/**
 * The two-way switch of a listing that can be narrowed to what fits the shopper: "for my car" | "all vehicles" on a
 * roof-rack shelf, "for my tyres" | "all chains" on the snow-chain shelf.
 *
 * The selected side is filled and the other is plain, in two different colours (green for the list that is checked
 * against what the shopper told us, the brand's own for "all"), so a glance says which list this is without reading a
 * sentence. A real link on each side: the unselected one switches, the selected one is `aria-current` and goes
 * nowhere new. Both are URLs, so the state is shareable and survives a reload.
 *
 * One component for both, so the two filters cannot drift into two different controls.
 */
export function ListingModeSwitch({
	current,
	narrowedHref,
	allHref,
	groupLabel,
	narrowedLabel,
	allLabel,
	icon: Icon,
	testId,
}: {
	current: "narrowed" | "all";
	narrowedHref: string;
	allHref: string;
	groupLabel: string;
	narrowedLabel: string;
	allLabel: string;
	icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
	testId: string;
}) {
	// A label may wrap (and the switch shrinks to its row) where two of them do not fit side by side: on a 320px phone,
	// or in a language whose words are longer than the Slovak ones. Where they fit, nothing differs from one line.
	const segment =
		"inline-flex min-h-10 items-center justify-center gap-2 px-3 py-1.5 text-center text-sm leading-tight font-semibold transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-hidden sm:px-4";
	return (
		<div
			role="group"
			aria-label={groupLabel}
			data-testid={testId}
			className="border-border-default bg-surface-card inline-flex max-w-full overflow-hidden rounded-xs border"
		>
			<LinkWithChannel
				href={narrowedHref}
				aria-current={current === "narrowed" ? "true" : undefined}
				className={cn(
					segment,
					current === "narrowed" ? "bg-cta text-cta-text" : "text-text-primary hover:bg-surface-muted",
				)}
			>
				<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
				{narrowedLabel}
			</LinkWithChannel>
			<LinkWithChannel
				href={allHref}
				aria-current={current === "all" ? "true" : undefined}
				className={cn(
					segment,
					"border-border-default border-l",
					current === "all" ? "bg-brand text-brand-text" : "text-text-primary hover:bg-surface-muted",
				)}
			>
				{allLabel}
			</LinkWithChannel>
		</div>
	);
}
