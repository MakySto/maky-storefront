import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Saleor's `Product.rating`, as stars plus the number.
 *
 * Renders NOTHING when there is no rating. That is the normal case right now:
 * the field exists in the schema but is null across the whole catalogue,
 * because nothing writes to it — Saleor ships no review system and CFM does not
 * publish a score. Empty stars would read as "rated zero", which is a claim
 * about the product rather than an absence of data.
 *
 * Half-stars are drawn by clipping a filled star, so a 4.3 does not round up to
 * something the shop cannot support.
 */
export function StarRating({
	rating,
	count,
	className,
}: {
	rating?: number | null;
	count?: number | null;
	className?: string;
}) {
	if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) return null;

	const clamped = Math.min(Math.max(rating, 0), 5);
	const label = clamped.toFixed(1).replace(".", ",");

	return (
		<span
			className={cn("inline-flex items-center gap-1.5", className)}
			// One accessible string beats five decorative stars read out in turn.
			aria-label={`${label} / 5`}
		>
			<span className="flex items-center gap-0.5" aria-hidden>
				{[0, 1, 2, 3, 4].map((i) => {
					const fill = Math.min(Math.max(clamped - i, 0), 1);
					return (
						<span key={i} className="relative inline-block h-3.5 w-3.5">
							<Star className="text-border-strong absolute inset-0 h-3.5 w-3.5" />
							{fill > 0 && (
								<span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
									<Star className="text-status-warning h-3.5 w-3.5 fill-current" />
								</span>
							)}
						</span>
					);
				})}
			</span>
			<span className="text-text-secondary text-xs tabular-nums">
				{label}
				{typeof count === "number" && count > 0 && <span className="text-text-tertiary"> ({count})</span>}
			</span>
		</span>
	);
}
