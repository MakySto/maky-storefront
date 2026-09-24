import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SubcategoryChip {
	readonly id: string;
	readonly href: string;
	/** The category's full name — the chip's accessible name. */
	readonly name: string;
	/** What the chip shows; `null` for the family's own listing, which reads `allLabel`. */
	readonly label: string | null;
	readonly current: boolean;
}

/**
 * The row of sub-categories under a listing's title: "Všetko", then each sub-category that
 * holds something in this market — by mount for bike carriers, the accessories apart.
 *
 * Plain links to the categories' own pages, so every chip is a real URL with its own title
 * and canonical, and the row works without JavaScript. On a phone it scrolls sideways on one
 * line instead of wrapping into a block that pushes the products down.
 */
export function SubcategoryNav({
	label,
	allLabel,
	chips,
}: {
	label: string;
	/** "Všetko" — the chip for the family's own listing. */
	allLabel: string;
	chips: readonly SubcategoryChip[];
}) {
	return (
		<nav aria-label={label}>
			<ul className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
				{chips.map((chip) => (
					<li key={chip.id} className="shrink-0">
						<Link
							href={chip.href}
							aria-current={chip.current ? "page" : undefined}
							// The full name, so a screen reader hears "Nosiče bicyklov na strechu", not
							// "Na strechu" — and it still contains the visible words (WCAG 2.5.3).
							aria-label={(chip.label ?? allLabel) === chip.name ? undefined : chip.name}
							className={cn(
								"inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
								"focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
								chip.current
									? "border-brand bg-brand text-brand-text"
									: "border-border-default bg-surface-card text-text-secondary hover:border-brand hover:text-text-primary",
							)}
						>
							{chip.label ?? allLabel}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
