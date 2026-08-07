import Image from "next/image";
import { type ReactNode } from "react";
import { type CmsMedia } from "@/lib/cms/blocks";

/**
 * One CMS image.
 *
 * Always `fill` inside an aspect-ratio box, never a sized `<Image>`. The contract makes
 * `id`, `url` and `alt` mandatory on a populated upload but says nothing about `width` and
 * `height`, so a sized image would need a branch for media that legitimately arrives
 * without dimensions — and the fallback branch is the one nobody would ever see in
 * testing. One code path renders every case, and the box reserves its space either way,
 * which is what keeps CLS at zero on a page whose images the editor chooses.
 *
 * The intrinsic ratio is used when the upload reports one so the box matches the picture;
 * 3:2 otherwise, which is the shape of every fixture in the pack.
 *
 * `alt` is never invented. A media object without it does not parse (see `readMedia`), so
 * by the time one reaches here the editor has written alt text.
 */
export function CmsImage({
	media,
	className,
	sizes = "(min-width: 768px) 720px, 100vw",
	priority = false,
}: {
	media: CmsMedia;
	className?: string;
	sizes?: string;
	priority?: boolean;
}): ReactNode {
	const ratio = media.width && media.height ? `${media.width} / ${media.height}` : "3 / 2";

	return (
		<div
			className={`bg-surface-muted relative overflow-hidden rounded-lg ${className ?? ""}`}
			style={{ aspectRatio: ratio }}
		>
			<Image
				src={media.url}
				alt={media.alt}
				fill
				sizes={sizes}
				priority={priority}
				className="object-cover"
			/>
		</div>
	);
}

/**
 * A caption under a figure.
 *
 * Split out because three blocks carry one — `image`, `gallery.items[]` and, in the
 * media object itself, a second caption the storefront deliberately ignores. Only the
 * block-level caption is editorial; the media caption belongs to the asset library and
 * would say the same thing on every page that reuses the picture.
 */
export function CmsCaption({ children }: { children: ReactNode }): ReactNode {
	return <figcaption className="text-text-tertiary mt-2 text-sm">{children}</figcaption>;
}
