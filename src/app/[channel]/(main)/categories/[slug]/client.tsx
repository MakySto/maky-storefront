"use client";

import { Suspense } from "react";
import {
	FilterBar,
	ListingEmptyState,
	listingResultCount,
	ProductGrid,
	useProductFilters,
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
}: CategoryPageClientProps) {
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
	} = useProductFilters({ products });

	const resultCount = listingResultCount({
		totalCount,
		renderedCount: filteredProducts.length,
		localeDropped,
		hasClientSideFilters: selectedColors.length > 0 || selectedSizes.length > 0,
	});

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
						<ProductGrid products={filteredProducts} />
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
