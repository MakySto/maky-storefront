"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SubcategoryChip } from "./subcategory-nav";

export interface ListingFilterPanelProps {
	/** The category family, "Všetko" first — navigation with counts, not a filter. */
	categoryLinks?: readonly (SubcategoryChip & { count?: number })[] | null;
	/** "Všetko", the label of the family's own listing. */
	allLabel?: string;
	/** The price bands computed for this listing, in its currency; empty = no price filter. */
	priceRanges: readonly { label: string; value: string }[];
	selectedPriceRange: string | null;
	onPriceRangeChange: (value: string | null) => void;
	/** The makers on this shelf with their counts; empty = no maker filter. */
	brands?: readonly { slug: string; name: string; count: number }[];
	selectedBrands?: readonly string[];
	onBrandToggle?: (slug: string) => void;
	/** The volume bands on this shelf with their counts; empty = no volume filter. */
	volumes?: readonly { value: string; label: string; count: number }[];
	selectedVolume?: string | null;
	onVolumeChange?: (value: string | null) => void;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
	/** The panel's own heading is the sheet's title on a phone; the desktop panel shows it. */
	showHeading?: boolean;
}

/** Above this many makers the section gets a search field, as the approved panel draws it. */
const BRAND_SEARCH_FROM = 7;

/**
 * The listing's filters, one panel for the desktop sidebar and the phone sheet.
 *
 * The approved category page's sections, in its order — Typ, Objem, Značka, Cena — each only
 * where the data backs it and the listing can apply it to the WHOLE result: the category family
 * as links with the number of products each holds in this market; the volume bands and the
 * makers counted from this shelf's own products (`getCategoryFacets`); the price bands computed
 * from its own prices. No colour, size or rating filter — the catalogue carries no such data —
 * and nothing that would only re-sort the page already loaded.
 *
 * Every row reads as a checkbox (the approved design's), and every change is a URL change, so a
 * filter survives closing the sheet, a reload and the back button. The counts describe the
 * shelf, not the combination of filters in force.
 */
