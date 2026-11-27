"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

export type YearOption = { value: string; label: string; href: string };

/**
 * The year a vehicle page is narrowed to, as the category toolbar's own select.
 *
 * It holds no state of its own: every option is an address the server built, and choosing one goes
 * there. The year is then in the address, where it can be saved and sent, and the list is the
 * server's answer for that address, the same for everybody who opens it.
 */
export function OfferYearSelect({
	label,
	value,
	options,
}: {
	label: string;
	value: string;
	options: readonly YearOption[];
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	return (
		<label className="relative flex items-center gap-2">
			<span className="text-text-secondary text-sm">{label}</span>
			<span className="relative">
				<select
					value={value}
					disabled={pending}
					onChange={(event) => {
						const next = options.find((option) => option.value === event.target.value);
						if (next) startTransition(() => router.replace(next.href, { scroll: false }));
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
