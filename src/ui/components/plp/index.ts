export { CategoryHero } from "./category-hero";
export { PageHeader } from "./page-header";
export { ProductCard, type ProductCardData } from "./product-card";
export { ProductGrid } from "./product-grid";
export { ListingEmptyState } from "./listing-empty-state";
export { listingResultCount } from "./listing-result-count";
export {
	FilterBar,
	type SortOption,
	type FilterOption,
	type CategoryFilterOption,
	type ActiveFilter,
} from "./filter-bar";
export { transformToProductCard, formatPrice } from "./utils";
export {
	// Server-side filter helpers (resolveCategorySlugsToIds is in filter-utils.server.ts)
	buildFilterVariables,
	buildSortVariables,
	// Client-side filter helpers
	extractCategoryOptions,
	extractColorOptions,
	extractSizeOptions,
	filterProducts,
	sortProductsClientSide,
	buildActiveFilters,
	// Types
	type CategoryOption,
} from "./filter-utils";
export { SubcategoryNav, type SubcategoryChip } from "./subcategory-nav";
export { ListingFilterPanel } from "./listing-filter-panel";
export { ListingToolbar } from "./listing-toolbar";
export {
	priceRangeOptions,
	priceBandFormatter,
	priceRangeLabel,
	type PriceFilter,
	type PriceRangeOption,
} from "./price-ranges";
export { useProductFilters } from "./use-product-filters";
