import Image from "next/image";
import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";

interface CategoryHeroProps {
	title: string;
	description?: string | null;
	/**
	 * The category's photo in Saleor. Every one is a product cut-out on white, so it is shown
	 * whole beside the title — never cropped into a banner behind it.
	 */
	backgroundImage?: string | null;
	breadcrumbs: BreadcrumbItem[];
	/** Under the title and the introduction: the row of sub-categories. */
	children?: React.ReactNode;
}

/**
 * The head of a listing: where you are, what this is, and where else you can go from here.
 *
 * It used to be a fixed 180–210 px banner with the category photo cropped behind a dark
 * gradient — a 900 px cut-out of a roof box blown up until only its lid showed, pushing the
 * products below the fold on a phone. The photo now sits beside the title at its own size,
 * on the same white it was shot on, and the band is only as tall as what it says.
 */
export function CategoryHero({
	title,
	description,
	backgroundImage,
	breadcrumbs,
	children,
}: CategoryHeroProps) {
	return (
		<section className="border-border-subtle bg-surface-card border-b">
			{/* max-w-7xl so the title lines up with the filter bar and the product grid. */}
			<div className="mx-auto flex max-w-7xl items-center gap-6 px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6 lg:px-8">
				<div className="min-w-0 flex-1">
					<Breadcrumbs items={breadcrumbs} className="mb-2" />
					<h1 className="text-text-primary text-2xl font-bold tracking-[-0.02em] break-words sm:text-3xl lg:text-4xl">
						{title}
					</h1>
					{description && (
						<p className="text-text-secondary mt-1.5 max-w-2xl text-sm sm:text-base">{description}</p>
					)}
					{children && <div className="mt-4">{children}</div>}
				</div>
				{backgroundImage && (
					<div className="relative hidden aspect-square w-24 shrink-0 sm:block lg:w-32">
						{/* Decorative: the heading beside it names the category. */}
						<Image src={backgroundImage} alt="" fill sizes="128px" className="object-contain" />
					</div>
				)}
			</div>
		</section>
	);
}
