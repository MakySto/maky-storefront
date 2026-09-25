"use client";

import { BookOpenIcon, ChevronDownIcon, ChevronRightIcon, LayoutGridIcon, TagsIcon } from "lucide-react";
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
/** The secondary links' icons, by nav key: the makers and the advice pages. */
const SECONDARY_ICON: Readonly<Record<string, typeof TagsIcon>> = { brands: TagsIcon, advice: BookOpenIcon };

export function AllCategoriesTrigger({
	label,
	items,
	links = [],
}: {
	label: string;
	items: readonly CategoryMenuItem[];
	/**
	 * "Značky" and "Poradňa", under the categories. In the desktop row they are the first links to
	 * give way when it is short of width (`header.config.ts`); here they stay at every width.
	 */
	links?: readonly CategoryMenuItem[];
}) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="group bg-brand hover:bg-brand-strong data-[state=open]:bg-brand-strong text-brand-text focus-visible:ring-ring inline-flex h-10 shrink-0 items-center gap-2.5 rounded-xs pr-3 pl-3.5 text-sm font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden xl:min-w-[12.5rem] xl:text-[0.9375rem]"
				>
					<LayoutGridIcon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
					<span className="flex-1 text-left">{label}</span>
					<ChevronDownIcon
						className="h-4 w-4 opacity-80 transition-transform duration-200 group-data-[state=open]:rotate-180"
						aria-hidden
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={10}
				className="border-border-subtle w-[32rem] rounded-sm p-2 shadow-xl"
			>
				<div className="grid grid-cols-2 gap-1">
					{items.map((item) => (
						<DropdownMenuItem key={item.key} asChild>
							<LinkWithChannel
								href={item.href}
								className="group/item text-text-primary focus:bg-surface-secondary flex cursor-pointer items-center gap-3 rounded-xs p-2.5 text-[0.9375rem] font-medium"
							>
								<span className="bg-surface-secondary text-brand group-focus/item:bg-surface-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xs transition-colors">
									<CategoryIcon categoryKey={item.key} className="h-5 w-5" />
								</span>
								<span className="flex-1">{item.label}</span>
								<ChevronRightIcon
									className="text-text-tertiary group-focus/item:text-brand h-4 w-4 transition-transform group-focus/item:translate-x-0.5"
									aria-hidden
								/>
							</LinkWithChannel>
						</DropdownMenuItem>
					))}
				</div>
				{links.length > 0 && (
					<div className="border-border-subtle mt-2 grid grid-cols-2 gap-1 border-t pt-2">
						{links.map((item) => {
							const Icon = SECONDARY_ICON[item.key] ?? ChevronRightIcon;
							return (
								<DropdownMenuItem key={item.key} asChild>
									<LinkWithChannel
										href={item.href}
										className="group/item text-text-primary focus:bg-surface-secondary flex cursor-pointer items-center gap-3 rounded-xs px-2.5 py-2 text-[0.9375rem] font-medium"
									>
										<Icon className="text-brand h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
										<span className="flex-1">{item.label}</span>
									</LinkWithChannel>
								</DropdownMenuItem>
							);
						})}
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
