import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { WavePattern } from "./wave-pattern";

interface BreadcrumbItem {
	label: string;
	href: string;
}

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
			<div className="relative mx-auto flex h-full max-w-[1480px] flex-col justify-end px-4 pb-6 sm:px-6 lg:px-8">
				{/* Breadcrumbs */}
				<nav
					className={`mb-4 flex items-center gap-1.5 text-sm ${
						hasImage ? "text-white/70" : "text-text-secondary"
					}`}
				>
					{breadcrumbs.map((crumb, index) => (
						<span key={crumb.href} className="flex items-center gap-1.5">
							{index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
							{index === breadcrumbs.length - 1 ? (
								<span className={`font-medium ${hasImage ? "text-white" : "text-text-primary"}`}>
									{crumb.label}
								</span>
							) : (
								<Link
									href={crumb.href}
									className={`transition-colors ${hasImage ? "hover:text-white" : "hover:text-text-primary"}`}
								>
									{crumb.label}
								</Link>
							)}
						</span>
					))}
				</nav>

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
