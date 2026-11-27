import { cn } from "@/lib/utils";

export type ListingSpec = { key: string; label: string; value: string };

/** The spec whose label the CARD supplies, because no attribute carries a name for a combined size. */
export const DIMENSIONS_SPEC_KEY = "dimensions";

/** Likewise the bars of a kit ("4 × 180 cm"), put together from a count and a length. */
export const BARS_SPEC_KEY = "bars";

/** The words of the two combined rows, in the reader's language; every other row keeps its attribute's own name. */
export function withComposedLabels(
	specs: readonly ListingSpec[],
	labels: { dimensions: string; bars: string },
): ListingSpec[] {
	return specs.map((spec) =>
		spec.key === DIMENSIONS_SPEC_KEY
			? { ...spec, label: labels.dimensions }
			: spec.key === BARS_SPEC_KEY
				? { ...spec, label: labels.bars }
				: spec,
	);
}

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
					// In a narrow card a pair that does not fit on one line puts the value on the next one,
					// at the right edge, with both in whole words. It used to keep the label in one piece
					// (`shrink-0`) and cut the value inside a word to fit beside it: "Flügelprofi / l" in the
					// German listing (2026-11-27). `break-words` stays for a single word wider than the card.
					className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 group-data-[view=list]/lv:sm:flex-nowrap group-data-[view=list]/lv:sm:justify-start group-data-[view=list]/lv:sm:gap-1.5"
				>
					<dt className="text-text-tertiary max-w-full break-words group-data-[view=list]/lv:sm:shrink-0">
						{spec.label}
					</dt>
					<dd className="text-text-primary ml-auto max-w-full text-right font-medium break-words group-data-[view=list]/lv:sm:ml-0 group-data-[view=list]/lv:sm:min-w-0 group-data-[view=list]/lv:sm:text-left">
						{spec.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
