import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buildBreadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo";

export interface BreadcrumbItem {
	label: string;
	/** Omit on the current page — it renders as plain text and gets no JSON-LD `item`. */
	href?: string;
}

interface BreadcrumbsProps {
	items: BreadcrumbItem[];
	/** `onImage` inverts the palette for the category hero's photographic background. */
	tone?: "default" | "onImage";
	/** Emit BreadcrumbList structured data. One per page — leave off if the page already has it. */
	jsonLd?: boolean;
	className?: string;
}

/**
 * Breadcrumb trail.
 *
 * This used to be three components: this one (correct `ol`/`li` semantics, but
 * hidden below `sm` on the PDP) plus hand-rolled `nav > span` copies inside
 * PageHeader and CategoryHero that shipped on mobile with no list semantics and no
 * `aria-label`. Same trail, three behaviours. Now one.
 *
 * Mobile: the trail stays on a single scrollable line rather than wrapping to three
 * — wrapping is presumably what made it worth hiding in the first place. The terminal
 * crumb is dropped below `sm` when the trail is deeper than two, because it merely
 * repeats the `h1` directly beneath it and is always the longest label. A two-item
 * trail keeps its terminal crumb; hiding it there would leave a lone "Domov".
 *
 * The structured data always carries the FULL trail regardless of what is painted.
 */
export function Breadcrumbs({ items, tone = "default", jsonLd = true, className }: BreadcrumbsProps) {
	if (items.length === 0) return null;

	const onImage = tone === "onImage";
	const muted = onImage ? "text-white/70" : "text-muted-foreground";
	const current = onImage ? "text-white" : "text-foreground";
	const hover = onImage ? "hover:text-white" : "hover:text-foreground";

	const jsonLdProps = jsonLd ? jsonLdScriptProps(buildBreadcrumbJsonLd(items)) : null;

	return (
		<>
			{jsonLdProps && <script {...jsonLdProps} />}
			<nav aria-label="Breadcrumb" className={className}>
				<ol className={`scrollbar-hide flex items-center gap-1.5 overflow-x-auto text-sm ${muted}`}>
					{items.map((item, index) => {
						const isLast = index === items.length - 1;
						// Deep trails drop their tail on phones — see the component note.
						const hideOnMobile = isLast && items.length > 2;

						return (
							<li
								key={`${item.label}-${index}`}
								className={`flex shrink-0 items-center gap-1.5 ${hideOnMobile ? "hidden sm:flex" : ""}`}
							>
								{index > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />}
								{item.href && !isLast ? (
									<Link href={item.href} className={`whitespace-nowrap transition-colors ${hover}`}>
										{item.label}
									</Link>
								) : (
									<span
										aria-current={isLast ? "page" : undefined}
										className={`font-medium whitespace-nowrap ${current}`}
									>
										{item.label}
									</span>
								)}
							</li>
						);
					})}
				</ol>
			</nav>
		</>
	);
}
