"use client";

import { type FC } from "react";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";

type StripePaymentProcessingOverlayProps = {
	title: string;
	description?: string;
};

/** Covers Stripe Elements while confirm/process runs — keeps Elements mounted. */
export const StripePaymentProcessingOverlay: FC<StripePaymentProcessingOverlayProps> = ({
	title,
	description = "Túto stránku prosím nezatvárajte ani neobnovujte.",
}) => {
	return (
		<div
			className="bg-card absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<LoadingSpinner />
			<p className="text-foreground mt-4 text-sm font-medium">{title}</p>
			<p className="text-muted-foreground mt-1 max-w-xs text-xs">{description}</p>
		</div>
	);
};
