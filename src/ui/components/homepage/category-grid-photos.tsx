import { getHomeCategoryImages, type CategoryImages } from "@/lib/homepage/showcase";
import { CategoryGrid } from "./category-grid";

/**
 * The category tiles with their Saleor photos. Rendered inside a Suspense boundary whose
 * fallback is `<CategoryGrid images={null} />` — the same tiles, same size, without photos —
 * so the swap moves nothing.
 */
export async function CategoryGridPhotos({ params }: { params: Promise<{ channel: string }> }) {
	const { channel } = await params;
	let images: CategoryImages | null = null;
	try {
		images = await getHomeCategoryImages(channel);
	} catch (error) {
		console.warn(
			`[Homepage] category photos left out for ${channel}:`,
			error instanceof Error ? error.message : error,
		);
	}
	return <CategoryGrid images={images} />;
}
