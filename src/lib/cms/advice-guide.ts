import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type CmsBlock } from "./blocks";
import { cmsCollectionTag, cmsPageTag } from "./cache-tags";
import { fetchCmsPage } from "./client";
import { type LexicalDocument, type LexicalNode, nodeChildren, nodeText } from "./lexical";
import { marketForChannel, payloadLocaleForMarket } from "./markets";

/**
 * The Poradňa guide as the homepage's "Poradňa a tipy" shows it: its title and lead, and its
 * sections as the topics under it — each a link to its own anchor on `/poradna`.
 *
 * Real content only (brief: "Poradňa: len skutočné články"). Payload has a `posts` collection,
 * but it holds no article yet and the storefront has no article route, so the one published
 * guide — the `poradna` page — is what the section lists. A section appears as a topic when the
 * editor gave it an anchor ID; its title is its first heading, its line the first paragraph.
 */

export const ADVICE_GUIDE_SLUG = "poradna";

export type AdviceTopic = { readonly anchor: string; readonly title: string; readonly text: string | null };

export type AdviceGuide = {
	readonly title: string;
	readonly lead: string | null;
	readonly topics: readonly AdviceTopic[];
};

const ANCHOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A topic's line is a teaser, cut at a word. */
const TEXT_LIMIT = 90;

function plainText(node: LexicalNode): string {
	if (node.type === "text") return nodeText(node);
	if (node.type === "linebreak") return " ";
	return nodeChildren(node).map(plainText).join("");
}

function firstOf(document: LexicalDocument, type: string): string | null {
	for (const node of nodeChildren(document.root)) {
		if (node.type !== type) continue;
		const text = plainText(node).replace(/\s+/g, " ").trim();
		if (text) return text;
	}
	return null;
}

function teaser(text: string | null): string | null {
	if (!text) return null;
	if (text.length <= TEXT_LIMIT) return text;
	const cut = text.slice(0, TEXT_LIMIT);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[\s,;:–-]+$/, "")}…`;
}

/** Pure half of `getAdviceGuide`, exported for its test: page blocks → the guide's outline. */
export function adviceGuideFromBlocks(blocks: readonly CmsBlock[]): AdviceGuide | null {
	let title: string | null = null;
	let lead: string | null = null;
	const topics: AdviceTopic[] = [];

	for (const block of blocks) {
		if (block.blockType === "hero" && title === null) {
			title = block.heading.trim() || null;
			lead = block.subheading?.trim() || null;
			continue;
		}
		const anchor = block.anchorId?.trim().toLowerCase();
		if (!anchor || !ANCHOR.test(anchor)) continue;
		if (block.blockType === "richText") {
			const heading = firstOf(block.content, "heading");
			if (heading) topics.push({ anchor, title: heading, text: teaser(firstOf(block.content, "paragraph")) });
		} else if (block.blockType === "mediaText" && block.heading) {
			topics.push({ anchor, title: block.heading, text: teaser(firstOf(block.content, "paragraph")) });
		} else if (block.blockType === "faq" && block.heading) {
			topics.push({ anchor, title: block.heading, text: teaser(block.items[0]?.question ?? null) });
		}
	}

	if (!title) return null;
	return { title, lead, topics };
}

/**
 * This market's guide, or `null` where it is not published. A fault THROWS, so an unreachable
 * CMS is never cached as "no guide"; the section falls back to its own words meanwhile.
 */
export async function getAdviceGuide(channel: string): Promise<AdviceGuide | null> {
	"use cache";
	cacheLife("hours");
	const pageTag = cmsPageTag(ADVICE_GUIDE_SLUG);
	const collectionTag = cmsCollectionTag("pages");
	if (pageTag) cacheTag(pageTag);
	if (collectionTag) cacheTag(collectionTag);

	const market = marketForChannel(channel);
	if (!market) return null;

	const outcome = await fetchCmsPage(ADVICE_GUIDE_SLUG, payloadLocaleForMarket(market), market);
	if (outcome.status === "error") throw new Error(`[Advice] CMS unavailable: ${outcome.reason}`);
	if (outcome.status !== "found") return null;
	return adviceGuideFromBlocks(outcome.page.layout);
}
