import { Fragment, type ReactNode } from "react";
import { isVisibleInMarket, type MarketCode } from "@/lib/cms/markets";
import { type CmsBlock } from "@/lib/cms/page-schema";
import { LexicalContent } from "./lexical-content";

/**
 * Renders a Payload page's `layout` array.
 *
 * V1 supports `richText` only. There is deliberately no registry of blocks nobody
 * has published yet — the CMS defines fourteen block types and speculatively
 * implementing thirteen of them would be code with no content to validate it.
 *
 * By the time blocks reach this component they are all renderable: an unsupported
 * `blockType` rejects the entire document back in `parsePagesResponse`, so there is
 * no "skip the odd one out" branch here. That is the point — a partially rendered
 * page is a silent failure, and this component cannot produce one.
 *
 * Market filtering happens here per block, and is the one thing that legitimately
 * removes a block: it is an editorial decision, not a gap in the renderer. The
 * page-level filter is the route's job, because there the answer decides between
 * rendering and 404.
 */
export function CmsBlocks({
	blocks,
	channel,
	market,
}: {
	blocks: readonly CmsBlock[];
	channel: string;
	market: MarketCode | null;
}): ReactNode {
	return (
		<>
			{blocks.map((block, index) => {
				if (!isVisibleInMarket(block.markets, market)) return null;

				const key = block.id ?? `block-${index}`;
				const content = <LexicalContent document={block.content} channel={channel} />;

				// Only wrap when the editor asked for an anchor, so the default DOM stays flat.
				return block.anchorId ? (
					<div key={key} id={block.anchorId}>
						{content}
					</div>
				) : (
					<Fragment key={key}>{content}</Fragment>
				);
			})}
		</>
	);
}
