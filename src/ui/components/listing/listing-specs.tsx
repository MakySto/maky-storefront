import { cn } from "@/lib/utils";

export type ListingSpec = { key: string; label: string; value: string };

/** The spec whose label the CARD supplies, because no attribute carries a name for a combined size. */
export const DIMENSIONS_SPEC_KEY = "dimensions";

/**
 * The few parameters that tell two sets apart, as label over value.
 *
 * A grid of up to four, two to a row in a card and four to a row where the card runs wide (the list).
 * Renders nothing for no rows, so a product with no parameters costs no empty block. Server-safe: no
 * state, no hooks.
 */
export function ListingSpecs({ specs, className }: { specs: readonly ListingSpec[]; className?: string }) {
	if (specs.length === 0) return null;
	return (
		<dl
			className={cn(
				"grid grid-cols-2 gap-x-4 gap-y-2 group-data-[view=list]/lv:sm:grid-cols-4",
				className,
			)}
			data-testid="listing-specs"
		>
			{specs.map((spec) => (
				<div key={spec.key} className="min-w-0">
					<dt className="text-text-tertiary text-[0.6875rem] leading-tight font-medium tracking-[0.04em] uppercase">
						{spec.label}
					</dt>
					<dd className="text-text-primary mt-0.5 text-sm leading-snug font-semibold break-words">
						{spec.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
