"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GlobeIcon, ChevronDownIcon } from "lucide-react";
import { REVERSE_MAP } from "@/lib/channel-map";

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
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	function handleSelect(newSlug: string) {
		setIsOpen(false);
		const pathAfterMarket = pathname.replace(new RegExp(`^/(${currentFriendly}|${params.channel})/?`), "/");
		const newPath = `/${newSlug}${pathAfterMarket === "/" ? "" : pathAfterMarket}`;
		router.push(newPath);
	}

	return (
		<div className="relative" ref={dropdownRef}>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => canSwitch && setIsOpen(!isOpen)}
					aria-label={t("language")}
					aria-expanded={canSwitch ? isOpen : undefined}
					aria-disabled={canSwitch ? undefined : true}
					className="border-sand-300/80 hover:border-copper-500 inline-flex h-9 items-center gap-1.5 rounded-xs border bg-white/60 px-2.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
				>
					<GlobeIcon className="h-3.5 w-3.5" aria-hidden />
					<span>{currentMarket.lang}</span>
					{canSwitch && <ChevronDownIcon className="h-3 w-3 opacity-50" aria-hidden />}
				</button>

				<button
					type="button"
					onClick={() => canSwitch && setIsOpen(!isOpen)}
					aria-label={t("currency")}
					aria-disabled={canSwitch ? undefined : true}
					className="border-sand-300/80 hover:border-copper-500 inline-flex h-9 items-center gap-1.5 rounded-xs border bg-white/60 px-2.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
				>
					<span>{currentMarket.currency}</span>
					{canSwitch && <ChevronDownIcon className="h-3 w-3 opacity-50" aria-hidden />}
				</button>
			</div>

			{isOpen && canSwitch && (
				<div className="border-sand-300 absolute top-full right-0 z-[var(--z-dropdown)] mt-2 w-72 rounded-md border bg-white py-1 shadow-lg">
					{options.map((market) => (
						<button
							key={market.slug}
							type="button"
							onClick={() => handleSelect(market.slug)}
							className={`hover:bg-sand-100 flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
								market.slug === currentFriendly ? "bg-sand-50 text-copper-700 font-medium" : "text-gray-700"
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
