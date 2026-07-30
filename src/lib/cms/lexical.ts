/**
 * Lexical (Payload rich text) node model — the subset the storefront renders.
 *
 * Deliberately NOT `@payloadcms/richtext-lexical`: that package exists to power
 * the editor and carries a `payload` peer dependency. The storefront only reads,
 * and reading is a bounded walk over a documented node tree.
 *
 * The renderer builds React elements rather than an HTML string, so there is no
 * `dangerouslySetInnerHTML` and no sanitiser in the path — the safety comes from
 * construction. The one place untrusted input still reaches an HTML attribute is
 * a link `href`, which is why {@link safeLinkUrl} exists.
 *
 * Node coverage is wider than what the current content happens to use. Verified in
 * production content: root, paragraph, text, linebreak, autolink. Also handled,
 * because the editor can emit them and a missing case would silently drop half a
 * page: heading (h2–h4), list, listitem, link.
 */

/**
 * Lexical text-format bitmask. Unknown bits are ignored rather than fatal — a
 * future editor feature must not blank out a paragraph.
 */
export const TEXT_FORMAT = {
	bold: 1,
	italic: 2,
	strikethrough: 4,
	underline: 8,
	code: 16,
} as const;

/** Element-level alignment. Lexical writes `"start"` for the default. */
export type LexicalElementFormat = "" | "left" | "start" | "center" | "right" | "end" | "justify";

/**
 * A Lexical node as it arrives over the wire: an object with a string `type` and
 * otherwise unknown shape. Narrowing happens per node in the renderer, so an
 * unrecognised node cannot crash it — but one that carries content is rejected before
 * it ever gets there. See {@link findUnrenderableNode}.
 */
export interface LexicalNode {
	readonly type: string;
	readonly [key: string]: unknown;
}

/** The value Payload stores in a rich-text field. */
export interface LexicalDocument {
	readonly root: LexicalNode;
}

export function isLexicalNode(value: unknown): value is LexicalNode {
	return (
		typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
	);
}

export function isLexicalDocument(value: unknown): value is LexicalDocument {
	return (
		typeof value === "object" &&
		value !== null &&
		isLexicalNode((value as { root?: unknown }).root) &&
		(value as { root: LexicalNode }).root.type === "root"
	);
}

/** Children of an element node; `[]` for leaves and for anything malformed. */
export function nodeChildren(node: LexicalNode): LexicalNode[] {
	const raw = node.children;
	if (!Array.isArray(raw)) return [];
	return raw.filter(isLexicalNode);
}

/**
 * Node types the renderer has a case for.
 *
 * The renderer switches on `node.type`; this set is the same list in data form so
 * validation can reject a document *before* it reaches the renderer. The two are kept
 * honest by a test that renders one of each type and asserts none of them logs as
 * unsupported — a comment asking two files to stay in sync would not survive contact
 * with a new node type.
 */
export const RENDERABLE_NODE_TYPES: ReadonlySet<string> = new Set([
	"root",
	"paragraph",
	"heading",
	"quote",
	"list",
	"listitem",
	"text",
	"linebreak",
	"link",
	"autolink",
]);

/**
 * Whether skipping this node would lose published content.
 *
 * Text is the obvious case. But an `upload` node carries an image and no text at all,
 * so a plain "does it have text" test would let a published photograph vanish in
 * silence — the exact failure this policy exists to prevent. A node therefore also
 * counts as content-bearing when it carries any of the payload shapes Payload uses to
 * embed content: children, a `fields` object, or a relationship.
 *
 * What stays inert is a bare marker such as `{ type: "horizontalrule", version: 1 }`.
 * Skipping one of those loses a separator, not content, and it is logged either way.
 *
 * Known limit: a future node could hold text in a field this function does not look at,
 * and would then be judged inert. There is no way to recognise content in a shape
 * nobody has described yet; the structured log is what makes that case findable.
 */
function isContentBearing(node: LexicalNode): boolean {
	if (typeof node.text === "string" && node.text.trim().length > 0) return true;

	const children = nodeChildren(node);
	if (children.length > 0) return true;

	if (typeof node.fields === "object" && node.fields !== null) return true;
	if (typeof node.relationTo === "string" && node.relationTo.length > 0) return true;
	if (node.value !== undefined && node.value !== null) return true;

	return false;
}

/**
 * Find the first node the storefront cannot render without losing content.
 *
 * Returns the offending node's type, or `null` when the whole tree is renderable.
 *
 * This runs at validation time rather than at render time on purpose. Discovering an
 * unrenderable node mid-render leaves only two bad options — throw, or drop it and
 * serve a page missing a paragraph nobody will notice. Discovering it here means the
 * whole CMS candidate can be rejected while the previous good render is still intact.
 */
export function findUnrenderableNode(document: LexicalDocument): string | null {
	const walk = (node: LexicalNode): string | null => {
		if (!RENDERABLE_NODE_TYPES.has(node.type) && isContentBearing(node)) return node.type;

		for (const child of nodeChildren(node)) {
			const found = walk(child);
			if (found) return found;
		}

		return null;
	};

	return walk(document.root);
}

