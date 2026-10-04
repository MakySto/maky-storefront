import xss from "xss";
import {
	hasText,
	isUnknownRole,
	readEnvelope,
	readMarker,
	renderRole,
	type ContentBlock,
	type ContentIssue,
	type ContentLabels,
} from "./editorjs-content";
import {
	escapeHtml,
	plainText,
	sanitizeBlock,
	sanitizeInline,
	TABLE_SCROLL_CLASS,
} from "./editorjs-sanitize";

export { TABLE_SCROLL_CLASS };
export type { ContentLabels };

type EditorJSBlock = ContentBlock;

interface EditorJSContent {
	time?: number;
	blocks: EditorJSBlock[];
	version?: string;
}

/**
 * The fixed words a comparison table speaks in, in the shopper's language.
 *
 * They come from the message catalogue at the call site and never from the document: the
 * cells are the catalogue's data (and may be in the source language), but the table's own
 * words — "this model", "same for all models", yes, no — are the storefront's, so they
 * follow the market and nothing a product description contains can say them.
 */
export interface ComparisonLabels {
	thisModel: string;
	/** "5 models", counted and inflected by the caller's catalogue. */
	models: (count: number) => string;
	/** Names the (visually empty) first column for assistive technology. */
	parameter: string;
	sameForAll: string;
	/** The accessible name of the scrollable region. */
	scrollRegion: string;
	yes: string;
	no: string;
}

interface ParseOptions {
	/**
	 * Present where the page wants the comparison-table profile read: a table that carries its
	 * markers (see `docs/contracts/comparison-table.md`) is then set as a comparison. Without
	 * it every table is the plain, scrolling table it always was — which is what text
	 * extraction for metadata relies on.
	 */
	comparison?: ComparisonLabels;
	/**
	 * Present where the page wants the typed content profile read (`docs/contracts/maky-content.md`):
	 * a document whose `version` is `maky-content/1…` then has its marked blocks drawn as callouts,
	 * benefits, the contents of the box and so on. Without it every block is the plain block it is
	 * in Saleor, which is what text extraction for metadata relies on.
	 */
	content?: ContentLabels;
}

const positiveDimension = (value: unknown, fallback: number): number =>
	typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;

function safeImageUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value, "https://maky.store");
		return url.protocol === "http:" || url.protocol === "https:" ? value : null;
	} catch {
		return null;
	}
}

function renderListItem(item: unknown): string {
	if (typeof item === "string") return `<li>${sanitizeInline(item)}</li>`;
	if (!item || typeof item !== "object") return "";
	const record = item as Record<string, unknown>;
	const content = sanitizeInline(record.content);
	const children = Array.isArray(record.items) ? record.items.map(renderListItem).join("") : "";
	return `<li>${content}${children ? `<ul>${children}</ul>` : ""}</li>`;
}

// ─── Comparison table ────────────────────────────────────────────────────────────────────────
//
// A `table` block that carries the markers of the comparison profile is set as the approved
// comparison table: the current model's column highlighted, the rows in titled parts, yes/no as
// marks, and the rows that are the same for every model gathered into one band. The profile is
// built only from what Saleor keeps of an Editor.js table (header flag, string cells, inline
// `<mark>`), so there is no second document format: the contract, with the example both
// repositories test against, is `docs/contracts/comparison-table.md`.

const YES_MARK = "\u2713";
const NO_MARK = "\u2717";
const ABSENT_MARK = "\u2014";
const CURRENT_HEADER = /^\s*<mark>([\s\S]*)<\/mark>\s*$/i;
/** Dimensions ("669 × 374 × 398 mm") keep to one line where the width allows it. */
const DIMENSION_VALUE = /\d\s×\s\d/;

const cellText = (value: unknown): string => (typeof value === "string" ? value : "");

/** A part's heading: its first cell is filled and every other cell is empty. */
const isGroupRow = (cells: string[]): boolean =>
	cells.length >= 2 && cells[0].trim() !== "" && cells.slice(1).every((cell) => cell.trim() === "");

