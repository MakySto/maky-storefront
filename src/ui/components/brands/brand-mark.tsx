import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Brand } from "@/lib/brands/catalog";

/**
 * A brand's mark: the owner's logo from Payload when there is one, otherwise the name set as a
 * wordmark — black, heavy, uppercase — so a brand without a logo yet still reads as a brand.
 */
export function BrandMark({
	brand,
	className,
	size = "default",
}: {
	brand: Pick<Brand, "name" | "logo">;
	className?: string;
	size?: "default" | "large";
}) {
	if (brand.logo) {
		return (
			<span className={cn("relative block", size === "large" ? "h-16 w-48" : "h-10 w-32", className)}>
				<Image
					src={brand.logo.url}
					alt={brand.logo.alt || brand.name}
					fill
					sizes={size === "large" ? "192px" : "128px"}
					className="object-contain"
				/>
			</span>
		);
	}
	return (
		<span
			className={cn(
				"text-text-primary block font-black tracking-[0.02em] whitespace-nowrap uppercase",
				size === "large" ? "text-4xl sm:text-5xl" : "text-xl",
				className,
			)}
		>
			{brand.name}
		</span>
	);
}