/** Text of a `text` node. Empty string when absent — never `undefined`. */
export function nodeText(node: LexicalNode): string {
	return typeof node.text === "string" ? node.text : "";
}

/** Which formats a `text` node carries. Unknown bits are dropped. */
export function textFormats(node: LexicalNode): {
	bold: boolean;
	italic: boolean;
	strikethrough: boolean;
	underline: boolean;
	code: boolean;
} {
	const format = typeof node.format === "number" && Number.isFinite(node.format) ? node.format : 0;
	return {
		bold: (format & TEXT_FORMAT.bold) !== 0,
		italic: (format & TEXT_FORMAT.italic) !== 0,
		strikethrough: (format & TEXT_FORMAT.strikethrough) !== 0,
		underline: (format & TEXT_FORMAT.underline) !== 0,
		code: (format & TEXT_FORMAT.code) !== 0,
	};
}

/**
 * Heading level, clamped to h2–h4.
 *
 * H1 belongs to the page title and is disabled in the editor, but an imported or
 * hand-edited document could still carry one; promoting it would produce two H1s
 * on the page, so it is rendered as an h2.
 */
export function headingTag(node: LexicalNode): "h2" | "h3" | "h4" {
	const tag = typeof node.tag === "string" ? node.tag.toLowerCase() : "";
	if (tag === "h3") return "h3";
	if (tag === "h4") return "h4";
	if (tag === "h5" || tag === "h6") return "h4";
	return "h2";
}

export function listTag(node: LexicalNode): "ol" | "ul" {
	return node.listType === "number" || node.listType === "ordered" ? "ol" : "ul";
}

/** Tailwind text-align class for an element format, or `undefined` for the default. */
export function alignmentClass(node: LexicalNode): string | undefined {
	switch (node.format) {
		case "center":
			return "text-center";
		case "right":
		case "end":
			return "text-right";
		case "justify":
			return "text-justify";
		// "", "left" and "start" are all the default reading direction.
		default:
			return undefined;
	}
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Validate a URL destined for an `href`.
 *
 * Returns the URL when it is safe to link, `null` when the caller should render
 * the link text as plain text instead. `javascript:`, `data:` and `vbscript:` must
 * never survive — `autolink` nodes are produced from whatever an editor typed, so
 * this is genuinely untrusted input.
 *
 * `new URL()` does the hard part: it strips tabs, newlines and leading whitespace
 * before parsing the scheme, so `jav\tascript:alert(1)` and ` javascript:alert(1)`
 * both normalise to the `javascript:` protocol and get rejected.
 */
export function safeLinkUrl(raw: unknown): string | null {
	if (typeof raw !== "string") return null;

	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;

	// Same-page anchors and root-relative paths carry no scheme to abuse.
	// `//host` is protocol-relative, not relative — it falls through to URL parsing,
	// which rejects it for having no base.
	if (trimmed.startsWith("#")) return trimmed;
	if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

	try {
		const parsed = new URL(trimmed);
		return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
	} catch {
		return null;
	}
}

/** Which Payload collection an internal link points at. */
export type LinkTargetCollection = "pages" | "posts" | "brands";

export interface LexicalLink {
	/** External/custom link: an already-validated href. */
	readonly url: string | null;
	/** Internal link: the referenced collection plus that document's slug. */
	readonly internal: { collection: LinkTargetCollection; slug: string } | null;
	readonly newTab: boolean;
}

const LINK_COLLECTIONS = new Set<string>(["pages", "posts", "brands"]);

/**
 * Read a `link` / `autolink` node's destination.
 *
 * Internal links carry a relationship rather than a URL. At `depth=1` Payload
 * populates it to an object with a `slug`; at `depth=0` it is a bare id string,
 * which cannot be turned into a URL — that resolves to `null` and the renderer
 * falls back to plain text rather than emitting a broken link.
 */
export function readLink(node: LexicalNode): LexicalLink {
	const fields =
		typeof node.fields === "object" && node.fields !== null ? (node.fields as Record<string, unknown>) : {};

	const newTab = fields.newTab === true;

	if (fields.linkType === "internal") {
		const doc = fields.doc;
		if (typeof doc === "object" && doc !== null) {
			const relationTo = (doc as { relationTo?: unknown }).relationTo;
			const value = (doc as { value?: unknown }).value;
			if (
				typeof relationTo === "string" &&
				LINK_COLLECTIONS.has(relationTo) &&
				typeof value === "object" &&
				value !== null &&
				typeof (value as { slug?: unknown }).slug === "string"
			) {
				return {
					url: null,
					internal: {
						collection: relationTo as LinkTargetCollection,
						slug: (value as { slug: string }).slug,
					},
					newTab,
				};
			}
		}
		return { url: null, internal: null, newTab };
	}

	return { url: safeLinkUrl(fields.url), internal: null, newTab };
}
