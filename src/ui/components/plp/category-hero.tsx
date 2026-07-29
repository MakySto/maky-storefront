import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";
import { WavePattern } from "./wave-pattern";

interface CategoryHeroProps {
	title: string;
	description?: string | null;
	backgroundImage?: string | null;
	breadcrumbs: BreadcrumbItem[];
}

export function CategoryHero({ title, description, backgroundImage, breadcrumbs }: CategoryHeroProps) {
	const hasImage = !!backgroundImage;

	return (
		<section className="border-border-default relative h-[180px] overflow-hidden border-b sm:h-[210px]">
			{/* Background */}
			<div className="absolute inset-0">
				{hasImage ? (
					<>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={backgroundImage} alt={title} className="h-full w-full object-cover" />
						<div className="absolute inset-0 bg-gradient-to-r from-gray-900/70 via-gray-900/40 to-transparent" />
					</>
				) : (
					<WavePattern className="h-full w-full" />
				)}
			</div>

			{/* Content */}
			{/* max-w-7xl so the hero title lines up with the breadcrumb and the product
			    grid underneath it. At max-w-[1480px] the heading sat 80px further left
			    than everything else on the page. */}
			<div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-6 sm:px-6 lg:px-8">
				<Breadcrumbs items={breadcrumbs} tone={hasImage ? "onImage" : "default"} className="mb-4" />

				<h1
					className={`text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl ${
						hasImage ? "text-white" : "text-text-primary"
					}`}
				>
					{title}
				</h1>
				{description && (
					<p
						className={`mt-3 max-w-lg text-base md:text-lg ${
							hasImage ? "text-white/80" : "text-text-secondary"
						}`}
					>
						{description}
					</p>
				)}
			</div>
		</section>
	);
}
