import { ProductCard, type ProductCardData } from "./product-card";

interface ProductGridProps {
	products: ProductCardData[];
}

/**
 * Four columns on a wide desktop, not three.
 *
 * At 1920px the old three-column grid produced enormous cards and stranded the
 * fourth product alone on its own row. The step to four also matters for what is
 * coming: this category holds four products today and around seventy once the
 * remaining catalogue lands.
 */
export function ProductGrid({ products }: ProductGridProps) {
	return (
		<div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 2xl:grid-cols-4">
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
				<ProductCard key={product.id} product={product} priority={index === 0} />
			))}
		</div>
	);
}
