import xss, { safeAttrValue as defaultSafeAttrValue, type IWhiteList } from "xss";
interface EditorJSBlock {
	type: string;
	data: Record<string, unknown>;
}

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

export interface ParseOptions {
	/**
	 * Present where the page wants the comparison-table profile read: a table that carries its
	 * markers (see `docs/contracts/comparison-table.md`) is then set as a comparison. Without
	 * it every table is the plain, scrolling table it always was — which is what text
	 * extraction for metadata relies on.
	 */
	comparison?: ComparisonLabels;
}

const INLINE_TAGS: IWhiteList = {
	a: ["href", "title", "target", "rel"],
	b: [],
	br: [],
	code: [],
	em: [],
	i: [],
	mark: [],
	strong: [],
};

/**
 * The one class this renderer is allowed to emit.
 *
 * A wide table has to be able to scroll inside its own box, or it widens the
 * page and the whole document pans sideways on a phone. That needs a container
 * element, and the container needs a hook to style — so `div` carries `class`,
 * and `safeAttrValue` below rejects every value except this exact one. Nothing
 * from Saleor can reach that attribute in any case: cell text is sanitized with
 * INLINE_TAGS first, which has neither `div` nor any `class`.
 */
export const TABLE_SCROLL_CLASS = "maky-prose-scroll";

const BLOCK_TAGS: IWhiteList = {
	...INLINE_TAGS,
	// `class` and the few ARIA/focus attributes exist for what this renderer builds itself — the
	// scroll container and the comparison table. Cell text is sanitized with INLINE_TAGS before
	// it is placed in any of them, so none of it can reach these attributes; and
	// `safeAttrValue` below accepts only the exact values this file emits.
	div: ["class", "tabindex", "role", "aria-label"],
	span: ["class", "aria-hidden"],
	blockquote: [],
	caption: ["class"],
	figcaption: [],
	figure: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	hr: [],
	img: ["src", "alt", "width", "height", "loading", "decoding"],
	li: [],
	ol: [],
	p: [],
	table: ["class"],
	tbody: [],
	td: ["class", "colspan"],
	th: ["class", "scope", "colspan"],
	thead: [],
	tr: ["class"],
	ul: [],
};

/**
 * The classes each tag may carry, and no others. `maky-prose-scroll` is the plain table's
 * container; the rest belong to the comparison table (styled in `brand.css`). `not-prose` keeps
 * the typography plugin's table rules off it.
 */
const COMPARISON_CLASSES: Record<string, readonly string[]> = {
	div: ["maky-cmp", "maky-cmp-head", "maky-cmp-frame", "maky-cmp-scroll", "not-prose"],
	span: [
		"maky-cmp-cap",
		"maky-cmp-you",
		"maky-cmp-name",
		"maky-cmp-yes",
		"maky-cmp-no",
		"maky-cmp-nil",
		"maky-cmp-fade",
		"maky-cmp-gl",
		"maky-cmp-sv",
		"maky-cmp-sr",
	],
	caption: ["maky-cmp-sr"],
	table: ["maky-cmp-table"],
	tr: ["maky-cmp-grp", "maky-cmp-common"],
	th: ["maky-cmp-self"],
	td: ["maky-cmp-self", "maky-cmp-same", "maky-cmp-nw"],
};

/** What a value is allowed to be, per attribute, once the tag has let the attribute through. */
const FIXED_ATTRIBUTE_VALUES: Record<string, RegExp> = {
	scope: /^(col|row|rowgroup)$/,
	colspan: /^[1-9]\d?$/,
	tabindex: /^0$/,
	role: /^region$/,
	"aria-hidden": /^true$/,
};

const sanitizeInline = (value: unknown): string =>
	xss(typeof value === "string" ? value : "", {
		whiteList: INLINE_TAGS,
		stripIgnoreTag: true,
		stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
	});

const sanitizeBlock = (value: string): string =>
	xss(value, {
		whiteList: BLOCK_TAGS,
		stripIgnoreTag: true,
		stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
		safeAttrValue(tag, name, value, cssFilter) {
			// `class` exists for what this renderer builds and nothing else. A value is kept
			// only when it is the scroll container's exact class, or when every token is one
			// this tag is listed for; anything else is dropped rather than passed through, so
			// widening the whitelist cannot become a general styling channel.
			if (name === "class") {
				if (value === TABLE_SCROLL_CLASS && tag === "div") return value;
				const allowed = COMPARISON_CLASSES[tag] ?? [];
				const tokens = value.split(/\s+/).filter(Boolean);
				return tokens.length > 0 && tokens.every((token) => allowed.includes(token)) ? tokens.join(" ") : "";
			}
			if (name === "aria-label")
				return tag === "div" ? defaultSafeAttrValue(tag, name, value, cssFilter) : "";
			const fixed = FIXED_ATTRIBUTE_VALUES[name];
			if (fixed) return fixed.test(value) ? value : "";
			return defaultSafeAttrValue(tag, name, value, cssFilter);
		},
	});

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

const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
	const level = Math.min(6, Math.max(2, Number(title?.level) || 2));
	const plainTitle = xss(titleHtml, { whiteList: {}, stripIgnoreTag: true });
	const heading = titleHtml
		? `<div class="maky-cmp-head"><h${level}>${titleHtml}</h${level}><span class="maky-cmp-cap">${escapeHtml(
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
			const alt = xss(caption, { whiteList: {}, stripIgnoreTag: true });
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

/**
 * Render only explicitly supported Editor.js blocks.
 *
 * Malformed/unknown JSON is never printed back to the shopper. Plain legacy
 * text remains supported and is escaped into one paragraph.
 */
export function parseEditorJSToHtml(
	content: string | null | undefined,
	options: ParseOptions = {},
): string[] | null {
	if (!content) return null;
	const parsed = parseContent(content);
	if (!parsed) {
		const trimmed = content.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
		return [sanitizeBlock(`<p>${sanitizeInline(content)}</p>`)];
	}

	const rendered: string[] = [];
	const { blocks } = parsed;
	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		if (options.comparison) {
			// A heading directly above a comparison table is that table's title.
			const next = blocks[index + 1];
			const titled = block.type === "header" && next?.type === "table";
			const table = titled ? next : block;
			const html =
				table.type === "table"
					? renderComparison(
							table.data ?? {},
							options.comparison,
							titled ? ((block.data ?? {}) as never) : undefined,
						)
					: null;
			if (html) {
				rendered.push(html);
				if (titled) index += 1;
				continue;
			}
		}
		const html = renderBlock(block);
		if (html) rendered.push(html);
	}
	const safe = rendered.map(sanitizeBlock);
	return safe.length > 0 ? safe : null;
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
