import Link from "next/link";
import { ArrowRight, CarFront } from "lucide-react";

/**
 * What a search is answered with before its products, when the words name something this shop
 * sells by another road than a list: a car (its roof-rack sets are chosen on the car's own page),
 * the roof racks without a car, or a tyre size (the chains that fit it have a page).
 *
 * One card each, above the results. The texts arrive translated; nothing here decides what the
 * words mean (`lib/search/search-answer.ts` does).
 */

const CARD = "border-border-default bg-surface-card rounded-lg border p-4 sm:p-5";
const CHIP =
	"border-border-default bg-surface-primary text-text-primary hover:border-action-primary focus-visible:ring-ring inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden";
const ACTION =
	"bg-action-primary text-action-primary-text hover:bg-action-primary-hover focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden";

export interface ShortcutLink {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	readonly years?: string;
}

export interface VehicleShortcutCard {
	readonly id: string;
	readonly heading: string;
	readonly openLabel: string;
	readonly href: string;
	readonly generations: readonly ShortcutLink[];
	readonly related: readonly ShortcutLink[];
}

function Chips({ label, links }: { label: string; links: readonly ShortcutLink[] }) {
	if (links.length === 0) return null;
	return (
		<div className="mt-4">
			<p className="text-text-secondary text-sm font-medium">{label}</p>
			<ul className="mt-2 flex flex-wrap gap-2">
				{links.map((link) => (
					<li key={link.id}>
						<Link href={link.href} className={CHIP}>
							<span>{link.label}</span>
							{link.years ? <span className="text-text-tertiary text-xs">{link.years}</span> : null}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

/** The car the words name: its page, its generations, and the sister models the words also fit. */
export function VehicleShortcuts({
	cards,
	help,
	generationsLabel,
	relatedLabel,
	className = "",
}: {
	cards: readonly VehicleShortcutCard[];
	help: string;
	generationsLabel: string;
	relatedLabel: string;
	className?: string;
}) {
	if (cards.length === 0) return null;
	return (
		<div className={`flex flex-col gap-4 ${className}`} data-testid="search-vehicle-shortcuts">
			{cards.map((card) => (
				<section key={card.id} aria-label={card.heading} className={CARD}>
					<div className="flex items-start gap-3">
						<CarFront className="text-text-secondary mt-0.5 h-6 w-6 shrink-0" aria-hidden />
						<div className="min-w-0">
							<h2 className="text-text-primary text-lg font-semibold break-words">{card.heading}</h2>
							<p className="text-text-secondary mt-1 text-sm">{help}</p>
						</div>
					</div>
					<Chips label={generationsLabel} links={card.generations} />
					<div className="mt-4">
						<Link href={card.href} className={ACTION}>
							{card.openLabel}
							<ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
						</Link>
					</div>
					<Chips label={relatedLabel} links={card.related} />
				</section>
			))}
		</div>
	);
}

/** One card with a heading, a sentence and one link: "choose your car", "chains for this size". */
export function SearchSignpost({
	heading,
	help,
	cta,
	href,
	testId,
	className = "",
}: {
	heading: string;
	help?: string;
	cta: string;
	href: string;
	testId: string;
	className?: string;
}) {
	return (
		<section aria-label={heading} className={`${CARD} ${className}`} data-testid={testId}>
			<h2 className="text-text-primary text-lg font-semibold break-words">{heading}</h2>
			{help ? <p className="text-text-secondary mt-1 text-sm">{help}</p> : null}
			<div className="mt-4">
				<Link href={href} className={ACTION}>
					{cta}
					<ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
				</Link>
			</div>
		</section>
	);
}
