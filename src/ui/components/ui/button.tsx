import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "secondary" | "outline-solid" | "ghost" | "destructive";
	size?: "default" | "sm" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		return (
			<button
				ref={ref}
				className={cn(
					// Base styles
					// 8px corners since the 2026-09 redesign: the approved mockups square the buttons off,
					// and the 16px pill read as a toy next to the photography.
					"inline-flex items-center justify-center gap-2 rounded-xs font-medium whitespace-nowrap",
					// Transitions
					"transition-all duration-200",
					// Focus states
					"focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
					// Disabled states
					"disabled:pointer-events-none disabled:opacity-50",
					// Variants
					{
						"hover:bg-primary/90 bg-primary text-primary-foreground shadow-xs": variant === "default",
						"hover:bg-secondary/80 bg-secondary text-secondary-foreground": variant === "secondary",
						"border-input bg-background hover:bg-accent hover:text-accent-foreground border shadow-xs":
							variant === "outline-solid",
						"hover:bg-accent hover:text-accent-foreground": variant === "ghost",
						"hover:bg-destructive/90 bg-destructive text-destructive-foreground shadow-xs":
							variant === "destructive",
					},
					// Sizes
					{
						"h-10 px-4 py-2 text-sm": size === "default",
						"h-9 px-3 text-sm": size === "sm",
						"h-14 px-8 text-base": size === "lg",
						"h-10 w-10 p-0": size === "icon",
					},
					className,
				)}
				{...props}
			/>
		);
	},
);

Button.displayName = "Button";
