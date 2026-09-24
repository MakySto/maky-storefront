import { type ReactNode } from "react";
/**
 * The frame the photo sits in, shared by the photo and its fallback so the swap cannot move
 * anything: the same aspect ratio and corner radius either way.
 */
export function HeroPhotoFrame({ children }: { children?: ReactNode }) {
	return (
		<div className="bg-text-inverse/5 relative aspect-[4/3] w-full overflow-hidden rounded-xl sm:aspect-[16/10] lg:aspect-[5/4] xl:aspect-[4/3]">
			{children}
		</div>
	);
}
