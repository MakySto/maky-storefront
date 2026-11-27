import Link from "next/link";

export interface CategoryShelfLink {
	readonly slug: string;
	readonly label: string;
	readonly href: string;
}

/**
 * A row of links to shelves on the search page: the ones the words name, above the results, or
 * the market's shelves where nothing was found (`lib/search/category-shortcuts.ts`).
 *
 * Renders nothing when there is none to offer. Quiet on purpose: the page's primary action stays
 * the one it had, these are signposts beside it.
 */
export function CategoryShelfLinks({
	heading,
	shelves,
	className = "",
}: {
	/** "Kategórie", "Kategorien": names the row for a reader and for a screen reader. */
	heading: string;
	shelves: readonly CategoryShelfLink[];
	className?: string;
}) {
	if (shelves.length === 0) return null;
	return (
		<nav
			aria-label={heading}
			className={`flex flex-wrap items-center gap-2 ${className}`}
			data-testid="search-category-shelves"
		>
			<span className="text-text-secondary text-sm font-medium">{heading}:</span>
			{shelves.map((shelf) => (
				<Link
					key={shelf.slug}
					href={shelf.href}
					className="border-border-default bg-surface-card text-text-primary hover:border-border-strong hover:bg-surface-muted focus-visible:ring-ring inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
				>
					{shelf.label}
				</Link>
			))}
		</nav>
	);
}
