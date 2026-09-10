"use client";

import { useTranslations } from "next-intl";

/**
 * Error fallback for variant section.
 * Shown when an error occurs during streaming/rendering.
 * Allows user to retry without losing the rest of the page.
 *
 * Must be a Client Component because it's passed as a prop to ErrorBoundary.
 */
export function VariantSectionError({ resetErrorBoundary }: { resetErrorBoundary?: () => void }) {
	const t = useTranslations("account");
	const tCommon = useTranslations("common");
	return (
		<>
			{/* Empty space for category row - order:1 */}
			<div className="order-1" />

			{/* Error state - order:3 */}
			<div className="border-destructive/20 bg-destructive/5 order-3 mt-4 rounded-lg border p-6 text-center">
				<p className="text-muted-foreground mb-3 text-sm">{t("variantsUnavailable")}</p>
				{resetErrorBoundary && (
					<button
						type="button"
						onClick={resetErrorBoundary}
						className="text-foreground text-sm font-medium underline underline-offset-4 hover:no-underline"
					>
						{tCommon("retry")}
					</button>
				)}
			</div>
		</>
	);
}
