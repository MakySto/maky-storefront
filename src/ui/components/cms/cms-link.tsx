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

	const path = link.target.kind === "internal" ? hrefForCollection(link.target.collection) : null;

	// An internal target whose collection has no storefront route is the same situation as
	// a missing relationship: there is nowhere to send the visitor. Rendering the label as
	// text is the contract's answer, and it is better than an anchor to a URL that 404s.
	if (link.target.kind === "internal" && path === null) {
		return <span className={`${shared} ${style} cursor-default opacity-60`}>{link.label}</span>;
	}

	const href =
		link.target.kind === "external"
			? link.target.url
			: marketHref(channel, `${path}/${(link.target as { slug: string }).slug}`);

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
 * The storefront path prefix for an internal target, or `null` when there is none.
 *
 * `pages` are CMS routes at the market root. `posts` have no route: `/sk/poradna` is a
 * single CMS page, not an index with `/poradna/<slug>` articles under it. An earlier
 * version of this function returned `/poradna/${slug}` anyway while the comment above it
 * claimed the opposite — an anchor to a hard 404, from a fixture the contract ships.
 *
 * When posts do get a route, this returns its prefix and the caller starts linking them.
 * Until then `null` sends the label down the non-interactive path, which is what the
 * Lexical link reader already does for the same target.
 */
function hrefForCollection(collection: "pages" | "posts"): string | null {
	return collection === "pages" ? "" : null;
}
