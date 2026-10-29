import { type ContentBlock } from "@/lib/catalog-content/contract";
import { plainText } from "@/lib/editorjs-sanitize";

/**
 * A category description that is an article: a short lead, then sections.
 *
 * Saleor keeps one description per category. CFM writes the lead as the opening paragraphs and the
 * advice after them, starting at the first heading, the same cut `splitContent` makes for the
 * vehicle pages (`top` above the listing, `body` below it). The category page used to flatten the
 * whole description into the hero, which for an article means a wall of text above the products
 * and no headings, lists or links.
 *
 * ## When this does NOT apply
 *
 * Every description that is not unmistakably such an article is left to the old path, so a
 * category that has one plain paragraph, a description that opens with a heading, a table, an
 * image or a block this renderer does not draw reads exactly as before:
 *
 * - the first block is not a heading and a heading follows (a lead and sections),
 * - every block is a paragraph, a heading of level 2 or 3, or a list of text.
 */
export interface CategoryArticle {
	/** The lead as plain text, for the hero and the meta description fallback. */
	readonly heroText: string;
	/** The sections, from the first heading on, for the block renderer below the listing. */
	readonly body: readonly ContentBlock[];
}

const isText = (value: unknown): value is string => typeof value === "string";

function asBlock(raw: unknown): ContentBlock | null {
	if (!raw || typeof raw !== "object") return null;
	const { type, data } = raw as { type?: unknown; data?: Record<string, unknown> };
	if (!data || typeof data !== "object") return null;
	if (type === "paragraph" && isText(data.text)) {
		return { type: "paragraph", data: { text: data.text } };
	}
	if (type === "header" && isText(data.text) && (data.level === 2 || data.level === 3)) {
		return { type: "header", data: { text: data.text, level: data.level } };
	}
	if (type === "list" && Array.isArray(data.items) && data.items.every(isText)) {
		return {
			type: "list",
			data: { style: data.style === "ordered" ? "ordered" : "unordered", items: data.items as string[] },
		};
	}
	return null;
}

export function readCategoryArticle(raw: string | null | undefined): CategoryArticle | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	const rawBlocks = (parsed as { blocks?: unknown } | null)?.blocks;
	if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return null;

	const blocks: ContentBlock[] = [];
	for (const entry of rawBlocks) {
		const block = asBlock(entry);
		if (!block) return null;
		blocks.push(block);
	}

	const firstHeading = blocks.findIndex((block) => block.type === "header");
	if (firstHeading <= 0) return null;

	const lead = blocks.slice(0, firstHeading);
	const heroText = lead
		.map((block) => {
			if (block.type === "paragraph") return plainText(block.data.text);
			if (block.type === "list") return block.data.items.map(plainText).join(" ");
			return "";
		})
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	if (!heroText) return null;
	return { heroText, body: blocks.slice(firstHeading) };
}