interface ComparisonRow {
	label: string;
	cells: string[];
}

interface ComparisonGroup {
	heading: string | null;
	rows: ComparisonRow[];
}

interface ComparisonTable {
	header: string[];
	currentIndex: number;
	groups: ComparisonGroup[];
}

/**
 * Read the profile out of a table block, or answer null when the table is not one. A table is a
 * comparison only if it has headings, three or more equal-width columns, and at least one marker
 * of its own: a highlighted header, a titled part, or a yes/no mark. An ordinary specification
 * table has none, so it stays the table it was.
 */
function readComparison(data: Record<string, unknown>): ComparisonTable | null {
	if (data.withHeadings !== true || !Array.isArray(data.content)) return null;
	const rows = data.content.filter(Array.isArray) as unknown[][];
	if (rows.length < 2) return null;
	const width = rows[0].length;
	if (width < 3 || rows.some((row) => row.length !== width)) return null;

	const text = rows.map((row) => row.map(cellText));
	const [header, ...body] = text;

	const marked = header
		.map((cell, index) => (index > 0 && CURRENT_HEADER.test(cell) ? index : -1))
		.filter((i) => i > 0);
	const hasGroups = body.some(isGroupRow);
	const hasAnswers = body.some((cells) => cells.some((cell) => [YES_MARK, NO_MARK].includes(cell.trim())));
	if (marked.length === 0 && !hasGroups && !hasAnswers) return null;

	const groups: ComparisonGroup[] = [];
	for (const cells of body) {
		if (isGroupRow(cells)) {
			groups.push({ heading: cells[0], rows: [] });
			continue;
		}
		if (groups.length === 0) groups.push({ heading: null, rows: [] });
		groups[groups.length - 1].rows.push({ label: cells[0], cells: cells.slice(1) });
	}
	// One highlighted header is the current model; two is not an answer, so neither is shown.
	return { header, currentIndex: marked.length === 1 ? marked[0] : -1, groups };
}