export function ListingFilterPanel({
	categoryLinks,
	allLabel,
	priceRanges,
	selectedPriceRange,
	onPriceRangeChange,
	brands = [],
	selectedBrands = [],
	onBrandToggle,
	volumes = [],
	selectedVolume = null,
	onVolumeChange,
	hasActiveFilters,
	onClearFilters,
	showHeading = true,
}: ListingFilterPanelProps) {
	const t = useTranslations("plp");
	const [brandQuery, setBrandQuery] = useState("");
	const query = brandQuery.trim().toLocaleLowerCase();
	const shownBrands = query
		? brands.filter((brand) => brand.name.toLocaleLowerCase().includes(query))
		: brands;

	return (
		<div className="text-text-primary">
			{showHeading && (
				<div className="border-border-subtle flex items-center justify-between gap-3 border-b pb-4">
					<h2 className="text-base font-extrabold tracking-[-0.01em]">{t("filterTitle")}</h2>
					{hasActiveFilters && (
						<button
							type="button"
							onClick={onClearFilters}
							className="text-brand hover:text-brand-strong text-sm font-semibold transition-colors"
						>
							{t("clearAll")}
						</button>
					)}
				</div>
			)}

			{categoryLinks && categoryLinks.length > 0 && (
				<FilterSection title={t("category")}>
					<ul className="space-y-0.5">
						{categoryLinks.map((link) => (
							<li key={link.id}>
								<Link
									href={link.href}
									aria-current={link.current ? "page" : undefined}
									className={cn(
										"group rounded-2xs flex items-center gap-2.5 px-1.5 py-1.5 text-sm transition-colors",
										link.current
											? "text-text-primary font-semibold"
											: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
									)}
								>
									<Box checked={link.current} round />
									<span className="min-w-0 flex-1">{link.label ?? allLabel}</span>
									{typeof link.count === "number" && (
										<span className="text-text-tertiary shrink-0 text-xs tabular-nums">({link.count})</span>
									)}
								</Link>
							</li>
						))}
					</ul>
				</FilterSection>
			)}

			{volumes.length > 0 && onVolumeChange && (
				<FilterSection title={t("volume")}>
					<ul className="space-y-0.5">
						{volumes.map((volume) => {
							const checked = selectedVolume === volume.value;
							return (
								<li key={volume.value}>
									<button
										type="button"
										role="checkbox"
										aria-checked={checked}
										onClick={() => onVolumeChange(checked ? null : volume.value)}
										className={cn(
											"rounded-2xs flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left text-sm transition-colors",
											checked
												? "text-text-primary font-semibold"
												: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
										)}
									>
										<Box checked={checked} />
										<span className="min-w-0 flex-1 tabular-nums">{volume.label}</span>
										<span className="text-text-tertiary shrink-0 text-xs tabular-nums">({volume.count})</span>
									</button>
								</li>
							);
						})}
					</ul>
				</FilterSection>
			)}

			{brands.length > 0 && onBrandToggle && (
				<FilterSection title={t("brand")}>
					{brands.length >= BRAND_SEARCH_FROM && (
						<label className="relative mb-2 block">
							<span className="sr-only">{t("brandSearch")}</span>
							<SearchIcon
								className="text-text-tertiary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
								aria-hidden="true"
							/>
							<input
								type="search"
								value={brandQuery}
								onChange={(event) => setBrandQuery(event.target.value)}
								placeholder={t("brandSearch")}
								className="border-border-default bg-surface-card placeholder:text-text-tertiary focus:border-brand focus:ring-brand h-10 w-full rounded-xs border pr-3 pl-9 text-sm focus:ring-1 focus:outline-hidden"
							/>
						</label>
					)}
					<ul className="space-y-0.5">
						{shownBrands.map((brand) => {
							const checked = selectedBrands.includes(brand.slug);
							return (
								<li key={brand.slug}>
									<button
										type="button"
										role="checkbox"
										aria-checked={checked}
										onClick={() => onBrandToggle(brand.slug)}
										className={cn(
											"rounded-2xs flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left text-sm transition-colors",
											checked
												? "text-text-primary font-semibold"
												: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
										)}
									>
										<Box checked={checked} />
										<span className="min-w-0 flex-1">{brand.name}</span>
										<span className="text-text-tertiary shrink-0 text-xs tabular-nums">({brand.count})</span>
									</button>
								</li>
							);
						})}
					</ul>
				</FilterSection>
			)}

			{priceRanges.length > 0 && (
				<FilterSection title={t("price")}>
					<fieldset>
						<legend className="sr-only">{t("priceRange")}</legend>
						<div className="space-y-0.5">
							{[{ label: t("anyPrice"), value: null as string | null }, ...priceRanges].map((range) => {
								const checked = selectedPriceRange === range.value;
								return (
									<label
										key={range.value ?? "any"}
										className={cn(
											"rounded-2xs flex cursor-pointer items-center gap-2.5 px-1.5 py-1.5 text-sm transition-colors",
											checked
												? "text-text-primary font-semibold"
												: "text-text-secondary hover:bg-surface-secondary",
										)}
									>
										<input
											type="radio"
											name="price"
											checked={checked}
											onChange={() => onPriceRangeChange(range.value)}
											className="border-border-strong text-brand focus:ring-ring h-[1.125rem] w-[1.125rem] shrink-0"
										/>
										<span className="tabular-nums">{range.label}</span>
									</label>
								);
							})}
						</div>
					</fieldset>
				</FilterSection>
			)}
		</div>
	);
}

/** The drawn checkbox of a row: brown and ticked when chosen. */
function Box({ checked, round = false }: { checked: boolean; round?: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center border transition-colors",
				round ? "rounded-full" : "rounded-[0.25rem]",
				checked ? "border-brand bg-brand text-brand-text" : "border-border-strong bg-surface-card",
			)}
		>
			{checked && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
		</span>
	);
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<details open className="group/section border-border-subtle border-b py-4 last:border-b-0">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">
				{title}
				<ChevronDownIcon
					className="text-text-secondary h-4 w-4 transition-transform duration-200 group-open/section:rotate-180"
					strokeWidth={2.25}
					aria-hidden="true"
				/>
			</summary>
			<div className="mt-3">{children}</div>
		</details>
	);
}
