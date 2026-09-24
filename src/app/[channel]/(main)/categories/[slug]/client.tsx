"use client";

import { Suspense, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
	ListingEmptyState,
	ListingFilterPanel,
	ListingToolbar,
	listingResultCount,
	ProductGrid,
	useProductFilters,
	type PriceFilter,
	type ProductCardData,
	type SubcategoryChip,
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
	/** The category family for the side panel, "Všetko" first, with each one's count. */
	categoryLinks?: readonly SubcategoryChip[] | null;
}

function PaginationSkeleton() {
	return (
		<nav className="flex items-center justify-center gap-x-4 px-4 pt-12">
			<span className="bg-surface-muted h-11 w-28 animate-pulse rounded-xs" />
			<span className="bg-surface-muted h-11 w-28 animate-pulse rounded-xs" />
		</nav>
	);
}

/**
 * The listing below the category banner (premium redesign 2026-09): the filter panel on the
 * left of a wide screen, the count, the order and the grid on the right — four columns from
 * 1440px, three below, two on a tablet, one on a phone, where the filters open in a sheet.
 */
export function CategoryPageClient({
	products,
	totalCount,
	localeDropped,
	pageInfo,
	priceFilter = null,
	accessoryIds = [],
	vehicleFilterEmpty = false,
	categoryLinks = null,
}: CategoryPageClientProps) {
	const t = useTranslations("plp");
	const {
		filteredProducts,
		priceRanges,
		selectedColors,
		selectedSizes,
		selectedPriceRange,
		sortValue,
		activeFilters,
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

	const hasPanel = Boolean(categoryLinks?.length) || priceRanges.length > 0;
	const panel = hasPanel
		? {
				categoryLinks,
				allLabel: t("allInCategory"),
				priceRanges,
				selectedPriceRange,
				onPriceRangeChange: handlePriceRangeChange,
				hasActiveFilters: activeFilters.length > 0,
				onClearFilters: handleClearFilters,
			}
		: null;

	return (
		<div className="max-w-page mx-auto w-full px-4 pt-6 pb-16 sm:px-6 lg:px-8">
			<div
				className={
					hasPanel
						? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-10"
						: ""
				}
			>
				{panel && (
					<aside className="hidden lg:block">
						{/* Below the sticky header, never under it. */}
						<div className="border-border-subtle bg-surface-card sticky top-[calc(var(--header-offset)+1.25rem)] rounded-sm border px-5 pt-5 pb-1 shadow-xs">
							<ListingFilterPanel {...panel} />
						</div>
					</aside>
				)}
				<div className="min-w-0">
					<ListingToolbar
						resultCount={resultCount}
						sortValue={sortValue}
						onSortChange={handleSortChange}
						activeFilters={activeFilters}
						onRemoveFilter={handleRemoveFilter}
						panel={panel}
					/>
					{filteredProducts.length > 0 ? (
						<ProductGrid
							products={filteredProducts}
							groupHeading={groupHeading}
							columns={hasPanel ? "listing" : "full"}
						/>
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
		</div>
	);
}