function renderComparison(
	data: Record<string, unknown>,
	labels: ComparisonLabels,
	title?: { text: unknown; level: unknown },
	/** In a typed document the title is set like every other block's: an `h3` of the shared class. */
	typed = false,
): string | null {
	const table = readComparison(data);
	if (!table) return null;

	const width = table.header.length;
	const valueColumns = width - 1;
	const valueOf = (raw: string): string => {
		const value = raw.trim();
		if (value === YES_MARK) {
			return `<span class="maky-cmp-yes" aria-hidden="true"></span><span class="maky-cmp-sr">${escapeHtml(
				labels.yes,
			)}</span>`;
		}
		if (value === NO_MARK) return `<span class="maky-cmp-no">${escapeHtml(labels.no)}</span>`;
		if (value === ABSENT_MARK) return `<span class="maky-cmp-nil">${ABSENT_MARK}</span>`;
		return sanitizeInline(raw);
	};
	const same = (row: ComparisonRow): boolean => new Set(row.cells.map((cell) => cell.trim())).size === 1;

	// Rows that are the same for every model are gathered into one band — but only when something
	// else differs, or the whole table would be a band and say nothing.
	const mergeSame = valueColumns >= 2 && table.groups.some((group) => group.rows.some((row) => !same(row)));
	const groupRow = (heading: string, extra = ""): string =>
		`<tr class="maky-cmp-grp${extra}"><th scope="rowgroup" colspan="${width}"><span class="maky-cmp-gl">${sanitizeInline(
			heading,
		)}</span></th></tr>`;
	const valueRow = (row: ComparisonRow): string => {
		const cells = row.cells
			.map((cell, index) => {
				const classes = [
					index + 1 === table.currentIndex ? "maky-cmp-self" : "",
					DIMENSION_VALUE.test(cell) ? "maky-cmp-nw" : "",
				].filter(Boolean);
				return `<td${classes.length ? ` class="${classes.join(" ")}"` : ""}>${valueOf(cell)}</td>`;
			})
			.join("");
		return `<tr><th scope="row">${sanitizeInline(row.label)}</th>${cells}</tr>`;
	};

	const body: string[] = [];
	const gathered: ComparisonRow[] = [];
	for (const group of table.groups) {
		const kept = mergeSame ? group.rows.filter((row) => !same(row)) : group.rows;
		if (mergeSame) gathered.push(...group.rows.filter(same));
		if (kept.length === 0) continue;
		if (group.heading) body.push(groupRow(group.heading));
		body.push(...kept.map(valueRow));
	}
	if (gathered.length > 0) {
		body.push(groupRow(labels.sameForAll, " maky-cmp-common"));
		for (const row of gathered) {
			// The value sits in a span of its own so it can stay beside the fixed first column while
			// the table scrolls; in a cell as wide as the table it would scroll out of view.
			body.push(
				`<tr><th scope="row">${sanitizeInline(
					row.label,
				)}</th><td class="maky-cmp-same" colspan="${valueColumns}"><span class="maky-cmp-sv">${valueOf(
					row.cells[0],
				)}</span></td></tr>`,
			);
		}
	}

	const head = table.header
		.map((cell, index) => {
			if (index === 0) {
				return `<th scope="col"><span class="maky-cmp-sr">${escapeHtml(labels.parameter)}</span></th>`;
			}
			const current = index === table.currentIndex;
			const name = sanitizeInline(CURRENT_HEADER.exec(cell)?.[1] ?? cell);
			return `<th scope="col"${current ? ' class="maky-cmp-self"' : ""}>${
				current ? `<span class="maky-cmp-you">${escapeHtml(labels.thisModel)}</span>` : ""
			}<span class="maky-cmp-name">${name}</span></th>`;
		})
		.join("");

	// The heading directly above the table is its title; the caption beside it counts the models.
	const titleHtml = title ? sanitizeInline(title.text) : "";
	const level = typed ? 3 : Math.min(6, Math.max(2, Number(title?.level) || 2));
	const plainTitle = plainText(titleHtml);
	const heading = titleHtml
		? `<div class="maky-cmp-head"><h${level}${
				typed ? ' class="maky-h"' : ""
			}>${titleHtml}</h${level}><span class="maky-cmp-cap">${escapeHtml(
				labels.models(valueColumns),
			)}</span></div>`
		: "";

	return (
		`<div class="maky-cmp">${heading}<div class="not-prose maky-cmp-frame">` +
		`<div class="maky-cmp-scroll" tabindex="0" role="region" aria-label="${escapeHtml(
			labels.scrollRegion,
		)}">` +
		`<table class="maky-cmp-table">${
			plainTitle ? `<caption class="maky-cmp-sr">${escapeHtml(plainTitle)}</caption>` : ""
		}` +
		`<thead><tr>${head}</tr></thead><tbody>${body.join("")}</tbody></table></div>` +
		`<span class="maky-cmp-fade" aria-hidden="true"></span></div></div>`
	);
}

