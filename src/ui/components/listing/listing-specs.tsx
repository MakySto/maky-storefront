import { cn } from "@/lib/utils";

export type ListingSpec = { key: string; label: string; value: string };

/** The spec whose label the CARD supplies, because no attribute carries a name for a combined size. */
export const DIMENSIONS_SPEC_KEY = "dimensions";

/**
 * The few parameters that tell two sets apart, as the shop already prints them: the label in grey on
 * the left, the value in dark text on the right, one line each — the way the product page's table and
 * the configurator's old card read. Up to four rows, one column in a card and a wrapping line of
 * pairs where the card runs wide (the list).
 *
 * Renders nothing for no rows, so a product with no parameters costs no empty block. Server-safe: no
 * state, no hooks.
 */
export function ListingSpecs({ specs, className }: { specs: readonly ListingSpec[]; className?: string }) {
	if (specs.length === 0) return null;
	return (
		<dl
			className={cn(
				"grid grid-cols-1 gap-y-1 text-[0.8125rem] leading-snug group-data-[view=list]/lv:sm:flex group-data-[view=list]/lv:sm:flex-wrap group-data-[view=list]/lv:sm:gap-x-6",
				className,
			)}
			data-testid="listing-specs"
		>
			{specs.map((spec) => (
				<div
					key={spec.key}
					className="flex min-w-0 items-baseline justify-between gap-3 group-data-[view=list]/lv:sm:justify-start group-data-[view=list]/lv:sm:gap-1.5"
				>
					<dt className="text-text-tertiary shrink-0">{spec.label}</dt>
					<dd className="text-text-primary min-w-0 text-right font-medium break-words group-data-[view=list]/lv:sm:text-left">
						{spec.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
