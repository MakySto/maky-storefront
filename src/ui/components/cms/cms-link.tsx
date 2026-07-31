import { type ReactNode } from "react";
import { type CmsBlockLink } from "@/lib/cms/blocks";
import { marketHref } from "@/lib/channel-map";

/**
 * A block-level link, or the plain text of one that has nowhere to go.
 *
 * The second case is the contract's, not a convenience:
 *
 *   „Podporovaný Page/Post link s `null` alebo chýbajúcim relationship targetom nesmie
 *    vytvoriť odhadovanú route; jeho label sa môže vykresliť ako neinteraktívny text."
 *
 * So a link whose target was deleted, never set, or points at a collection outside the
 * contract renders its label and nothing else. The two obvious alternatives are both
 * worse: guessing a route from the label invents a destination, and dropping the label
 * silently removes something an editor wrote.
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

	const href =
		link.target.kind === "external"
			? link.target.url
			: marketHref(channel, hrefForCollection(link.target.collection, link.target.slug));

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

/**
 * The storefront path for an internal target.
 *
 * `pages` are CMS routes at the market root. `posts` belong to Poradňa; until that route
 * exists the honest answer is that the collection has no storefront home, and the caller
 * turns that into non-interactive text rather than a link into nothing.
 */
function hrefForCollection(collection: "pages" | "posts", slug: string): string {
	return collection === "pages" ? `/${slug}` : `/poradna/${slug}`;
}
