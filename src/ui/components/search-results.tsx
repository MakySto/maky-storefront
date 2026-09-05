import Link from "next/link";
import type { SearchProduct } from "@/lib/search";
import { localeConfig } from "@/config/locale";
import { productHref } from "@/lib/product-url";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

interface SearchResultsProps {
	products: SearchProduct[];
	channel: string;
}

/**
 * Renders search results from any search provider.
 * Uses the common SearchProduct type for provider independence.
 */
export function SearchResults({ products, channel }: SearchResultsProps) {
	if (products.length === 0) {
		return null;
	}

	return (
		<ul role="list" className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
			{products.map((product, index) => (
				<li key={product.id}>
					<SearchResultCard product={product} channel={channel} priority={index < 2} />
				</li>
			))}
		</ul>
	);
}

function SearchResultCard({
	product,
	channel,
	priority,
}: {
	product: SearchProduct;
	channel: string;
	priority?: boolean;
}) {
	const formattedPrice = new Intl.NumberFormat(localeConfig.default, {
		style: "currency",
		currency: product.currency,
	}).format(product.price);

	return (
		<Link
			href={productHref(channel, product.slug)}
			className="hover:border-foreground/20 group border-border bg-card block overflow-hidden rounded-lg border transition-colors"
		>
			{/* Image */}
			<div className="bg-muted relative aspect-square overflow-hidden">
				{product.thumbnailUrl ? (
					<ResilientProductImage
						src={product.thumbnailUrl}
						alt={product.thumbnailAlt || product.name}
						fill
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
						className="object-cover transition-transform duration-300 group-hover:scale-105"
						priority={priority}
					/>
				) : (
					<div className="text-muted-foreground flex h-full items-center justify-center">No image</div>
				)}
			</div>

			{/* Content */}
			<div className="p-4">
				{product.categoryName && <p className="text-muted-foreground mb-1 text-xs">{product.categoryName}</p>}
				<h3 className="text-foreground leading-tight font-medium group-hover:underline">{product.name}</h3>
				<p className="text-foreground mt-2 font-semibold">{formattedPrice}</p>
			</div>
		</Link>
	);
}
