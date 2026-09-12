import { type BlockDocument, type CatalogContentPage, type ContentBlock } from "./contract";

/**
 * Which blocks go above the product listing, and which go below.
 *
 * ## The export ships the split — now
 *
 * It did not always. In the 2026-09-11 pre-publish export `top`/`body` were empty
 * on every one of the 1475 pages, so a consumer that rendered them literally
 * rendered 1473 blank pages and passed every build. The split had to be derived
 * from `intro`, which the artifact itself calls the source of truth.
 *
 * The 2026-09-12 post-publish export DOES materialise them: measured non-empty on
 * all 1474 pages that have text, empty only on the one that has none, in all ten
 * languages. So the export path is the live path now and the derivation is what it
 * always claimed to be — a fallback.
 *
 * ## Why the export path never used to fire
 *
 * `top` and `body` are BARE ARRAYS of blocks; `intro` is a block document with a
 * `.blocks` property. Reading `.blocks` off all three read `undefined` off the two
 * arrays, so the export branch was unreachable and every page silently took the
 * derivation. That was invisible while the arrays were empty and would have stayed
 * invisible now, because the two agree — see below.
 *
 * ## The derivation and the export agree, which is why this was safe to get wrong
 *
 * Measured on the 2026-09-12 SK export: deriving the cut at the first `header`
 * reproduces the shipped `top`/`body` byte for byte on all 1475 pages, and
 * `intro.blocks === top ++ body` on all 1475. So switching to the export changes no
 * rendered output today. It is worth doing anyway: the agreement is CFM's to break,
 * not ours to depend on, and `source` should say what actually happened.
 *
 * What must never happen is rendering `intro` alongside `top`/`body`, because they
 * are the same words twice.
 */
export interface SplitContent {
	readonly top: readonly ContentBlock[];
	readonly body: readonly ContentBlock[];
	/** `export` when the artifact carried the split; `derived` when we cut it here. */
	readonly source: "export" | "derived" | "empty";
}

/** `intro` — a block document. */
const blocksOf = (document: BlockDocument | null | undefined): readonly ContentBlock[] =>
	Array.isArray(document?.blocks) ? document.blocks : [];

/** `top`/`body` — bare arrays. Tolerates a block document too, so a shape change is not an outage. */
const sectionOf = (
	section: readonly ContentBlock[] | BlockDocument | null | undefined,
): readonly ContentBlock[] => {
	if (Array.isArray(section)) return section as readonly ContentBlock[];
	return blocksOf(section as BlockDocument | null | undefined);
};

export function splitContent(page: CatalogContentPage): SplitContent {
	const exportedTop = sectionOf(page.top);
	const exportedBody = sectionOf(page.body);
	if (exportedTop.length > 0 || exportedBody.length > 0) {
		return { top: exportedTop, body: exportedBody, source: "export" };
	}

	const intro = blocksOf(page.intro);
	if (intro.length === 0) return { top: [], body: [], source: "empty" };

	const firstHeading = intro.findIndex((block) => block.type === "header");
	if (firstHeading <= 0) {
		// No heading, or the page opens with one: nothing sensible to lift above the
		// listing, so the whole article stays below it rather than being split at an
		// arbitrary block.
		return { top: [], body: intro, source: "derived" };
	}
	return { top: intro.slice(0, firstHeading), body: intro.slice(firstHeading), source: "derived" };
}

/** Is there anything a reader would call text? Used to keep thin pages honest. */
export function hasReadableText(page: CatalogContentPage): boolean {
	const { top, body } = splitContent(page);
	return [...top, ...body].some((block) => {
		if (block.type === "list") return block.data.items.some((item) => stripTags(item).trim().length > 0);
		return stripTags(block.data.text).trim().length > 0;
	});
}

/** Tags removed for a length/emptiness test only — never for rendering. */
export function stripTags(value: string): string {
	return value.replace(/<[^>]*>/g, "");
}
