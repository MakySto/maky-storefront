"use client";

import { Suspense } from "react";
import {
	ListingEmptyState,
	ListingToolbar,
	listingResultCount,
	ProductGrid,
	useProductFilters,
	type ProductCardData,
} from "@/ui/components/plp";
import { Pagination } from "@/ui/components/pagination";

/**
 * A brand's products: the count, the order and the grid, paged by Saleor. Everything the maker
 * sells in this market — the brand page is a way into the catalogue, not a filter panel.
 */
export function BrandProducts({
	products,
	totalCount,
	localeDropped,
	pageInfo,
}: {
	products: ProductCardData[];
	totalCount: number;
	localeDropped: number;
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor?: string | null;
		endCursor?: string | null;
	};
}) {
	const {
		filteredProducts,
		selectedColors,
		selectedSizes,
		sortValue,
		activeFilters,
		handleSortChange,
		handleRemoveFilter,
		handleClearFilters,
	} = useProductFilters({ products });

	const resultCount = listingResultCount({
		totalCount,
		renderedCount: filteredProducts.length,
		localeDropped,
		hasClientSideFilters: selectedColors.length > 0 || selectedSizes.length > 0,
	});

	return (
		<div className="max-w-page mx-auto w-full px-4 pt-6 pb-16 sm:px-6 lg:px-8">
			<ListingToolbar
				resultCount={resultCount}
				sortValue={sortValue}
				onSortChange={handleSortChange}
				activeFilters={activeFilters}
				onRemoveFilter={handleRemoveFilter}
				panel={null}
			/>
			{filteredProducts.length > 0 ? (
				<ProductGrid products={filteredProducts} columns="full" />
			) : (
				<ListingEmptyState
					totalCount={totalCount}
					localeDropped={localeDropped}
					hasActiveFilters={activeFilters.length > 0}
					onClearFilters={handleClearFilters}
				/>
			)}
			<Suspense fallback={null}>
				<Pagination pageInfo={pageInfo} />
			</Suspense>
		</div>
	);
}
