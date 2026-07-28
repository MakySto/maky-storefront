"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/ui/components/ui/dropdown-menu";
import { Badge } from "@/ui/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SheetCloseButton,
} from "@/ui/components/ui/sheet";

export type SortOption = "featured" | "newest" | "price_asc" | "price_desc" | "bestselling";

export interface FilterOption {
	name: string;
	count: number;
	hex?: string;
}

export interface CategoryFilterOption {
	id: string;
	name: string;
	slug: string;
	count: number;
}

export interface ActiveFilter {
	key: string;
	label: string;
	value: string;
}

interface FilterBarProps {
	resultCount: number;
	sortValue: SortOption;
	onSortChange: (value: SortOption) => void;
	activeFilters?: readonly ActiveFilter[];
	onRemoveFilter?: (key: string, value: string) => void;
	onClearFilters?: () => void;
	categoryOptions?: readonly CategoryFilterOption[];
	colorOptions?: readonly FilterOption[];
	sizeOptions?: readonly FilterOption[];
	priceRanges?: readonly { label: string; value: string; count: number }[];
	selectedCategories?: readonly string[];
	selectedColors?: readonly string[];
	selectedSizes?: readonly string[];
	selectedPriceRange?: string | null;
	onCategoryToggle?: (slug: string) => void;
	onColorToggle?: (color: string) => void;
	onSizeToggle?: (size: string) => void;
	onPriceRangeChange?: (range: string | null) => void;
}

