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
				className={`h-7 w-7 shrink-0 sm:h-11 sm:w-11 ${inverted ? "brightness-0 invert" : ""}`}
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
						// The slogan is WIDER than the wordmark (130px vs 104px at their mobile
						// sizes), so it is what decides how much room the lockup needs. Rather
						// than hide it on small phones, it shrinks: 10px with tighter tracking
						// measures ~108px and fits the 112px a 360px viewport leaves after the
						// hamburger and the three action icons. `truncate` stays as the backstop
						// for anything narrower than ~340px.
						className={`truncate text-[0.625rem] leading-tight font-medium tracking-tight sm:text-[0.6875rem] sm:tracking-wide ${
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
