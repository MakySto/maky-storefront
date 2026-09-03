import xss, { type IWhiteList } from "xss";
interface EditorJSBlock {
	type: string;
	data: Record<string, unknown>;
}

interface EditorJSContent {
	time?: number;
	blocks: EditorJSBlock[];
	version?: string;
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

const BLOCK_TAGS: IWhiteList = {
	...INLINE_TAGS,
	blockquote: [],
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
	table: [],
	tbody: [],
	td: [],
	th: [],
	thead: [],
	tr: [],
	ul: [],
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
			return withHeadings
				? `<table><thead>${renderedRows[0]}</thead><tbody>${renderedRows.slice(1).join("")}</tbody></table>`
				: `<table><tbody>${renderedRows.join("")}</tbody></table>`;
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
export function parseEditorJSToHtml(content: string | null | undefined): string[] | null {
	if (!content) return null;
	const parsed = parseContent(content);
	if (!parsed) {
		const trimmed = content.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
		return [sanitizeBlock(`<p>${sanitizeInline(content)}</p>`)];
	}

	const blocks = parsed.blocks
		.map(renderBlock)
		.filter((block): block is string => Boolean(block))
		.map(sanitizeBlock);
	return blocks.length > 0 ? blocks : null;
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

	const html = parsed.blocks.map(renderBlock).filter((block): block is string => Boolean(block)).join(" ");
	const text = xss(html, {
		whiteList: {},
		stripIgnoreTag: true,
		stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
	});
	return text.trim() || null;
}
