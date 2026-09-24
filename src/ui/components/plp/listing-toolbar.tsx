"use client";

import { useState } from "react";
import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	Sheet,
	SheetCloseButton,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/ui/components/ui/sheet";
import type { ActiveFilter, SortOption } from "./filter-bar";
import { ListingFilterPanel, type ListingFilterPanelProps } from "./listing-filter-panel";

const SORTS: readonly {
	value: SortOption;
	key: "featured" | "newest" | "priceLowToHigh" | "priceHighToLow";
}[] = [
	{ value: "featured", key: "featured" },
	{ value: "newest", key: "newest" },
	{ value: "price_asc", key: "priceLowToHigh" },
	{ value: "price_desc", key: "priceHighToLow" },
];

/**
 * The row over the product grid: how many products, the order, and — on a phone — the button
 * that opens the filters (premium redesign 2026-09).
 *
 * The order is a native `<select>`: on a phone it opens the system picker, on a desktop it is
 * one keyboard-friendly control. Under the row, the active filters as removable chips.
 *
 * The phone's filter sheet holds the same panel as the desktop sidebar. Filters apply as they
 * are chosen (each is a URL change), so the sheet's button only closes it — and closing it
 * keeps every choice.
 */
export function ListingToolbar({
	resultCount,
	sortValue,
	onSortChange,
	activeFilters,
	onRemoveFilter,
	panel,
}: {
	resultCount: number;
	sortValue: SortOption;
	onSortChange: (value: SortOption) => void;
	activeFilters: readonly ActiveFilter[];
	onRemoveFilter: (key: string, value: string) => void;
	/** The filter panel's props; `null` when this listing has nothing to filter by. */
	panel: ListingFilterPanelProps | null;
}) {
	const t = useTranslations("plp");
	const tCommon = useTranslations("common");
	const [open, setOpen] = useState(false);

	return (
		<div className="mb-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-text-primary text-[0.9375rem] font-semibold" aria-live="polite">
					{t("productCount", { count: resultCount })}
				</p>

				<div className="flex items-center gap-2">
					{panel && (
						<Sheet open={open} onOpenChange={setOpen}>
							<SheetTrigger asChild>
								<button
									type="button"
									className="border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus-visible:ring-ring inline-flex h-10 items-center gap-2 rounded-xs border px-3.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden lg:hidden"
								>
									<SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />
									{tCommon("filters")}
									{activeFilters.length > 0 && (
										<span className="bg-brand text-brand-text flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] font-bold">
											{activeFilters.length}
										</span>
									)}
								</button>
							</SheetTrigger>
							<SheetContent side="left" className="bg-surface-card flex w-[88vw] max-w-sm flex-col p-0">
								<SheetHeader className="border-border-subtle flex-row items-center justify-between border-b px-5 py-4">
									<SheetTitle className="text-base font-bold">{t("filterTitle")}</SheetTitle>
									<SheetCloseButton />
								</SheetHeader>
								<div className="flex-1 overflow-y-auto px-5">
									<ListingFilterPanel {...panel} showHeading={false} />
								</div>
								<div className="border-border-subtle flex gap-3 border-t p-4">
									{panel.hasActiveFilters && (
										<button
											type="button"
											onClick={panel.onClearFilters}
											className="border-border-default text-text-primary hover:bg-surface-secondary h-11 flex-1 rounded-xs border text-sm font-semibold transition-colors"
										>
											{t("clearAll")}
										</button>
									)}
									<button
										type="button"
										onClick={() => setOpen(false)}
										className="bg-cta text-cta-text hover:bg-cta-hover h-11 flex-[1.4] rounded-xs text-sm font-semibold transition-colors"
									>
										{t("showResults")}
									</button>
								</div>
							</SheetContent>
						</Sheet>
					)}

					<label className="relative flex items-center gap-2">
						<span className="text-text-secondary hidden text-sm sm:inline">{tCommon("sortBy")}</span>
						<span className="relative">
							<select
								value={sortValue}
								onChange={(event) => onSortChange(event.target.value as SortOption)}
								aria-label={tCommon("sortBy")}
								className="border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus:border-brand focus:ring-brand h-10 appearance-none rounded-xs border py-0 pr-9 pl-3.5 text-sm font-semibold transition-colors focus:ring-1 focus:outline-hidden"
							>
								{SORTS.map((sort) => (
									<option key={sort.value} value={sort.value}>
										{t(sort.key)}
									</option>
								))}
							</select>
							<ChevronDownIcon
								className="text-text-tertiary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
								aria-hidden="true"
							/>
						</span>
					</label>
				</div>
			</div>

			{activeFilters.length > 0 && (
				<ul className="mt-3 flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
					{activeFilters.map((filter) => (
						<li key={`${filter.key}-${filter.value}`}>
							<button
								type="button"
								onClick={() => onRemoveFilter(filter.key, filter.value)}
								aria-label={t("removeFilter", { value: filter.value })}
								className="border-border-default bg-surface-card text-text-primary hover:border-brand group inline-flex h-8 items-center gap-1.5 rounded-full border pr-2 pl-3 text-[0.8125rem] font-medium transition-colors"
							>
								<span className="text-text-tertiary">{filter.label}:</span>
								{filter.value}
								<XIcon className="text-text-tertiary group-hover:text-brand h-3.5 w-3.5" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
