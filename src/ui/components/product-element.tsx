import { getTranslations } from "next-intl/server";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { ProductImageWrapper } from "@/ui/atoms/product-image-wrapper";

import type { ProductListItemFragment } from "@/gql/graphql";
import { formatMoneyRange } from "@/lib/utils";
import { productPath } from "@/lib/product-url";
import { publishableProductImage } from "@/lib/product-image";

export async function ProductElement({
	product,
	loading,
	priority,
	locale,
}: { product: ProductListItemFragment } & {
	loading: "eager" | "lazy";
	priority?: boolean;
	/** The market's locale — money is formatted in it, not in the store default. */
	locale: string;
}) {
	// The "no image" GIF some imports carry is not a photo (`lib/product-image.ts`). Without
	// one the tile shows the same localized "no image" state as the listing card, instead of
	// leaving a hole where the picture should be.
	const image = publishableProductImage(product.thumbnail?.url);
	const tProduct = image ? null : await getTranslations({ locale, namespace: "product" });

	return (
		<li data-testid="ProductElement">
			<LinkWithChannel href={productPath(product.slug)} key={product.id} prefetch={false}>
				<div>
					{image ? (
						<ProductImageWrapper
							loading={loading}
							src={image}
							alt={product.thumbnail?.alt ?? ""}
							width={512}
							height={512}
							sizes={"512px"}
							priority={priority}
						/>
					) : (
						<div className="bg-secondary text-text-tertiary flex aspect-square items-center justify-center px-4 text-center text-xs">
							{tProduct?.("noImageAvailable")}
						</div>
					)}
					<div className="mt-2 flex justify-between">
						<div>
							<h3 className="mt-1 text-sm font-semibold text-neutral-900">{product.name}</h3>
							<p className="mt-1 text-sm text-neutral-500" data-testid="ProductElement_Category">
								{product.category?.name}
							</p>
						</div>
						<p className="mt-1 text-sm font-medium text-neutral-900" data-testid="ProductElement_PriceRange">
							{formatMoneyRange(
								{
									start: product?.pricing?.priceRange?.start?.gross,
									stop: product?.pricing?.priceRange?.stop?.gross,
								},
								locale,
							)}
						</p>
					</div>
				</div>
			</LinkWithChannel>
		</li>
	);
}
