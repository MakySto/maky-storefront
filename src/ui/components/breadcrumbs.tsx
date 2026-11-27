import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buildBreadcrumbJsonLd, jsonLdScriptProps } from "@/lib/seo";
import { BreadcrumbScroller } from "./breadcrumb-scroller";

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
 * This used to be three components: this one (correct `ol`/`li` semantics, but hidden below `sm` on the
 * PDP) plus hand-rolled `nav > span` copies inside PageHeader and CategoryHero that shipped on mobile
 * with no list semantics and no `aria-label`. Same trail, three behaviours. Now one.
 *
 * Mobile: the trail stays on ONE line and is never cut short. It used to drop its last crumb below `sm`
 * when the trail was deeper than two, so a listing ended "Strešné nosiče > FORD > Kuga" on a phone and
 * "... > DFK" on a desktop, and a product's trail ended at its shelf. Now every crumb is there on every
 * width; a trail wider than the screen scrolls sideways and starts scrolled to its END, where the page the
 * shopper is on and the step back from it are (`BreadcrumbScroller`). A long last crumb is cut with an
 * ellipsis rather than pushing the steps back out of sight.
 *
 * The structured data carries the same trail as the page paints.
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
				<BreadcrumbScroller
					className={`scrollbar-hide flex items-center gap-1.5 overflow-x-auto text-sm ${muted}`}
				>
					{items.map((item, index) => {
						const isLast = index === items.length - 1;

						return (
							<li key={`${item.label}-${index}`} className="flex shrink-0 items-center gap-1.5">
								{index > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />}
								{item.href && !isLast ? (
									// On a photo the link must carry its own colour: the base `a { color: var(--text-link) }`
									// beats the inherited white/70 and painted "Domov" copper on a dark image.
									<Link
										href={item.href}
										className={`py-1.5 whitespace-nowrap transition-colors ${onImage ? muted : ""} ${hover}`}
									>
										{item.label}
									</Link>
								) : (
									<span
										aria-current={isLast ? "page" : undefined}
										title={isLast ? item.label : undefined}
										className={`font-medium whitespace-nowrap ${current} ${
											isLast ? "max-w-[18rem] truncate sm:max-w-[32rem]" : ""
										}`}
									>
										{item.label}
									</span>
								)}
							</li>
						);
					})}
				</BreadcrumbScroller>
			</nav>
		</>
	);
}
