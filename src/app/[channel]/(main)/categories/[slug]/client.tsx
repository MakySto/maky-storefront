"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { BrandFacet, VolumeFacet } from "@/lib/listing/category-facets";
import { parseBrandParam, volumeBand } from "@/lib/listing/facet-params";
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
	/** The makers on this shelf, with counts (`getCategoryFacets`); empty = no maker filter. */
	brandFacets?: readonly BrandFacet[];
	/** The volume bands on this shelf, with counts; empty = no volume filter. */
	volumeFacets?: readonly VolumeFacet[];
}

/**
 * The maker and volume filters in the URL (`?brand=thule,menabo`, `?volume=300-400`). Like the
 * price, each is a Saleor filter over the whole listing: a change is a new list from its first
 * page, so the page position is dropped.
 */
function useFacetFilters() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const selectedBrands = useMemo(() => parseBrandParam(searchParams.get("brand")), [searchParams]);
	const selectedVolume = volumeBand(searchParams.get("volume"))?.value ?? null;

	const push = useCallback(
		(mutate: (params: URLSearchParams) => void) => {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("cursor");
			params.delete("direction");
			mutate(params);
			const query = params.toString();
			router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
		},
		[router, pathname, searchParams],
	);

	const toggleBrand = useCallback(
		(slug: string) =>
			push((params) => {
				const next = selectedBrands.includes(slug)
					? selectedBrands.filter((existing) => existing !== slug)
					: [...selectedBrands, slug];
				if (next.length > 0) params.set("brand", next.join(","));
				else params.delete("brand");
			}),
		[push, selectedBrands],
	);

	const setVolume = useCallback(
		(value: string | null) =>
			push((params) => {
				if (value) params.set("volume", value);
				else params.delete("volume");
			}),
		[push],
	);

	return { selectedBrands, selectedVolume, toggleBrand, setVolume };
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
	brandFacets = [],
	volumeFacets = [],
}: CategoryPageClientProps) {
	const t = useTranslations("plp");
	const facetFilters = useFacetFilters();
	const {
		filteredProducts,
		priceRanges,
		selectedColors,
		selectedSizes,
		selectedPriceRange,
		sortValue,
		activeFilters: baseActiveFilters,
		handlePriceRangeChange,
		handleSortChange,
		handleRemoveFilter: removeBaseFilter,
		handleClearFilters,
	} = useProductFilters({ products, priceFilter });

	const volumeLabel = useCallback(
		(value: string) => {
			const band = volumeBand(value);
			if (!band) return value;
			if (!("min" in band)) return t("volumeUpTo", { max: band.max });
			if (!("max" in band)) return t("volumeOver", { min: band.min });
			return t("volumeBetween", { min: band.min, max: band.max });
		},
		[t],
	);

	// The maker and volume chips join the price's, named as the panel names them.
	const activeFilters = useMemo(
		() => [
			...baseActiveFilters,
			...facetFilters.selectedBrands.map((slug) => ({
				key: "brand",
				label: t("brand"),
				value: brandFacets.find((brand) => brand.slug === slug)?.name ?? slug,
			})),
			...(facetFilters.selectedVolume
				? [{ key: "volume", label: t("volume"), value: volumeLabel(facetFilters.selectedVolume) }]
				: []),
		],
		[
			baseActiveFilters,
			facetFilters.selectedBrands,
			facetFilters.selectedVolume,
			brandFacets,
			t,
			volumeLabel,
		],
	);

	const handleRemoveFilter = useCallback(
		(key: string, value: string) => {
			if (key === "brand") {
				const slug = brandFacets.find((brand) => brand.name === value)?.slug ?? value;
				facetFilters.toggleBrand(slug);
			} else if (key === "volume") {
				facetFilters.setVolume(null);
			} else {
				removeBaseFilter(key, value);
			}
		},
		[brandFacets, facetFilters, removeBaseFilter],
	);

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

	const hasPanel =
		Boolean(categoryLinks?.length) ||
		priceRanges.length > 0 ||
		brandFacets.length > 0 ||
		volumeFacets.length > 0;
	const panel = hasPanel
		? {
				categoryLinks,
				allLabel: t("allInCategory"),
				priceRanges,
				selectedPriceRange,
				onPriceRangeChange: handlePriceRangeChange,
				brands: brandFacets,
				selectedBrands: facetFilters.selectedBrands,
				onBrandToggle: facetFilters.toggleBrand,
				volumes: volumeFacets.map((facet) => ({ ...facet, label: volumeLabel(facet.value) })),
				selectedVolume: facetFilters.selectedVolume,
				onVolumeChange: facetFilters.setVolume,
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
