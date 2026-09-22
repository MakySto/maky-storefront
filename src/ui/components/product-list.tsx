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
			{products.map((product, index) => (
				<ProductElement
					key={product.id}
					product={product}
					locale={locale}
					priority={index < 2}
					loading={index < 3 ? "eager" : "lazy"}
				/>
			))}
		</ul>
	);
};
