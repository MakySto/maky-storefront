"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductGrid } from "@/ui/components/plp/product-grid";
import type { ProductCardData } from "@/ui/components/plp/product-card";

/**
 * The featured products with a tab per category among them (second pass, 2026-09-24).
 *
 * The tabs are the categories of the products the collection holds — nothing else: no
 * "Najobľúbenejšie", which no sales data backs, and no category that would open onto an empty
 * row. With fewer than two categories there is nothing to choose and no tab row at all.
 */
export function FeaturedShowcase({
	products,
	allLabel,
	tabsLabel,
}: {
	products: ProductCardData[];
	allLabel: string;
	tabsLabel: string;
}) {
	const [active, setActive] = useState<string | null>(null);

	const categories: { id: string; name: string }[] = [];
	for (const product of products) {
		const category = product.category;
		if (category && !categories.some((c) => c.id === category.id)) {
			categories.push({ id: category.id, name: category.name });
		}
	}
	const shown = active ? products.filter((product) => product.category?.id === active) : products;
	const tab = (id: string | null, label: string) => (
		<button
			key={id ?? "all"}
			type="button"
			role="tab"
			aria-selected={active === id}
			onClick={() => setActive(id)}
			className={cn(
				"focus-visible:ring-ring h-10 shrink-0 rounded-xs px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
				active === id
					? "bg-brand text-brand-text shadow-sm"
					: "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
			)}
		>
			{label}
		</button>
	);

	return (
		<>
			{categories.length > 1 && (
				<div
					role="tablist"
					aria-label={tabsLabel}
					className="-mx-4 mt-5 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
				>
					{tab(null, allLabel)}
					{categories.map((category) => tab(category.id, category.name))}
				</div>
			)}
			<div className="mt-6">
				<ProductGrid columns="home" products={shown} />
			</div>
		</>
	);
}
