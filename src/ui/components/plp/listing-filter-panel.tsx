"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
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
	hasActiveFilters: boolean;
	onClearFilters: () => void;
	/** The panel's own heading is the sheet's title on a phone; the desktop panel shows it. */
	showHeading?: boolean;
}

/**
 * The listing's filters, one panel for the desktop sidebar and the phone sheet.
 *
 * Only what the data backs and the listing can apply to the WHOLE result (premium redesign
 * 2026-09): the category family as links with the number of products each holds in this
 * market, and the price bands computed from this category's own prices. No colour, size or
 * rating filter — the catalogue carries no such data — and nothing that would only re-sort the
 * page already loaded.
 *
 * The sections fold (`<details>`), open by default, so a long family does not push the price
 * off a laptop screen. Every change is a URL change, so a filter survives closing the sheet,
 * a reload and the back button.
 */
export function ListingFilterPanel({
	categoryLinks,
	allLabel,
	priceRanges,
	selectedPriceRange,
	onPriceRangeChange,
	hasActiveFilters,
	onClearFilters,
	showHeading = true,
}: ListingFilterPanelProps) {
	const t = useTranslations("plp");

	return (
		<div className="text-text-primary">
			{showHeading && (
				<div className="border-border-subtle flex items-center justify-between gap-3 border-b pb-4">
					<h2 className="text-base font-bold tracking-[-0.01em]">{t("filterTitle")}</h2>
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
										"group rounded-2xs flex items-baseline justify-between gap-3 px-2.5 py-2 text-sm transition-colors",
										link.current
											? "bg-surface-accent text-brand font-semibold"
											: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
									)}
								>
									<span className="min-w-0">{link.label ?? allLabel}</span>
									{typeof link.count === "number" && (
										<span className="text-text-tertiary shrink-0 text-xs tabular-nums">{link.count}</span>
									)}
								</Link>
							</li>
						))}
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
											"rounded-2xs flex cursor-pointer items-center gap-3 px-2.5 py-2 text-sm transition-colors",
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
											className="border-border-strong text-brand focus:ring-ring h-4 w-4 shrink-0"
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

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<details open className="group/section border-border-subtle border-b py-4 last:border-b-0">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
				{title}
				<ChevronDownIcon
					className="text-text-tertiary h-4 w-4 transition-transform duration-200 group-open/section:rotate-180"
					aria-hidden="true"
				/>
			</summary>
			<div className="mt-3">{children}</div>
		</details>
	);
}
