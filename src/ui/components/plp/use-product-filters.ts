"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { SortOption, ActiveFilter } from "./filter-bar";
import type { ProductCardData } from "./product-card";
import {
	extractColorOptions,
	extractSizeOptions,
	extractCategoryOptions,
	filterProducts,
	buildActiveFilters,
	sortProductsClientSide,
	type CategoryOption,
} from "./filter-utils";
import { priceBandFormatter, priceRangeLabel, type PriceFilter } from "./price-ranges";

/** The orders the listing offers; anything else in the URL reads as the default one. */
const SORT_OPTIONS: readonly SortOption[] = ["featured", "newest", "price_asc", "price_desc"];

/** Query parameters that position a page. Any change to the filters or the order starts over. */
const PAGE_POSITION_PARAMS = ["cursor", "direction"] as const;

interface UseProductFiltersOptions {
	products: ProductCardData[];
	/** Categories resolved from URL slugs (server-side) for active filter display */
	resolvedCategories?: Array<{ slug: string; id: string; name: string }>;
	/** Whether to include category filter (only for /products page) */
	enableCategoryFilter?: boolean;
	/**
	 * The listing's price bands and currency (`getCategoryPriceBands`). Without them the price
	 * filter is not offered: there is no honest band to offer.
	 */
	priceFilter?: PriceFilter | null;
}

interface UseProductFiltersResult {
	// Filtered/sorted products
	filteredProducts: ProductCardData[];

	// Filter options for UI
	categoryOptions: CategoryOption[];
	colorOptions: Array<{ name: string; count: number; hex?: string }>;
	sizeOptions: Array<{ name: string; count: number }>;
	priceRanges: ReadonlyArray<{ label: string; value: string; count: number }>;

	// Selected filter values
	selectedCategories: string[];
	selectedColors: string[];
	selectedSizes: string[];
	selectedPriceRange: string | null;
	sortValue: SortOption;

	// Active filters for display
	activeFilters: ActiveFilter[];

	// Handlers
	handleCategoryToggle: (slug: string) => void;
	handleColorToggle: (color: string) => void;
	handleSizeToggle: (size: string) => void;
	handlePriceRangeChange: (range: string | null) => void;
	handleSortChange: (sort: SortOption) => void;
	handleRemoveFilter: (key: string, value: string) => void;
	handleClearFilters: () => void;
}

/**
 * Custom hook for product filtering and sorting logic.
 * Consolidates filter state management, URL synchronization, and filter application.
 *
 * Server-side filters: categories, price (via URL params -> GraphQL)
 * Client-side filters: colors, sizes (via JavaScript filtering)
 */
