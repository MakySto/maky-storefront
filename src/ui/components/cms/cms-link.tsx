import { type ReactNode } from "react";
import { type CmsBlockLink } from "@/lib/cms/blocks";
import { cmsPathForRelationship } from "@/lib/cms/link-routes";
import { marketHref } from "@/lib/channel-map";

/**
 * A block-level link, or the plain text of one that has nowhere to go.
 *
 * The second case is the contract's, not a convenience:
 *
 *   „Podporovaný Page/Post link s `null` alebo chýbajúcim relationship targetom nesmie
 *    vytvoriť odhadovanú route; jeho label sa môže vykresliť ako neinteraktívny text."
 *
 * So a link whose target was deleted or never set renders its label and nothing else.
 * Unsupported collections and populated targets with no actual storefront route are
 * rejected by the parser before this component runs.
 *
 * Route derivation happens here rather than in the parser because the market prefix comes
 * from the channel, and the parser has no business knowing which market is being served.
 */
export function CmsLink({ link, channel }: { link: CmsBlockLink; channel: string }): ReactNode {
	const style =
		link.appearance === "primary"
			? "bg-action-primary text-action-primary-text hover:bg-action-primary-hover"
			: "border-border-default text-text-primary hover:bg-surface-muted border";

	const shared = `focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none`;

	if (link.target.kind === "none") {
		// Deliberately not a <span role="link"> or a disabled <a>: this is not a link that
		// is temporarily unavailable, it is text that was going to be a link.
		return <span className={`${shared} ${style} cursor-default opacity-60`}>{link.label}</span>;
	}

	const path =
		link.target.kind === "internal" ? cmsPathForRelationship(link.target.collection, link.target.slug) : null;

	// Belt-and-braces only: populated targets with no registered route fail validation.
	// Never invent an href should an unchecked value reach this renderer directly.
	if (link.target.kind === "internal" && path === null) {
		return <span className={`${shared} ${style} cursor-default opacity-60`}>{link.label}</span>;
	}

	const href = link.target.kind === "external" ? link.target.url : marketHref(channel, path!);

	const external = link.target.kind === "external";

	return (
		<a
			href={href}
			className={`${shared} ${style}`}
			{...(link.newTab ? { target: "_blank", rel: external ? "noopener noreferrer" : "noopener" } : {})}
		>
			{link.label}
		</a>
	);
}
