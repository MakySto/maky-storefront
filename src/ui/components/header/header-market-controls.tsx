"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GlobeIcon, ChevronDownIcon } from "lucide-react";
import { REVERSE_MAP, marketSwitchHref } from "@/lib/channel-map";
import { registeredMarketTarget } from "./market-switch-targets";

const MARKETS = [
	{ slug: "sk", code: "sk", label: "Slovensko", lang: "SK", currency: "EUR", symbol: "€" },
	{ slug: "cz", code: "cz", label: "Česko", lang: "CS", currency: "CZK", symbol: "Kč" },
	{ slug: "de", code: "de", label: "Deutschland", lang: "DE", currency: "EUR", symbol: "€" },
	{ slug: "at", code: "at", label: "Österreich", lang: "DE", currency: "EUR", symbol: "€" },
	{ slug: "pl", code: "pl", label: "Polska", lang: "PL", currency: "PLN", symbol: "zł" },
	{ slug: "hu", code: "hu", label: "Magyarország", lang: "HU", currency: "HUF", symbol: "Ft" },
	{ slug: "it", code: "it", label: "Italia", lang: "IT", currency: "EUR", symbol: "€" },
	{ slug: "fr", code: "fr", label: "France", lang: "FR", currency: "EUR", symbol: "€" },
	{ slug: "es", code: "es", label: "España", lang: "ES", currency: "EUR", symbol: "€" },
	{ slug: "ro", code: "ro", label: "România", lang: "RO", currency: "RON", symbol: "lei" },
	{ slug: "us", code: "us", label: "United States", lang: "EN", currency: "USD", symbol: "$" },
	{ slug: "ca", code: "ca", label: "Canada", lang: "EN", currency: "CAD", symbol: "C$" },
] as const;

function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
	return (
		<img
			src={`https://flagcdn.com/w${size}/${code}.png`}
			srcSet={`https://flagcdn.com/w${size * 2}/${code}.png 2x`}
			width={size}
			height={Math.round(size * 0.75)}
			alt=""
			className="inline-block rounded-[2px]"
			loading="lazy"
		/>
	);
}

/**
 * Where choosing `target` takes the visitor from the current page.
 *
 * An entity page (product, category, vehicle) registers its counterparts: the same entity at
 * the target market's own URL, or — when it does not exist there — the target's home. Any
 * other page keeps its path, with the market's localized cart word swapped and the query kept.
 * Exported for the test; reads `window.location` because that is where the registration was
 * keyed, whatever the internal rewrite made of the path.
 */
export function switchTargetFor(
	target: string,
	currentMarket: string,
	channel: string,
	fallbackPath: string,
) {
	const here = typeof window === "undefined" ? fallbackPath : window.location.pathname;
	const registered = registeredMarketTarget(here, target);
	if (registered !== undefined) return registered === null ? `/${target}` : `/${target}${registered}`;

	const search = typeof window === "undefined" ? "" : window.location.search;
	const pathAfterMarket = here.replace(new RegExp(`^/(${currentMarket}|${channel})(?=/|$)`), "");
	return marketSwitchHref(target, `${pathAfterMarket}${search}`);
}

/**
 * @param markets the LIVE markets, supplied by the server at request time.
 *
 * The table above stays complete on purpose — it is what labels the button, so
 * browsing a preview market still reads "CS / CZK" rather than falling back to
 * Slovensko. Only the list you can *switch into* is filtered. Offering all twelve
 * put a customer one click from an unfinished storefront with no catalogue and no
 * working payment; a preview market is reachable by typing its URL, and that is
 * the whole of its contract.
 */
export function HeaderMarketControls({ markets }: { markets: readonly string[] }) {
	const t = useTranslations("nav");
	const router = useRouter();
	const params = useParams<{ channel: string }>();
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const currentFriendly = REVERSE_MAP[params.channel] || "sk";
	const currentMarket = MARKETS.find((m) => m.slug === currentFriendly) || MARKETS[0];
	const options = MARKETS.filter((m) => markets.includes(m.slug));
	// One live market is the launch state, not an edge case. A dropdown that opens
	// onto a single entry is worse than no dropdown.
	const canSwitch = options.length > 1;

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		}
		function handleEscape(e: KeyboardEvent) {
			if (e.key === "Escape") setIsOpen(false);
		}
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			document.addEventListener("keydown", handleEscape);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
				document.removeEventListener("keydown", handleEscape);
			};
		}
	}, [isOpen]);

	function handleSelect(newSlug: string) {
		setIsOpen(false);
		router.push(switchTargetFor(newSlug, currentFriendly, params.channel, pathname));
	}

	return (
		<div className="relative" ref={dropdownRef}>
			{/* One control, not two. "SK" and "EUR" used to be separate buttons opening the same
			    list, and "EUR" looked like a currency switch, which CLAUDE.md §5 rules out: the
			    currency belongs to the market. The chip names the market by its country code. */}
			<button
				type="button"
				onClick={() => canSwitch && setIsOpen(!isOpen)}
				aria-label={`${t("market")}: ${currentMarket.label}, ${currentMarket.currency}`}
				aria-expanded={canSwitch ? isOpen : undefined}
				aria-disabled={canSwitch ? undefined : true}
				className="text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus-visible:ring-ring inline-flex h-10 items-center gap-1.5 rounded-xs px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
			>
				<GlobeIcon className="h-3.5 w-3.5" aria-hidden />
				<span>{currentMarket.slug.toUpperCase()}</span>
				<span aria-hidden className="text-text-tertiary">
					·
				</span>
				<span>{currentMarket.currency}</span>
				{canSwitch && <ChevronDownIcon className="h-3 w-3 opacity-50" aria-hidden />}
			</button>

			{isOpen && canSwitch && (
				<div className="border-border-subtle bg-surface-card absolute top-full right-0 z-[var(--z-dropdown)] mt-2 w-72 rounded-sm border p-1 shadow-xl">
					{options.map((market) => (
						<button
							key={market.slug}
							type="button"
							onClick={() => handleSelect(market.slug)}
							className={`hover:bg-surface-secondary flex w-full items-center gap-3 rounded-xs px-3 py-2.5 text-sm transition-colors ${
								market.slug === currentFriendly
									? "bg-surface-secondary text-brand font-medium"
									: "text-text-secondary"
							}`}
						>
							<FlagImg code={market.code} size={20} />
							<span className="flex-1 text-left">{market.label}</span>
							<span className="w-10 text-right text-xs text-gray-400">{market.currency}</span>
							<span className="w-6 text-right text-xs font-medium text-gray-500">{market.symbol}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
