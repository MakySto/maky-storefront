import Link from "next/link";
import { type ReactNode } from "react";
import { type ContentBlock } from "@/lib/catalog-content/contract";
import { type InlineNode, parseInline, withMarketPrefix } from "@/lib/catalog-content/inline";

/**
 * CFM's editorial blocks, rendered as React elements.
 *
 * There is no `dangerouslySetInnerHTML` here and there must never be one. The inline
 * markup is parsed into nodes upstream, so a string from the snapshot cannot become
 * markup however the export changes — the difference between "we filtered the bad
 * values" and "there is no path from a string to an element".
 *
 * The text is server-rendered, in full, with no interaction required. A visitor on a
 * phone may collapse it; the words are in the document either way, because Google does
 * not click and content that appears only after an interaction is content it does not
 * see.
 *
 * ## Why a link can be refused
 *
 * `linkable` decides whether an inline link may stay a link. CFM's copy cross-references
 * other vehicle pages, and a page it references can be unpublished independently of the
 * page doing the referencing — which is not hypothetical: on the 2026-09-12 delivery two
 * PUBLISHED pages link to `/stresne-nosice/lynk-co/01`, and CFM deliberately held that one
 * back for having no Slovak text. Following it lands on a not-found body.
 *
 * A refused link keeps its words and loses its anchor. Dropping the sentence would edit
 * CFM's copy; leaving the anchor would ship a dead link inside published prose. Omitting
 * the predicate links everything, which is what a caller with no notion of publication
 * should do.
 */

type Linkable = (urlPath: string) => boolean;

function renderInline(
	nodes: readonly InlineNode[],
	market: string,
	keyPrefix: string,
	linkable?: Linkable,
): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		if (node.kind === "text") return <span key={key}>{node.value}</span>;
		if (node.kind === "bold") {
			return <strong key={key}>{renderInline(node.children, market, key, linkable)}</strong>;
		}
		if (linkable && !linkable(node.href)) {
			return <span key={key}>{renderInline(node.children, market, key, linkable)}</span>;
		}
		return (
			<Link
				key={key}
				href={withMarketPrefix(node.href, market)}
				className="text-action-primary hover:underline"
			>
				{renderInline(node.children, market, key, linkable)}
			</Link>
		);
	});
}

export function InlineText({
	text,
	market,
	id,
	linkable,
}: {
	text: string;
	market: string;
	id: string;
	linkable?: Linkable;
}) {
	return <>{renderInline(parseInline(text), market, id, linkable)}</>;
}

export function ContentBlocks({
	blocks,
	market,
	id,
	linkable,
}: {
	blocks: readonly ContentBlock[];
	market: string;
	id: string;
	linkable?: Linkable;
}) {
	if (blocks.length === 0) return null;

	return (
		<div className="text-text-secondary space-y-4 leading-relaxed">
			{blocks.map((block, index) => {
				const key = `${id}-${index}`;
				if (block.type === "paragraph") {
					return (
						<p key={key}>
							<InlineText text={block.data.text} market={market} id={key} linkable={linkable} />
						</p>
					);
				}
				if (block.type === "header") {
					// The schema permits 2 and 3; this export uses only 2. Both are handled
					// because the page's own H1 is above, so a block heading is never an H1.
					const Heading = block.data.level === 3 ? "h3" : "h2";
					return (
						<Heading key={key} className="text-text-primary mt-8 text-lg font-semibold break-words">
							<InlineText text={block.data.text} market={market} id={key} linkable={linkable} />
						</Heading>
					);
				}
				const List = block.data.style === "ordered" ? "ol" : "ul";
				return (
					<List
						key={key}
						className={
							block.data.style === "ordered" ? "list-decimal space-y-2 pl-5" : "list-disc space-y-2 pl-5"
						}
					>
						{block.data.items.map((item, itemIndex) => (
							<li key={`${key}-${itemIndex}`}>
								<InlineText text={item} market={market} id={`${key}-${itemIndex}`} linkable={linkable} />
							</li>
						))}
					</List>
				);
			})}
		</div>
	);
}
