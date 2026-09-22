import { ProductElement } from "./product-element";
import { type ProductListItemFragment } from "@/gql/graphql";

export const ProductList = ({
	products,
	locale,
}: {
	products: readonly ProductListItemFragment[];
	/** The market's locale, for the prices. */
	locale: string;
}) => {
	return (
		<ul
			role="list"
			data-testid="ProductList"
			className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
		>
			{/* Only the homepage renders this list, below the hero and the category grid, so
			    none of its images is above the fold: preloading two of them only took
			    bandwidth from what is. */}
			{products.map((product) => (
				<ProductElement key={product.id} product={product} locale={locale} loading="lazy" />
			))}
		</ul>
	);
};
