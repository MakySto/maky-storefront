"use client";

import { ChevronDownIcon, LayoutGridIcon } from "lucide-react";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { CategoryIcon } from "@/ui/components/shared/category-icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";

export type CategoryMenuItem = {
	readonly key: string;
	readonly href: string;
	readonly label: string;
};

/**
 * "Všetky kategórie" — the brand-coloured button that opens the full category list.
 *
 * From 2026-03-21 until this change it was a styled <button> with a chevron and no handler:
 * the most prominent control in the desktop header did nothing, and the roof tents and car
 * fridges had no link in the header at all. Labels and localized hrefs are resolved on the
 * server (`header-nav-row.tsx`) and passed in, so this needs no translations of its own.
 */
export function AllCategoriesTrigger({
	label,
	items,
}: {
	label: string;
	items: readonly CategoryMenuItem[];
}) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="group bg-brand hover:bg-brand-strong data-[state=open]:bg-brand-strong inline-flex h-10 items-center gap-2 rounded-sm px-4 text-[0.9375rem] font-semibold text-white transition-colors"
				>
					<LayoutGridIcon className="h-4 w-4" aria-hidden />
					<span>{label}</span>
					<ChevronDownIcon
						className="h-3.5 w-3.5 opacity-80 transition-transform group-data-[state=open]:rotate-180"
						aria-hidden
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" sideOffset={8} className="w-[30rem] p-2">
				<div className="grid grid-cols-2 gap-1">
					{items.map((item) => (
						<DropdownMenuItem key={item.key} asChild>
							<LinkWithChannel
								href={item.href}
								className="text-text-primary flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm font-medium"
							>
								<span className="bg-surface-muted text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
									<CategoryIcon categoryKey={item.key} className="h-5 w-5" />
								</span>
								{item.label}
							</LinkWithChannel>
						</DropdownMenuItem>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
