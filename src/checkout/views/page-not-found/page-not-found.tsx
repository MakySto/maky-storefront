"use client";

import { type FallbackProps } from "react-error-boundary";
import Link from "next/link";
import { ShoppingBag, ArrowLeft, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/ui/components/shared/logo";

interface PageNotFoundProps extends Partial<FallbackProps> {
	title?: string;
	message?: string;
}

export const PageNotFound = ({ title, message }: PageNotFoundProps) => {
	const t = useTranslations("checkout.notFound");
	const tCart = useTranslations("cart");
	const tCommon = useTranslations("checkout.common");
	const resolvedTitle = title ?? t("title");
	const resolvedMessage = message ?? t("message");
	return (
		<div className="bg-secondary min-h-screen">
			{/* Header */}
			<header className="border-border bg-background border-b">
				<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
					<Link href="/" className="flex items-center">
						<Logo className="text-foreground h-5 w-auto" />
					</Link>
				</div>
			</header>

			{/* Main content */}
			<main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-md">
					<div className="border-border bg-card rounded-lg border p-8 text-center shadow-sm">
						{/* Icon */}
						<div className="bg-muted mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
							<AlertCircle className="text-muted-foreground h-8 w-8" />
						</div>

						{/* Title */}
						<h1 className="text-foreground mb-2 text-xl font-semibold">{resolvedTitle}</h1>

						{/* Message */}
						<p className="text-muted-foreground mb-8">{resolvedMessage}</p>

						{/* Actions */}
						<div className="flex flex-col gap-3">
							<Link
								href="/"
								className="hover:bg-primary/90 bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-md font-medium shadow-xs transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
							>
								<ShoppingBag className="h-4 w-4" />
								{tCart("continueShopping")}
							</Link>
							<button
								onClick={() => history.back()}
								className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 text-sm transition-colors"
							>
								<ArrowLeft className="h-4 w-4" />
								{tCommon("back")}
							</button>
						</div>
					</div>

					{/* Help text */}
					<p className="text-muted-foreground mt-6 text-center text-sm">{t("helpText")}</p>
				</div>
			</main>
		</div>
	);
};
