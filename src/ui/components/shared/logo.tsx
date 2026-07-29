import Image from "next/image";

interface LogoProps {
	className?: string;
	inverted?: boolean;
	showSlogan?: boolean;
	slogan?: string;
}

export const Logo = ({ className, inverted = false, showSlogan = false, slogan }: LogoProps) => {
	return (
		<div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${className ?? ""}`}>
			<Image
				src="/logo-deer.webp"
				alt=""
				width={44}
				height={44}
				className={`h-8 w-8 shrink-0 sm:h-11 sm:w-11 ${inverted ? "brightness-0 invert" : ""}`}
				priority
			/>
			<div className="flex min-w-0 flex-col">
				<span
					className={`truncate text-base leading-tight font-bold tracking-tight sm:text-xl ${
						inverted ? "text-white" : "text-copper-600"
					}`}
				>
					MAKY.STORE
				</span>
				{showSlogan && slogan && (
					// aria-hidden: the logo link is labelled "MAKY.STORE". Leaving the slogan
					// in the accessible name both made it a mouthful to hear and tripped the
					// visible-label/accessible-name match rule, since the label named only part
					// of the visible text.
					<span
						aria-hidden
						// Hidden on the narrowest phones. It is wider than the wordmark, so it
						// was the thing forcing "MAKY.ST…" — and a truncated slogan reads worse
						// than no slogan.
						className={`hidden truncate text-[0.6875rem] leading-tight font-medium tracking-wide min-[400px]:block ${
							inverted ? "text-neutral-400" : "text-copper-600"
						}`}
					>
						{slogan}
					</span>
				)}
			</div>
		</div>
	);
};