export function FilterBar({
	resultCount,
	sortValue,
	onSortChange,
	activeFilters = [],
	onRemoveFilter,
	onClearFilters,
	categoryOptions = [],
	colorOptions = [],
	sizeOptions = [],
	priceRanges = [],
	selectedCategories = [],
	selectedColors = [],
	selectedSizes = [],
	selectedPriceRange = null,
	onCategoryToggle,
	onColorToggle,
	onSizeToggle,
	onPriceRangeChange,
}: FilterBarProps) {
	const t = useTranslations("plp");
	const tCommon = useTranslations("common");
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

	const hasFilters =
		categoryOptions.length > 0 || colorOptions.length > 0 || sizeOptions.length > 0 || priceRanges.length > 0;

	const activeFilterCount =
		selectedCategories.length + selectedColors.length + selectedSizes.length + (selectedPriceRange ? 1 : 0);

	return (
		<div className="border-border-default bg-surface-card sticky top-16 z-[var(--z-header)] border-b">
			<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
				{/* Main Filter Row */}
				<div className="flex items-center justify-between gap-4">
					{/* Left: Filters */}
					<div className="scrollbar-hide -mx-1 -my-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
						{/* Mobile Filters — Sheet */}
						{hasFilters && (
							<Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
								<SheetTrigger asChild>
									<Button variant="outline-solid" size="sm" className="shrink-0 bg-transparent md:hidden">
										<SlidersHorizontal className="mr-2 h-4 w-4" />
										{tCommon("filters")}
										{activeFilterCount > 0 && (
											<Badge variant="secondary" className="ml-2 h-5 px-1.5 py-0 text-xs">
												{activeFilterCount}
											</Badge>
										)}
									</Button>
								</SheetTrigger>
								<SheetContent side="left" className="flex w-[280px] flex-col p-0">
									<SheetHeader className="border-border-default flex-row items-center justify-between border-b px-4 py-4">
										<SheetTitle>{tCommon("filters")}</SheetTitle>
										<SheetCloseButton />
									</SheetHeader>

									<div className="flex-1 overflow-y-auto">
										<div className="divide-border-subtle divide-y">
											{/* Mobile Category Filter */}
											{categoryOptions.length > 0 && onCategoryToggle && (
												<MobileFilterSection title={t("category")}>
													{categoryOptions.map((category) => (
														<CheckboxRow
															key={category.slug}
															label={category.name}
															checked={selectedCategories.includes(category.slug)}
															onToggle={() => onCategoryToggle(category.slug)}
														/>
													))}
												</MobileFilterSection>
											)}

											{/* Mobile Color Filter */}
											{colorOptions.length > 0 && onColorToggle && (
												<MobileFilterSection title={t("color")}>
													{colorOptions.map((color) => (
														<CheckboxRow
															key={color.name}
															label={color.name}
															checked={selectedColors.includes(color.name)}
															onToggle={() => onColorToggle(color.name)}
															swatch={color.hex}
															count={color.count}
														/>
													))}
												</MobileFilterSection>
											)}

											{/* Mobile Size Filter */}
											{sizeOptions.length > 0 && onSizeToggle && (
												<MobileFilterSection title={t("size")}>
													<div className="flex flex-wrap gap-2">
														{sizeOptions.map((size) => {
															const isSelected = selectedSizes.includes(size.name);
															return (
																<button
																	key={size.name}
																	onClick={() => onSizeToggle(size.name)}
																	className={`rounded-sm border px-4 py-2 text-sm transition-colors ${
																		isSelected
																			? "border-gray-900 bg-gray-900 text-white"
																			: "border-border-default hover:border-gray-900"
																	}`}
																>
																	{size.name}
																</button>
															);
														})}
													</div>
												</MobileFilterSection>
											)}

											{/* Mobile Price Filter */}
											{priceRanges.length > 0 && onPriceRangeChange && (
												<MobileFilterSection title={t("price")}>
													{priceRanges.map((range) => {
														const isSelected = selectedPriceRange === range.value;
														return (
															<button
																key={range.value}
																onClick={() => onPriceRangeChange(isSelected ? null : range.value)}
																className="flex w-full items-center gap-3 text-left"
															>
																<span
																	className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
																		isSelected ? "border-gray-900 bg-gray-900" : "border-border-default"
																	}`}
																>
																	{isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
																</span>
																<span className="text-sm">{range.label}</span>
															</button>
														);
													})}
												</MobileFilterSection>
											)}
										</div>
									</div>

									{/* Footer: Clear all */}
									{activeFilterCount > 0 && onClearFilters && (
										<div className="border-border-default border-t p-4">
											<Button
												variant="outline-solid"
												className="w-full"
												onClick={() => {
													onClearFilters();
													setMobileFiltersOpen(false);
												}}
											>
												{t("clearAllFilters")} ({activeFilterCount})
											</Button>
										</div>
									)}
								</SheetContent>
							</Sheet>
						)}

						{/* Desktop: Category */}
						{categoryOptions.length > 0 && onCategoryToggle && (
							<DesktopDropdown label={t("category")} count={selectedCategories.length}>
								<DropdownMenuLabel>{t("category")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{categoryOptions.map((category) => (
									<DropdownMenuCheckboxItem
										key={category.slug}
										checked={selectedCategories.includes(category.slug)}
										onCheckedChange={() => onCategoryToggle(category.slug)}
									>
										{category.name}
									</DropdownMenuCheckboxItem>
								))}
							</DesktopDropdown>
						)}

						{/* Desktop: Color */}
						{colorOptions.length > 0 && onColorToggle && (
							<DesktopDropdown label={t("color")} count={selectedColors.length}>
								<DropdownMenuLabel>{t("color")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{colorOptions.map((color) => (
									<DropdownMenuCheckboxItem
										key={color.name}
										checked={selectedColors.includes(color.name)}
										onCheckedChange={() => onColorToggle(color.name)}
									>
										{color.hex && (
											<span
												className="border-border-default mr-2 h-4 w-4 shrink-0 rounded-full border"
												style={{ backgroundColor: color.hex }}
											/>
										)}
										<span className="flex-1">{color.name}</span>
										<span className="text-text-tertiary text-xs">({color.count})</span>
									</DropdownMenuCheckboxItem>
								))}
							</DesktopDropdown>
						)}

						{/* Desktop: Size */}
						{sizeOptions.length > 0 && onSizeToggle && (
							<DesktopDropdown label={t("size")} count={selectedSizes.length} width="w-48">
								<DropdownMenuLabel>{t("size")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{sizeOptions.map((size) => (
									<DropdownMenuCheckboxItem
										key={size.name}
										checked={selectedSizes.includes(size.name)}
										onCheckedChange={() => onSizeToggle(size.name)}
									>
										<span className="flex-1">{size.name}</span>
										<span className="text-text-tertiary text-xs">({size.count})</span>
									</DropdownMenuCheckboxItem>
								))}
							</DesktopDropdown>
						)}

						{/* Desktop: Price */}
						{priceRanges.length > 0 && onPriceRangeChange && (
							<DesktopDropdown label={t("price")} count={selectedPriceRange ? 1 : 0} width="w-48">
								<DropdownMenuLabel>{t("priceRange")}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuRadioGroup
									value={selectedPriceRange || ""}
									onValueChange={(v) => onPriceRangeChange(v || null)}
								>
									{priceRanges.map((range) => (
										<DropdownMenuRadioItem key={range.value} value={range.value}>
											{range.label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DesktopDropdown>
						)}
					</div>

					{/* Right: Count + Sort */}
					<div className="flex shrink-0 items-center gap-3">
						<span className="text-text-secondary hidden text-sm sm:block">
							{t("productCount", { count: resultCount })}
						</span>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline-solid" size="sm" className="bg-transparent">
									{t("sort")}
									<ChevronDown className="ml-1.5 h-4 w-4 opacity-50" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuRadioGroup
									value={sortValue}
									onValueChange={(v) => onSortChange(v as SortOption)}
								>
									<DropdownMenuRadioItem value="featured">{t("featured")}</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="newest">{t("newest")}</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="price_asc">{t("priceLowToHigh")}</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="price_desc">{t("priceHighToLow")}</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="bestselling">{t("bestSelling")}</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Active Filters Row */}
				{activeFilters.length > 0 && onRemoveFilter && onClearFilters && (
					<div className="scrollbar-hide -mx-1 mt-3 flex items-center gap-2 overflow-x-auto px-1 py-1">
						{activeFilters.map((filter) => (
							<Badge
								key={`${filter.key}-${filter.value}`}
								variant="secondary"
								className="shrink-0 gap-1.5 pr-1.5"
							>
								<span className="text-text-tertiary text-xs">{filter.label}:</span>
								{filter.value}
								<button
									onClick={() => onRemoveFilter(filter.key, filter.value)}
									className="hover:bg-surface-muted ml-0.5 rounded-full p-0.5 transition-colors"
									aria-label={t("removeFilter", { value: filter.value })}
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
						<Button
							variant="ghost"
							size="sm"
							className="text-text-secondary h-6 shrink-0 px-2 text-xs"
							onClick={onClearFilters}
						>
							{t("clearAll")}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

/* ── Helper components (internal) ────────────────────────────── */

function MobileFilterSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="px-4 py-6">
			<h3 className="text-text-secondary mb-4 text-sm font-medium tracking-wide uppercase">{title}</h3>
			<div className="space-y-3">{children}</div>
		</div>
	);
}

function CheckboxRow({
	label,
	checked,
	onToggle,
	swatch,
	count,
}: {
	label: string;
	checked: boolean;
	onToggle: () => void;
	swatch?: string;
	count?: number;
}) {
	return (
		<button onClick={onToggle} className="flex w-full items-center gap-3 text-left">
			<span
				className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
					checked ? "border-gray-900 bg-gray-900 text-white" : "border-border-default"
				}`}
			>
				{checked && <Check className="h-3 w-3" />}
			</span>
			{swatch && (
				<span
					className="border-border-default h-5 w-5 shrink-0 rounded-full border"
					style={{ backgroundColor: swatch }}
				/>
			)}
			<span className="flex-1 text-sm">{label}</span>
			{count !== undefined && <span className="text-text-tertiary text-xs">({count})</span>}
		</button>
	);
}

function DesktopDropdown({
	label,
	count,
	width = "w-56",
	children,
}: {
	label: string;
	count: number;
	width?: string;
	children: React.ReactNode;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline-solid" size="sm" className="hidden shrink-0 bg-transparent md:flex">
					{label}
					{count > 0 && (
						<Badge variant="secondary" className="ml-2 h-5 px-1.5 py-0 text-xs">
							{count}
						</Badge>
					)}
					<ChevronDown className="ml-1.5 h-4 w-4 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className={width}>
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