function renderBlock(block: EditorJSBlock): string | null {
	const data = block.data ?? {};
	switch (block.type) {
		case "paragraph":
			return `<p>${sanitizeInline(data.text)}</p>`;
		case "header": {
			const level = Math.min(6, Math.max(2, Number(data.level) || 2));
			return `<h${level}>${sanitizeInline(data.text)}</h${level}>`;
		}
		case "list": {
			const items = Array.isArray(data.items) ? data.items.map(renderListItem).join("") : "";
			if (!items) return null;
			const tag = data.style === "ordered" ? "ol" : "ul";
			return `<${tag}>${items}</${tag}>`;
		}
		case "quote":
			return `<blockquote><p>${sanitizeInline(data.text)}</p>${
				data.caption ? `<p>${sanitizeInline(data.caption)}</p>` : ""
			}</blockquote>`;
		case "delimiter":
			return "<hr>";
		case "table": {
			if (!Array.isArray(data.content)) return null;
			const rows = data.content.filter(Array.isArray) as unknown[][];
			if (rows.length === 0) return null;
			const withHeadings = data.withHeadings === true;
			const renderedRows = rows.map((row, index) => {
				const cell = withHeadings && index === 0 ? "th" : "td";
				return `<tr>${row.map((value) => `<${cell}>${sanitizeInline(value)}</${cell}>`).join("")}</tr>`;
			});
			const table = withHeadings
				? `<table><thead>${renderedRows[0]}</thead><tbody>${renderedRows.slice(1).join("")}</tbody></table>`
				: `<table><tbody>${renderedRows.join("")}</tbody></table>`;
			// Wrapped so the table scrolls in its own box instead of widening the
			// page. A specification table is exactly the block most likely to be
			// wider than a phone.
			return `<div class="${TABLE_SCROLL_CLASS}">${table}</div>`;
		}
		case "image": {
			const file = data.file && typeof data.file === "object" ? (data.file as Record<string, unknown>) : {};
			const src = safeImageUrl(file.url ?? data.url);
			if (!src) return null;
			const caption = sanitizeInline(data.caption);
			const alt = plainText(caption);
			const width = positiveDimension(data.width ?? file.width, 1024);
			const height = positiveDimension(data.height ?? file.height, 768);
			return `<figure><img src="${src}" alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async">${
				caption ? `<figcaption>${caption}</figcaption>` : ""
			}</figure>`;
		}
		// Embeds and raw HTML are intentionally dropped. A third-party iframe or
		// opaque HTML blob does not become trustworthy because it passed through
		// Saleor. Unknown future blocks fail closed the same way.
		case "embed":
		case "raw":
		default:
			return null;
	}
}

function parseContent(content: string): EditorJSContent | null {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as EditorJSContent).blocks)) {
			return null;
		}
		return parsed as EditorJSContent;
	} catch {
		return null;
	}
}

/** Check whether a string is a well-shaped Editor.js document. */
export function isEditorJSContent(content: string | null | undefined): boolean {
	return Boolean(content && parseContent(content));
}

/** One rendered block of a description, in document order. */
export interface ProductContentBlock {
	html: string;
	/**
	 * Which section a template may lift this block into, when it is one: the model comparison and
	 * the documents each have a card of their own on a template page.
	 */
	section?: "comparison" | "documents";
	/** A lifted block's own heading (sanitized inline HTML) and its body without it, for the page that sets the heading itself. */
	title?: string | null;
	body?: string;
}

interface ProductContent {
	blocks: ProductContentBlock[];
	/** The template the document names (`maky-content/1:<template>`), or null. The registry decides if it knows it. */
	template: string | null;
	/** The typed profile was read: the caller asked for it and the document's major version is known. */
	typed: boolean;
	/** What could not be drawn as intended. A page logs these; none of them removes text. */
	issues: ContentIssue[];
}

/**
 * Render only explicitly supported Editor.js blocks, and say what the document is.
 *
 * Malformed/unknown JSON is never printed back to the shopper. Plain legacy text remains
 * supported and is escaped into one paragraph.
 *
 * With `options.content`, a document of the typed profile (`maky-content/1`) has its marked blocks
 * drawn as their roles. A marked block that cannot be read as its role is rendered as the
 * standard block it is and reported in `issues` — never dropped. Unknown block types are dropped
 * as before, but Saleor stores none, so for a warning that is a defect to be seen: a block that
 * carries a warning marker and has text yet is not shown is an issue of severity `error`.
 */
