import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { ProductCard, type ProductCardData, type ProductCardPurchase } from "./product-card";

/**
 * How many columns the grid may use, which depends on what shares its row. ONE on a phone,
 * everywhere (owner, 2026-09-24, third pass): these products are chosen on their facts — the
 * maker, the name that carries the car, the code, the price and the lead time — and two cards
 * to a 360px row left each of them 160px, with a photo too small to judge the product by. The
 * photo stays on top and takes the card's whole width. Two columns from 640px.
 *
 * - `home`: the full page width — four columns, five from 1440px, where each card still gets
 *   ~250px (the approved homepage is five by two). Quantity and "Do košíka" side by side.
 * - `listing`: beside the category filter panel — three from 1024px, four from 1440px. The
 *   homepage's five are NOT carried over; beside a panel they would be 190px wide. One
 *   full-width "Do košíka", as the approved category page draws it.
 * - `full`: search and collections, no panel — up to four, with the listing's button.
 */
export type ProductGridColumns = "home" | "listing" | "full";

const COLUMNS: Record<ProductGridColumns, string> = {
	home: "lg:grid-cols-4 min-[90rem]:grid-cols-5",
	listing: "lg:grid-cols-3 min-[90rem]:grid-cols-4",
	full: "md:grid-cols-3 xl:grid-cols-4",
};

const PURCHASE: Record<ProductGridColumns, ProductCardPurchase> = {
	home: "stepper",
	listing: "button",
	full: "button",
};

interface ProductGridProps {
	products: ProductCardData[];
	columns?: ProductGridColumns;
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
export function ProductGrid({ products, groupHeading, columns = "full" }: ProductGridProps) {
	// A category's own listing holds one category: its name on every card said nothing the page
	// heading had not. Where the grid mixes categories — the homepage, search, a parent category,
	// a maker's page — the card names each product's.
	const showCategory = new Set(products.map((product) => product.category?.id ?? null)).size > 1;

	return (
		<div className={cn("grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5", COLUMNS[columns])}>
			{/* Exactly ONE preload. On a phone only the first row is above the fold, yet
			    `priority` on the first four
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
						<h2 className="border-border-default text-text-primary col-span-full mt-4 border-t pt-6 text-lg font-bold tracking-[-0.01em] first:mt-0 first:border-t-0 first:pt-0 sm:text-xl">
							{groupHeading.label}
						</h2>
					)}
					<ProductCard
						product={product}
						priority={index === 0}
						purchase={PURCHASE[columns]}
						showCategory={showCategory}
					/>
				</Fragment>
			))}
		</div>
	);
}
