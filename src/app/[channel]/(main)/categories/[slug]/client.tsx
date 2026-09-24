"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
	FilterBar,
	ListingEmptyState,
	listingResultCount,
	ProductGrid,
	useProductFilters,
	type PriceFilter,
	type ProductCardData,
} from "@/ui/components/plp";
import { Pagination } from "@/ui/components/pagination";

interface CategoryPageClientProps {
	products: ProductCardData[];
	totalCount: number;
	localeDropped: number;
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor?: string | null;
		endCursor?: string | null;
	};
	/** The price filter's bands for this category, or none to offer. */
	priceFilter?: PriceFilter | null;
	/**
	 * The accessories and spare parts on this page, when the listing is in its recommended
	 * order and the category also holds main products — the grid heads them.
	 */
	accessoryIds?: readonly string[];
	/**
	 * The vehicle filter narrowed this listing to nothing. Its own panel above says so and
	 * offers the ways on; a second "no products" line and an idle toolbar would only
	 * contradict it.
	 */
	vehicleFilterEmpty?: boolean;
}

function PaginationSkeleton() {
	return (
		<nav className="flex items-center justify-center gap-x-4 px-4 pt-12">
			<span className="bg-surface-muted h-10 w-24 animate-pulse rounded-sm" />
			<span className="bg-surface-muted h-10 w-24 animate-pulse rounded-sm" />
		</nav>
	);
}

export function CategoryPageClient({
	products,
	totalCount,
	localeDropped,
	pageInfo,
	priceFilter = null,
	accessoryIds = [],
	vehicleFilterEmpty = false,
}: CategoryPageClientProps) {
	const t = useTranslations("plp");
	const {
		filteredProducts,
		colorOptions,
		sizeOptions,
		priceRanges,
		selectedColors,
		selectedSizes,
		selectedPriceRange,
		sortValue,
		activeFilters,
		handleColorToggle,
		handleSizeToggle,
		handlePriceRangeChange,
		handleSortChange,
		handleRemoveFilter,
		handleClearFilters,
	} = useProductFilters({ products, priceFilter });

	const resultCount = listingResultCount({
		totalCount,
		renderedCount: filteredProducts.length,
		localeDropped,
		hasClientSideFilters: selectedColors.length > 0 || selectedSizes.length > 0,
	});

	const groupHeading = useMemo(() => {
		const accessories = new Set(accessoryIds);
		const first = filteredProducts.find((product) => accessories.has(product.id));
		return first ? { beforeProductId: first.id, label: t("accessoriesHeading") } : null;
	}, [accessoryIds, filteredProducts, t]);

	if (vehicleFilterEmpty && filteredProducts.length === 0) return null;

	return (
		<>
			<FilterBar
				resultCount={resultCount}
				sortValue={sortValue}
				onSortChange={handleSortChange}
				colorOptions={colorOptions}
				sizeOptions={sizeOptions}
				priceRanges={priceRanges}
				selectedColors={selectedColors}
				selectedSizes={selectedSizes}
				selectedPriceRange={selectedPriceRange}
				onColorToggle={handleColorToggle}
				onSizeToggle={handleSizeToggle}
				onPriceRangeChange={handlePriceRangeChange}
				activeFilters={activeFilters}
				onRemoveFilter={handleRemoveFilter}
				onClearFilters={handleClearFilters}
			/>
			<div className="w-full">
				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{filteredProducts.length > 0 ? (
						<ProductGrid products={filteredProducts} groupHeading={groupHeading} />
					) : (
						<ListingEmptyState
							totalCount={totalCount}
							localeDropped={localeDropped}
							hasActiveFilters={activeFilters.length > 0}
							onClearFilters={handleClearFilters}
						/>
					)}
					<Suspense fallback={<PaginationSkeleton />}>
						<Pagination pageInfo={pageInfo} />
					</Suspense>
				</div>
			</div>
		</>
	);
}
