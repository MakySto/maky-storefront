import { type BlockDocument, type CatalogContentPage, type ContentBlock } from "./contract";

/**
 * Which blocks go above the product listing, and which go below.
 *
 * ## The export does not contain the split
 *
 * The integration plan says `top`/`body` are "the split, materialised in the
 * export", and the artifact's own `reading` note describes them the same way. In
 * the 2026-09-11 export they are **empty on every one of the 1475 pages** —
 * measured, not inferred: `intro only: 1473`, `split only: 0`, `both: 0`. Only
 * `intro` carries text.
 *
 * So a consumer that renders `top` and `body` literally, as the plan's layout
 * section describes, renders 1473 blank pages and passes every build. The split
 * has to be derived here, from `intro`, which the artifact itself calls the source
 * of truth.
 *
 * ## Where the cut goes
 *
 * Before the first `header`, and from that header onwards. That is not a guess
 * about prose: every page with text has at least one header (measured: 0 without),
 * and the first one sits at index 1 on 1358 pages and index 2 on 115. So the lead
 * is one or two paragraphs — a short intro — and everything from the first heading
 * down is the advisory article. That is exactly the shape the layout wants.
 *
 * If a future export DOES materialise `top`/`body`, they win: the derivation is a
 * fallback, not a second opinion. What must never happen is rendering `intro`
 * alongside `top`/`body`, because they are the same words twice.
 */
export interface SplitContent {
	readonly top: readonly ContentBlock[];
	readonly body: readonly ContentBlock[];
	/** `export` when the artifact carried the split; `derived` when we cut it here. */
	readonly source: "export" | "derived" | "empty";
}

const blocksOf = (document: BlockDocument | null | undefined): readonly ContentBlock[] =>
	Array.isArray(document?.blocks) ? document.blocks : [];

export function splitContent(page: CatalogContentPage): SplitContent {
	const exportedTop = blocksOf(page.top);
	const exportedBody = blocksOf(page.body);
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
