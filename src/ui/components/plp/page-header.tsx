import { Breadcrumbs, type BreadcrumbItem } from "@/ui/components/breadcrumbs";

interface PageHeaderProps {
	title: string;
	description?: string | null;
	breadcrumbs: BreadcrumbItem[];
}

/**
 * Simple page header with breadcrumbs for pages without hero images.
 * Use CategoryHero for pages with background images.
 */
export function PageHeader({ title, description, breadcrumbs }: PageHeaderProps) {
	return (
		<div className="border-border bg-background w-full border-b">
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<Breadcrumbs items={breadcrumbs} className="mb-4" />

				<h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
				{description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
			</div>
		</div>
	);
}
