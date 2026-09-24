import { Fragment } from "react";
import { ProductCard, type ProductCardData } from "./product-card";

interface ProductGridProps {
	products: ProductCardData[];
	/**
	 * A heading across the grid before one product — where a category's accessories begin
	 * in its recommended order ("Príslušenstvo a náhradné diely").
	 */
	groupHeading?: { beforeProductId: string; label: string } | null;
}

/**
 * Four columns on a wide desktop, not three.
 *
 * At 1920px the old three-column grid produced enormous cards and stranded the
 * fourth product alone on its own row. The step to four also matters for what is
 * coming: this category holds four products today and around seventy once the
 * remaining catalogue lands.
 */
export function ProductGrid({ products, groupHeading }: ProductGridProps) {
	return (
		// One column of compact rows on a phone, then 2, 3 and — from 1280 px, where the
		// listing container gives each card ~290 px, enough for the stepper beside the button
		// — 4 columns.
		<div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
			{/* Exactly ONE preload. The grid is single-column on a phone, so only the
			    first card is above the fold there, yet `priority` on the first four
			    emitted four high-priority preloads that fought over the connection —
			    worth ~2.9 s of LCP load delay on mobile.

			    The rest stay lazy. `loading="eager"` is NOT the middle ground it looks
			    like: next/image preloads every non-lazy image, so eager produced exactly
			    the same four preload links under a different name — checked in the served
			    HTML, not assumed. Lazy images already inside the initial viewport begin
			    loading during first layout anyway, so the wider first rows lose nothing. */}
			{products.map((product, index) => (
				<Fragment key={product.id}>
					{groupHeading?.beforeProductId === product.id && (
						// Spans the row, so the accessories start on a row of their own. No rule above it
						// when it opens the page (a page of nothing but accessories).
						<h2 className="border-border-subtle text-text-primary col-span-full mt-4 border-t pt-6 text-lg font-semibold tracking-[-0.01em] first:mt-0 first:border-t-0 first:pt-0 sm:text-xl">
							{groupHeading.label}
						</h2>
					)}
					<ProductCard product={product} priority={index === 0} />
				</Fragment>
			))}
		</div>
	);
}