export function parseProductContent(
	content: string | null | undefined,
	options: ParseOptions = {},
): ProductContent | null {
	if (!content) return null;
	const parsed = parseContent(content);
	if (!parsed) {
		const trimmed = content.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
		return {
			blocks: [{ html: sanitizeBlock(`<p>${sanitizeInline(content)}</p>`) }],
			template: null,
			typed: false,
			issues: [],
		};
	}

	const labels = options.content;
	const envelope = labels ? readEnvelope(parsed.version) : { typed: false, template: null };
	const typed = envelope.typed;
	const issues: ContentIssue[] = [];
	const rendered: ProductContentBlock[] = [];
	const { blocks } = parsed;

	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		const next = blocks[index + 1];

		if (typed && labels) {
			// A heading directly above a marked block is that block's title.
			const header = block.type === "header" && !block.id && next && readMarker(next.id) ? block : null;
			const target = header ? next : block;
			const marker = readMarker(target.id);
			if (marker) {
				const outcome = renderRole(target, marker, header, labels);
				if (!("problem" in outcome)) {
					rendered.push(
						outcome.role === "documents"
							? { html: outcome.html, section: "documents", title: outcome.title, body: outcome.body }
							: { html: outcome.html },
					);
					if (header) index += 1;
					continue;
				}
				// With a heading above, the heading stands as the plain heading it is now and the
				// block is reported on its own turn, so one defect is one issue.
				if (!header) {
					issues.push({
						severity: "warn",
						code: "malformed-block",
						block: index,
						marker: String(block.id),
						detail: outcome.problem,
					});
					const plain = renderBlock(block);
					if (plain) {
						rendered.push({ html: plain });
					} else if (marker.role === "callout" && marker.kind === "warn" && hasText(block)) {
						issues.push({
							severity: "error",
							code: "warning-not-shown",
							block: index,
							marker: String(block.id),
							detail: `a warning of type ${block.type} could not be shown`,
						});
					}
					continue;
				}
			} else if (isUnknownRole(block.id)) {
				issues.push({
					severity: "warn",
					code: "unknown-role",
					block: index,
					marker: String(block.id),
					detail: "a marker this reader does not know; the block is shown as the standard block it is",
				});
			}
		}

		if (options.comparison) {
			// A heading directly above a comparison table is that table's title. A block that carries a
			// marker of the typed profile is never read as a comparison: a malformed specs table has
			// the shape of a small table and must stay what its marker says it is.
			const marked = (candidate: EditorJSBlock | undefined): boolean =>
				typed && Boolean(candidate && (readMarker(candidate.id) || isUnknownRole(candidate.id)));
			const titled = block.type === "header" && next?.type === "table" && !marked(next);
			const table = titled ? next : block;
			const html =
				table.type === "table" && !marked(table)
					? renderComparison(
							table.data ?? {},
							options.comparison,
							titled ? ((block.data ?? {}) as never) : undefined,
							typed,
						)
					: null;
			if (html) {
				rendered.push({ html, section: "comparison" });
				if (titled) index += 1;
				continue;
			}
		}
		const html = renderBlock(block);
		if (html) rendered.push({ html });
	}

	const safe = rendered.map((block) => ({
		...block,
		html: sanitizeBlock(block.html),
		...(block.body === undefined ? {} : { body: sanitizeBlock(block.body) }),
	}));
	// A description with nothing left to show has no blocks, but what went wrong is still said: a
	// warning that could not be drawn must not vanish together with the page it belonged to.
	if (safe.length === 0 && issues.length === 0) return null;
	return { blocks: safe, template: envelope.template, typed, issues };
}

/** The blocks of a description as HTML, one string per block. */
export function parseEditorJSToHtml(
	content: string | null | undefined,
	options: ParseOptions = {},
): string[] | null {
	const parsed = parseProductContent(content, options);
	return parsed && parsed.blocks.length > 0 ? parsed.blocks.map((block) => block.html) : null;
}

/** Extract safe plain text for metadata and listing heroes. */
export function parseEditorJSToText(content: string | null | undefined): string | null {
	if (!content) return null;
	const parsed = parseContent(content);
	if (!parsed) {
		const trimmed = content.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
		return xss(content, { whiteList: {}, stripIgnoreTag: true }) || null;
	}

	const html = parsed.blocks
		.map(renderBlock)
		.filter((block): block is string => Boolean(block))
		.join(" ");
	const text = xss(html, {
		whiteList: {},
		stripIgnoreTag: true,
		stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
	});
	return text.trim() || null;
}
