import { type ReactElement } from "react";

/**
 * Line icons for the storefront categories, keyed by the category key from
 * `@/config/categories`. One set, so the homepage grid, the "Všetky kategórie" panel and the
 * mobile menu cannot drift into three different drawings of the same roof rack.
 *
 * Plain SVG components with no hooks: they render in server and client components alike.
 */
export function RoofRackIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path strokeLinecap="round" d="M3 8h18M3 8l2-4h14l2 4M6 8v4M18 8v4M3 12h18" />
		</svg>
	);
}

export function RoofBoxIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<rect x="2" y="8" width="20" height="8" rx="2" strokeLinecap="round" />
			<path strokeLinecap="round" d="M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2M12 8v8" />
		</svg>
	);
}

export function BikeIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<circle cx="6" cy="17" r="3" />
			<circle cx="18" cy="17" r="3" />
			<path strokeLinecap="round" d="M6 17l3-7h4l2 3h3M9 10l-1-3h3" />
		</svg>
	);
}

export function SkiIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path strokeLinecap="round" d="M4 20L20 4M7 17l2-2M13 11l2-2M9 3v6M15 15v6" />
		</svg>
	);
}

export function ChainIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path
				strokeLinecap="round"
				d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
			/>
		</svg>
	);
}

export function FridgeIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<rect x="4" y="2" width="16" height="20" rx="2" />
			<path strokeLinecap="round" d="M4 10h16M8 6v2M8 14v4" />
		</svg>
	);
}

export function TowBarIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<circle cx="12" cy="18" r="2" />
			<path strokeLinecap="round" d="M12 16V8M8 8h8M6 4h12v4H6z" />
		</svg>
	);
}

export function RoofTentIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18M6 20l6-10 6 10M12 20v-5M9 4h6M12 4v6" />
		</svg>
	);
}

export const CATEGORY_ICONS: Record<string, (props: { className?: string }) => ReactElement> = {
	roofRacks: RoofRackIcon,
	roofBoxes: RoofBoxIcon,
	bikeCarriers: BikeIcon,
	skiCarriers: SkiIcon,
	roofTents: RoofTentIcon,
	carFridges: FridgeIcon,
	snowChains: ChainIcon,
	towBars: TowBarIcon,
};

/** The icon for a category key, falling back to the roof rack for an unknown key. */
export function CategoryIcon({ categoryKey, className }: { categoryKey: string; className?: string }) {
	const Icon = CATEGORY_ICONS[categoryKey] ?? RoofRackIcon;
	return <Icon className={className} />;
}
