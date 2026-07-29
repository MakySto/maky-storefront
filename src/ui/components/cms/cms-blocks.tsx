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
 * An unsupported block renders nothing and logs one structured line naming the
 * type. It does not invalidate the whole response: rejecting the page would mean
 * that adding a new block type in Payload silently blanks a live page. Logging the
 * gap keeps the rest of the page serving while making the omission findable — a
 * published block must never disappear without a trace, because the editor sees
 * "publish succeeded" and would never learn part of the page is missing.
 *
 * Market filtering happens here per block. The page-level filter is the route's
 * job, because there the answer decides between rendering and falling back.
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

				if ("unsupported" in block) {
					console.error(
						"[cms] unsupported-block",
						JSON.stringify({ blockType: block.blockType, blockId: block.id, index }),
					);
					return null;
				}

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
