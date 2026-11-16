"use client";

import { type FC, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { orderLegalLinks } from "@/checkout/lib/order-legal-links";
import { cn } from "@/lib/utils";

/**
 * The sentence beside the order button: what the customer agrees to by ordering, with the terms, the privacy
 * notice and the withdrawal information one click away (owner, 2026-11-16). The links open in a new tab, so a
 * filled-in payment form is not lost by reading them.
 */
export const OrderLegalNote: FC<{ channelSlug: string; className?: string }> = ({
	channelSlug,
	className,
}) => {
	const t = useTranslations("checkout");
	const links = orderLegalLinks(channelSlug);
	if (!links) return null;

	// A page in a new tab: a filled-in card form is not lost by reading it.
	const link = (href: string) =>
		function LegalLink(chunks: ReactNode) {
			return (
				<a
					href={href}
					target="_blank"
					rel="noopener"
					className="underline underline-offset-2 hover:no-underline"
				>
					{chunks}
				</a>
			);
		};

	return (
		<p
			className={cn("text-muted-foreground text-xs leading-relaxed", className)}
			data-testid="order-legal-note"
		>
			{t.rich("payment.legalNote", {
				terms: link(links.terms),
				privacy: link(links.privacy),
				withdrawal: link(links.withdrawal),
			})}
		</p>
	);
};
