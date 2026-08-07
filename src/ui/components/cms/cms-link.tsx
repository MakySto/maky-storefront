import { type ReactNode } from "react";
import { type CmsBlockLink } from "@/lib/cms/blocks";
import { cmsPathForRelationship } from "@/lib/cms/link-routes";
import { marketHref } from "@/lib/channel-map";

function logDegraded(event: string, detail: Record<string, unknown>): void {
	console.warn(`[cms] ${event}`, JSON.stringify(detail));
}

/**
 * A block-level link, or the plain text of one that has nowhere to go.
 *
 * The second case is the contract's, not a convenience:
 *
 *   „Podporovaný Page/Post link s `null` alebo chýbajúcim relationship targetom nesmie
 *    vytvoriť odhadovanú route; jeho label sa môže vykresliť ako neinteraktívny text."
 *
 * So a link whose target was deleted, has no consumer route or uses a harmless local URL
 * renders its label and nothing else. Unsupported collections, malformed wrappers and
 * unsafe URLs are rejected by the parser before this component runs.
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
		if (link.target.degradation?.kind === "relative-url") {
			logDegraded("link-url-rendered-as-text", {
				url: link.target.degradation.value,
			});
		}

		// Deliberately not a <span role="link"> or a disabled <a>: this is not a link that
		// is temporarily unavailable, it is text that was going to be a link.
		return <span className={`${shared} ${style} cursor-default opacity-60`}>{link.label}</span>;
	}

	const path =
		link.target.kind === "internal" ? cmsPathForRelationship(link.target.collection, link.target.slug) : null;

	// Never invent an href for a valid Payload relationship whose consumer route does not
	// exist yet. Keeping the label is safer than taking the complete Page back to bootstrap.
	if (link.target.kind === "internal" && path === null) {
		logDegraded("link-target-has-no-route", {
			collection: link.target.collection,
			slug: link.target.slug,
		});
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
