"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { cn } from "@/lib/utils";

/**
 * All 12 markets — display order in selector.
 * Static list — no API call needed. We know exactly which markets we serve.
 */
const MARKETS = [
	{ slug: "sk", flag: "🇸🇰", label: "Slovensko", currency: "EUR" },
	{ slug: "cz", flag: "🇨🇿", label: "Česko", currency: "CZK" },
	{ slug: "de", flag: "🇩🇪", label: "Deutschland", currency: "EUR" },
	{ slug: "at", flag: "🇦🇹", label: "Österreich", currency: "EUR" },
	{ slug: "pl", flag: "🇵🇱", label: "Polska", currency: "PLN" },
	{ slug: "hu", flag: "🇭🇺", label: "Magyarország", currency: "HUF" },
	{ slug: "it", flag: "🇮🇹", label: "Italia", currency: "EUR" },
	{ slug: "fr", flag: "🇫🇷", label: "France", currency: "EUR" },
	{ slug: "es", flag: "🇪🇸", label: "España", currency: "EUR" },
	{ slug: "ro", flag: "🇷🇴", label: "România", currency: "RON" },
	{ slug: "us", flag: "🇺🇸", label: "United States", currency: "USD" },
	{ slug: "ca", flag: "🇨🇦", label: "Canada", currency: "CAD" },
] as const;

export const ChannelSelect = ({ className }: { className?: string }) => {
	const router = useRouter();
	const params = useParams<{ channel: string }>();
	const pathname = usePathname();

	// Current Saleor slug (e.g. "sk-eur") → friendly slug (e.g. "sk")
	const currentFriendly = REVERSE_MAP[params.channel] || "sk";

	/**
	 * When switching markets, preserve the path after the market prefix.
	 * /sk/products/stresny-nosic → /de/products/stresny-nosic
	 */
	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newMarket = e.currentTarget.value;

		// Strip current friendly prefix from pathname
		const pathAfterMarket = pathname.replace(new RegExp(`^/(${currentFriendly}|${params.channel})/?`), "/");

		const newPath = `/${newMarket}${pathAfterMarket === "/" ? "" : pathAfterMarket}`;
		router.push(newPath);
	};

	return (
		<select
			className={cn(
				"h-10 w-fit cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm",
				"text-neutral-200",
				"focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:outline-none",
				"transition-colors hover:border-neutral-500",
				className,
			)}
			onChange={handleChange}
			value={currentFriendly}
			aria-label="Zmeniť krajinu"
		>
			{MARKETS.map((market) => (
				<option key={market.slug} value={market.slug}>
					{market.flag} {market.label} ({market.currency})
				</option>
			))}
		</select>
	);
};
