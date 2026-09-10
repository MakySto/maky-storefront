"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { Button } from "@/ui/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

// Labels are message keys, not text. `plp` already carried four of the five for the
// listing's own sort control; only `relevance` and `sortByName` were new.
const SORT_OPTIONS = [
	{ value: "relevance", key: "relevance" },
	{ value: "price-asc", key: "priceLowToHigh" },
	{ value: "price-desc", key: "priceHighToLow" },
	{ value: "name", key: "sortByName" },
	{ value: "newest", key: "newest" },
] as const;

export function SearchSort() {
	const t = useTranslations("plp");
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const currentSort = searchParams.get("sort") || "relevance";
	const currentLabel = t(SORT_OPTIONS.find((o) => o.value === currentSort)?.key ?? "relevance");

	const handleSortChange = (value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value === "relevance") {
			params.delete("sort");
		} else {
			params.set("sort", value);
		}
		// Reset pagination when sort changes
		params.delete("cursor");
		params.delete("direction");
		router.push(`${pathname}?${params.toString()}`);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline-solid" size="sm" className="gap-2">
					<ArrowUpDown className="h-4 w-4" />
					<span className="hidden sm:inline">{currentLabel}</span>
					<span className="sm:hidden">Sort</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuRadioGroup value={currentSort} onValueChange={handleSortChange}>
					{SORT_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{t(option.key)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
