"use client";

import { ChevronDownIcon } from "lucide-react";
import { useViewNavigation } from "./offer-view-navigation";

export type ViewOption = { value: string; label: string; href: string };

/**
 * One choice a vehicle page is narrowed or ordered by (the year, the maker, the order), as the
 * category toolbar's own select.
 *
 * It holds no state of its own: every option is an address the server built, and choosing one goes
 * there. The choice is then in the address, where it can be saved and sent, and the list is the
 * server's answer for that address, the same for everybody who opens it.
 *
 * While any control's choice is on its way it waits (`offer-view-navigation.tsx`): its options are
 * addresses of the view that is being replaced.
 */
export function OfferViewSelect({
	label,
	value,
	options,
}: {
	label: string;
	value: string;
	options: readonly ViewOption[];
}) {
	const { busy, go } = useViewNavigation();

	return (
		<label className="relative flex items-center gap-2">
			{/* On a phone the first option says what the control is ("Všetky roky"); the name stays for assistive technology. */}
			<span className="text-text-secondary hidden text-sm sm:inline">{label}</span>
			<span className="relative">
				<select
					value={value}
					aria-label={label}
					disabled={busy}
					onChange={(event) => {
						const next = options.find((option) => option.value === event.target.value);
						if (next) go(next.href);
					}}
					className="border-border-default bg-surface-card text-text-primary hover:border-text-tertiary focus:border-brand focus:ring-brand h-10 appearance-none rounded-xs border py-0 pr-9 pl-3.5 text-sm font-semibold transition-colors focus:ring-1 focus:outline-hidden disabled:opacity-60"
				>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<ChevronDownIcon
					className="text-text-tertiary pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
					aria-hidden="true"
				/>
			</span>
		</label>
	);
}