export function useProductFilters({
	products,
	resolvedCategories = [],
	enableCategoryFilter = false,
	priceFilter = null,
}: UseProductFiltersOptions): UseProductFiltersResult {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const locale = useLocale();
	const t = useTranslations("plp");

	// Parse current filters from URL
	const selectedCategories = useMemo(
		() => (enableCategoryFilter ? searchParams.get("categories")?.split(",").filter(Boolean) || [] : []),
		[searchParams, enableCategoryFilter],
	);
	const selectedColors = useMemo(
		() => searchParams.get("colors")?.split(",").filter(Boolean) || [],
		[searchParams],
	);
	const selectedSizes = useMemo(
		() => searchParams.get("sizes")?.split(",").filter(Boolean) || [],
		[searchParams],
	);
	const selectedPriceRange = searchParams.get("price") || null;
	const requestedSort = searchParams.get("sort") as SortOption | null;
	const sortValue: SortOption =
		requestedSort && SORT_OPTIONS.includes(requestedSort) ? requestedSort : "featured";

	// Update URL with new filters (triggers server re-fetch for server-side filters)
	const updateFilters = useCallback(
		(updates: {
			categories?: string[];
			colors?: string[];
			sizes?: string[];
			price?: string | null;
			sort?: string;
		}) => {
			const params = new URLSearchParams(searchParams.toString());
			// A new filter or order is a new list: page 3 of the old one means nothing in it, and
			// a cursor from one order handed to Saleor under another is an error, not a page.
			for (const key of PAGE_POSITION_PARAMS) params.delete(key);

			if (updates.categories !== undefined) {
				if (updates.categories.length > 0) {
					params.set("categories", updates.categories.join(","));
				} else {
					params.delete("categories");
				}
			}

			if (updates.colors !== undefined) {
				if (updates.colors.length > 0) {
					params.set("colors", updates.colors.join(","));
				} else {
					params.delete("colors");
				}
			}

			if (updates.sizes !== undefined) {
				if (updates.sizes.length > 0) {
					params.set("sizes", updates.sizes.join(","));
				} else {
					params.delete("sizes");
				}
			}

			if (updates.price !== undefined) {
				if (updates.price) {
					params.set("price", updates.price);
				} else {
					params.delete("price");
				}
			}

			if (updates.sort !== undefined) {
				if (updates.sort && updates.sort !== "featured") {
					params.set("sort", updates.sort);
				} else {
					params.delete("sort");
				}
			}

			const queryString = params.toString();
			router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
		},
		[router, pathname, searchParams],
	);

	// Filter handlers
	const handleCategoryToggle = useCallback(
		(slug: string) => {
			const newCategories = selectedCategories.includes(slug)
				? selectedCategories.filter((c) => c !== slug)
				: [...selectedCategories, slug];
			updateFilters({ categories: newCategories });
		},
		[selectedCategories, updateFilters],
	);

	const handleColorToggle = useCallback(
		(color: string) => {
			const newColors = selectedColors.includes(color)
				? selectedColors.filter((c) => c !== color)
				: [...selectedColors, color];
			updateFilters({ colors: newColors });
		},
		[selectedColors, updateFilters],
	);

	const handleSizeToggle = useCallback(
		(size: string) => {
			const newSizes = selectedSizes.includes(size)
				? selectedSizes.filter((s) => s !== size)
				: [...selectedSizes, size];
			updateFilters({ sizes: newSizes });
		},
		[selectedSizes, updateFilters],
	);

	const handlePriceRangeChange = useCallback(
		(range: string | null) => {
			updateFilters({ price: range });
		},
		[updateFilters],
	);

	const handleSortChange = useCallback(
		(sort: SortOption) => {
			updateFilters({ sort });
		},
		[updateFilters],
	);

	// Extract filter options from products
	const categoryOptions = useMemo(() => extractCategoryOptions(products), [products]);

	const handleRemoveFilter = useCallback(
		(key: string, value: string) => {
			if (key === "category") {
				// value here is the display name, we need to find the slug
				const category =
					resolvedCategories.find((c) => c.name === value) || categoryOptions.find((c) => c.name === value);
				if (category) {
					const newCategories = selectedCategories.filter((c) => c !== category.slug);
					updateFilters({ categories: newCategories });
				}
			} else if (key === "color") {
				const newColors = selectedColors.filter((c) => c !== value);
				updateFilters({ colors: newColors });
			} else if (key === "size") {
				const newSizes = selectedSizes.filter((s) => s !== value);
				updateFilters({ sizes: newSizes });
			} else if (key === "price") {
				updateFilters({ price: null });
			}
		},
		[resolvedCategories, categoryOptions, selectedCategories, selectedColors, selectedSizes, updateFilters],
	);

	const handleClearFilters = useCallback(() => {
		router.push(pathname, { scroll: false });
	}, [router, pathname]);

	// Extract filter options with selected values included for deselection
	const colorOptions = useMemo(
		() => extractColorOptions(products, selectedColors),
		[products, selectedColors],
	);
	const sizeOptions = useMemo(() => extractSizeOptions(products, selectedSizes), [products, selectedSizes]);

	// Apply client-side filters (colors, sizes only)
	const clientFilteredProducts = useMemo(
		() =>
			filterProducts(products, {
				colors: selectedColors,
				sizes: selectedSizes,
			}),
		[products, selectedColors, selectedSizes],
	);

	// Sort (server-side primary, client-side fallback)
	const filteredProducts = useMemo(
		() => sortProductsClientSide(clientFilteredProducts, sortValue),
		[clientFilteredProducts, sortValue],
	);

	// Offered bands: only those computed for this listing, in its currency.
	const priceRanges = useMemo(
		() => (priceFilter?.ranges ?? []).map((range) => ({ ...range, count: 0 })),
		[priceFilter],
	);

	// Build active filters for display
	const activeFilters = useMemo(() => {
		const formatAmount = priceFilter
			? priceBandFormatter(locale, priceFilter.currency)
			: (amount: number) => new Intl.NumberFormat(locale).format(amount);
		const filters = buildActiveFilters(
			{
				colors: selectedColors,
				sizes: selectedSizes,
				priceRange: selectedPriceRange,
			},
			{
				color: t("color"),
				size: t("size"),
				price: t("price"),
				priceRange: (value) =>
					priceFilter?.ranges.find((range) => range.value === value)?.label ??
					priceRangeLabel(value, formatAmount, {
						under: (max) => t("priceUnder", { max }),
						between: (min, max) => t("priceBetween", { min, max }),
						over: (min) => t("priceOver", { min }),
					}),
			},
		);

		// Add category filters from server-resolved data
		resolvedCategories.forEach((cat) => {
			filters.unshift({ key: "category", label: t("category"), value: cat.name });
		});

		return filters;
	}, [selectedColors, selectedSizes, selectedPriceRange, resolvedCategories, priceFilter, locale, t]);

	return {
		filteredProducts,
		categoryOptions,
		colorOptions,
		sizeOptions,
		priceRanges: priceRanges,
		selectedCategories,
		selectedColors,
		selectedSizes,
		selectedPriceRange,
		sortValue,
		activeFilters,
		handleCategoryToggle,
		handleColorToggle,
		handleSizeToggle,
		handlePriceRangeChange,
		handleSortChange,
		handleRemoveFilter,
		handleClearFilters,
	};
}
