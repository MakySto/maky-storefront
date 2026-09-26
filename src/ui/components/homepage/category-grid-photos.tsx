import { getHomeCategoryImages, type CategoryImages } from "@/lib/homepage/showcase";
import { getSceneryOrNone } from "@/lib/homepage/scenery";
import { CategoryGrid, type CategoryTilePhotos } from "./category-grid";

/**
 * The category tiles with their pictures. Rendered inside a Suspense boundary whose fallback is
 * `<CategoryGrid photos={null} />` — the same tiles, same size, without pictures — so the swap
 * moves nothing.
 *
 * A tile's picture is its scenery photo when one is set (`storefront-imagery.ts`, or Payload),
 * otherwise the category's own image in Saleor, shown whole as a cut-out.
 */
export async function CategoryGridPhotos({
	params,
	offered,
}: {
	params: Promise<{ channel: string }>;
	/** The slugs this market sells — the page reads them once for this and for the fallback. */
	offered: readonly string[];
}) {
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
	const scenery = await getSceneryOrNone(channel);

	const photos: Record<string, CategoryTilePhotos[string]> = {};
	for (const [slug, url] of Object.entries(images ?? {})) {
		photos[slug] = { url, position: "50% 50%", kind: "studio" };
	}
	for (const [slug, photo] of Object.entries(scenery?.tiles ?? {})) {
		photos[slug] = { url: photo.url, position: photo.position, kind: "scene" };
	}
	return <CategoryGrid photos={photos} offered={offered} />;
}
