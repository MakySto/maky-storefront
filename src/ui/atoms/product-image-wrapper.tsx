import { type ImageProps } from "next/image";
import clsx from "clsx";
import { ResilientProductImage } from "@/ui/components/ui/resilient-product-image";

interface ProductImageWrapperProps extends Omit<ImageProps, "src"> {
	src: string;
	containerClassName?: string;
}

export const ProductImageWrapper = ({
	containerClassName,
	className,
	src,
	...props
}: ProductImageWrapperProps) => {
	return (
		<div className={clsx("bg-secondary aspect-square overflow-hidden", containerClassName)}>
			<ResilientProductImage
				{...props}
				src={src}
				className={clsx("h-full w-full object-cover object-center", className)}
			/>
		</div>
	);
};
