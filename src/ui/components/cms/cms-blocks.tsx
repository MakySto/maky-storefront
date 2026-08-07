import { Fragment, type ReactNode } from "react";
import { type CmsBlock, type CmsBlockLink } from "@/lib/cms/blocks";
import { isVisibleInMarket, type MarketCode } from "@/lib/cms/markets";
import { CmsLink } from "./cms-link";
import { CmsCaption, CmsImage } from "./cms-media";
import { LexicalContent } from "./lexical-content";

/**
 * Renders a Payload page's `layout` array.
 *
 * By the time blocks reach this component they are all renderable: an unsupported
 * `blockType`, an unrenderable Lexical node and missing required content each reject the
 * entire document back in `parseBlock`. So there is no "skip the odd one out" branch
 * here, and that is the point — a partially rendered page is a silent failure and this
 * component cannot produce one.
 *
 * The dispatch is an exhaustive `switch` ending in a `never` assignment. **It must never
 * gain a `default` that returns null.** A default would turn "the parser accepts a block
 * type nobody wrote a renderer for" from a build error into an empty section on a live
 * page — the failure the fail-closed rule upstream exists to prevent, reintroduced one
 * layer down. `SUPPORTED_BLOCK_TYPES` and the cases below are held together by a test
 * rather than by a comment asking two files to stay in sync.
 *
 * Market filtering happens here per block, and is the one thing that legitimately removes
 * a block: it is an editorial decision, not a gap in the renderer. The page-level filter
 * is the route's job, because there the answer decides between rendering and 404.
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
				const content = renderBlock(block, channel);

				// Only wrap when the editor asked for an anchor, so the default DOM stays flat.
				return block.anchorId ? (
					<section key={key} id={block.anchorId}>
						{content}
					</section>
				) : (
					<Fragment key={key}>{content}</Fragment>
				);
			})}
		</>
	);
}

function renderBlock(block: CmsBlock, channel: string): ReactNode {
	switch (block.blockType) {
		case "hero":
			return (
				<div className="mb-10">
					{block.media ? <CmsImage media={block.media} priority sizes="100vw" className="mb-6" /> : null}
					<h2 className="text-text-primary text-2xl font-semibold tracking-tight">{block.heading}</h2>
					{block.subheading ? <p className="text-text-secondary mt-2 text-base">{block.subheading}</p> : null}
					<LinkRow links={block.links} channel={channel} />
				</div>
			);

		case "richText":
			// No wrapper. The prose column still comes from the page shell, exactly as it did
			// before this change, so `/sk/o-nas` renders byte-identically — verified against
			// what production serves.
			//
			// It belongs here eventually: hero, gallery and mediaText do not want to sit
			// inside a `.prose` column, so a CMS page needs a plain shell with prose scoped
			// to this block. That move changes the DOM of a live page and belongs with the
			// route-factory change, not smuggled into the commit that adds six renderers.
			return <LexicalContent document={block.content} channel={channel} />;

		case "image":
			return (
				<figure className="my-8">
					<CmsImage media={block.media} />
					{block.caption ? <CmsCaption>{block.caption}</CmsCaption> : null}
				</figure>
			);

		case "gallery":
			return (
				<div className="my-8 grid gap-4 sm:grid-cols-2">
					{block.items.map((item, index) => (
						<figure key={item.id ?? `item-${index}`}>
							<CmsImage media={item.media} sizes="(min-width: 640px) 360px, 100vw" />
							{item.caption ? <CmsCaption>{item.caption}</CmsCaption> : null}
						</figure>
					))}
				</div>
			);

		case "cta":
			return (
				<div className="border-border-default bg-surface-muted my-10 rounded-lg border p-6">
					<h2 className="text-text-primary text-xl font-semibold">{block.heading}</h2>
					{block.text ? <p className="text-text-secondary mt-2 text-sm">{block.text}</p> : null}
					<LinkRow links={block.links} channel={channel} />
				</div>
			);

		case "faq":
			return (
				<div className="my-10">
					{block.heading ? (
						<h2 className="text-text-primary mb-4 text-xl font-semibold">{block.heading}</h2>
					) : null}
					<dl className="divide-border-default divide-y">
						{block.items.map((item, index) => (
							<div key={item.id ?? `faq-${index}`} className="py-4">
								<dt className="text-text-primary text-base font-medium">{item.question}</dt>
								<dd className="prose text-text-secondary mt-2 max-w-none text-sm">
									<LexicalContent document={item.answer} channel={channel} />
								</dd>
							</div>
						))}
					</dl>
				</div>
			);

		case "mediaText":
			return (
				<div
					className={`my-10 grid items-center gap-6 md:grid-cols-2 ${
						block.mediaPosition === "left" ? "" : "md:[&>*:first-child]:order-2"
					}`}
				>
					<CmsImage media={block.media} sizes="(min-width: 768px) 360px, 100vw" />
					<div>
						{block.heading ? (
							<h2 className="text-text-primary text-xl font-semibold">{block.heading}</h2>
						) : null}
						<div className="prose mt-2 max-w-none">
							<LexicalContent document={block.content} channel={channel} />
						</div>
						<LinkRow links={block.links} channel={channel} />
					</div>
				</div>
			);

		default: {
			// Not reachable. Adding a block type to the contract must fail the build here.
			const exhaustive: never = block;
			return exhaustive;
		}
	}
}

/** Nothing at all when there are no links — never an empty row taking up space. */
function LinkRow({ links, channel }: { links: readonly CmsBlockLink[]; channel: string }): ReactNode {
	if (links.length === 0) return null;
	return (
		<div className="mt-5 flex flex-wrap gap-3">
			{links.map((link, index) => (
				<CmsLink key={link.id ?? `link-${index}`} link={link} channel={channel} />
			))}
		</div>
	);
}
