import { cmsPathForRelationship } from "./link-routes";

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
/** Lexical text-format bitmask admitted by the V2 consumer contract. */
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

const ELEMENT_FORMATS: ReadonlySet<unknown> = new Set([
	"",
	"left",
	"start",
	"center",
	"right",
	"end",
	"justify",
]);

const HEADING_TAGS: ReadonlySet<unknown> = new Set(["h2", "h3", "h4"]);
const LIST_TYPES: ReadonlySet<unknown> = new Set(["bullet", "number"]);

/**
 * Find the first node outside the contract's allowlist.
 *
 * Returns the offending node's type, or `null` when the whole tree is renderable.
 *
 * This runs at validation time rather than at render time on purpose. Discovering an
 * unrenderable node mid-render leaves only two bad options — throw, or drop it and
 * serve a page missing a paragraph nobody will notice. Discovering it here means the
 * whole CMS candidate can be rejected while the previous good render is still intact.
 *
 * ## Any unknown type, not just an obviously content-bearing one
 *
 * This used to ask a second question — does the node LOOK like it carries content? — and
 * let a bare marker such as `{ type: "horizontalrule", version: 1 }` through on the
 * grounds that skipping a separator loses nothing. The v2 contract removes that
 * judgement, in `unsupported-content-policy.md`:
 *
 *   „Neznámy node sa nesmie automaticky považovať za inertný len preto, že nemá známe
 *   textové pole."
 *
 * The old rule required guessing, from a shape nobody has described yet, whether content
 * lives in a field this function does not read. It got `horizontalrule` right and would
 * have got a future `callout` with its text under an unread key wrong — silently, which is
 * the one failure mode this whole layer exists to prevent. `horizontalrule` is itself
 * outside the v2 allowlist now, so the case that motivated the exception no longer needs
 * it.
 *
 * Safe to tighten because it was checked first: the live `o-nas` document contains only
 * `root`, `paragraph` and `text`.
 */
export function findUnrenderableNode(document: LexicalDocument): string | null {
	const walk = (node: LexicalNode): string | null => {
		if (!RENDERABLE_NODE_TYPES.has(node.type)) return node.type;

		for (const child of nodeChildren(node)) {
			const found = walk(child);
			if (found) return found;
		}

		return null;
	};

	return walk(document.root);
}

/** Every bit the contract defines. Anything outside this mask is not ours to interpret. */
const KNOWN_FORMAT_BITS =
	TEXT_FORMAT.bold |
	TEXT_FORMAT.italic |
	TEXT_FORMAT.strikethrough |
	TEXT_FORMAT.underline |
	TEXT_FORMAT.code;

export type LexicalValidation =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: string; readonly nodeType: string | null };

type LexicalFailure = Extract<LexicalValidation, { readonly ok: false }>;

/**
 * Validate the complete Lexical tree before any element is rendered.
 *
 * The allowlist alone is insufficient. A known node with malformed children, a heading
 * outside h2–h4, a list whose enum is unknown, or a link with a malformed relationship
 * wrapper would otherwise pass validation and be silently coerced or truncated by the
 * defensive renderer. V2 explicitly requires node types, required fields, enums, format
 * bits, URL protocols and relationship targets to be checked recursively.
 */
export function validateLexicalDocument(document: LexicalDocument): LexicalValidation {
	const fail = (reason: string, nodeType: string | null = null): LexicalFailure => ({
		ok: false,
		reason,
		nodeType,
	});

	const validateElementFormat = (node: LexicalNode, path: string): LexicalValidation | null => {
		if (node.format === undefined || node.format === null) return null;
		if (!ELEMENT_FORMATS.has(node.format)) {
			return fail(`${path}.format is outside the supported alignment enum`, node.type);
		}
		return null;
	};

	const validateChildren = (
		node: LexicalNode,
		path: string,
	): { readonly ok: true; readonly children: readonly LexicalNode[] } | LexicalFailure => {
		if (!Array.isArray(node.children)) {
			return fail(`${path}.children is not an array`, node.type);
		}
		const children: LexicalNode[] = [];
		for (const [index, child] of node.children.entries()) {
			if (!isLexicalNode(child)) {
				return fail(`${path}.children[${index}] is not a Lexical node`, node.type);
			}
			children.push(child);
		}
		return { ok: true, children };
	};

	const validateLink = (node: LexicalNode, path: string): LexicalValidation | null => {
		if (!isRecord(node.fields)) return fail(`${path}.fields is not an object`, node.type);

		const { linkType, newTab } = node.fields;
		if (newTab !== undefined && newTab !== null && typeof newTab !== "boolean") {
			return fail(`${path}.fields.newTab is not a boolean`, node.type);
		}

		if (linkType === "custom") {
			if (typeof node.fields.url !== "string" || safeLinkUrl(node.fields.url) === null) {
				return fail(`${path}.fields.url is not an allowed absolute URL`, node.type);
			}
			return null;
		}

		if (linkType !== "internal") {
			return fail(`${path}.fields.linkType is not custom or internal`, node.type);
		}

		const doc = node.fields.doc;
		// A deleted or inaccessible target is an explicit degrade in V2: keep the words
		// and emit no guessed route.
		if (doc === undefined || doc === null) return null;
		if (!isRecord(doc)) {
			return fail(`${path}.fields.doc is a malformed relationship wrapper`, node.type);
		}

		const relationTo = doc.relationTo;
		if (relationTo !== "pages" && relationTo !== "posts") {
			return fail(`${path}.fields.doc.relationTo is unsupported`, node.type);
		}

		const target = doc.value;
		if (target === undefined || target === null) return null;
		if (!isRecord(target)) {
			return fail(`${path}.fields.doc.value is not a populated relationship target`, node.type);
		}
		if (typeof target.slug !== "string" || target.slug.length === 0) {
			return fail(`${path}.fields.doc.value.slug is missing`, node.type);
		}
		if (cmsPathForRelationship(relationTo, target.slug) === null) {
			return fail(`${path}.fields.doc target has no storefront route`, node.type);
		}
		return null;
	};

	const walk = (
		node: LexicalNode,
		path: string,
		documentRoot: boolean,
		parentType: string | null,
	): LexicalValidation => {
		if (!RENDERABLE_NODE_TYPES.has(node.type)) {
			return fail(`${path} has unsupported node type ${node.type}`, node.type);
		}
		if (node.type === "root" && !documentRoot) {
			return fail(`${path} contains a nested root node`, node.type);
		}

		switch (node.type) {
			case "text": {
				if (typeof node.text !== "string") return fail(`${path}.text is not a string`, node.type);
				if (node.children !== undefined && node.children !== null) {
					return fail(`${path} text unexpectedly carries children`, node.type);
				}
				if (
					typeof node.format !== "number" ||
					!Number.isInteger(node.format) ||
					node.format < 0 ||
					node.format > KNOWN_FORMAT_BITS ||
					(node.format & ~KNOWN_FORMAT_BITS) !== 0
				) {
					return fail(`${path}.format is not a supported text-format bitmask`, node.type);
				}
				return { ok: true };
			}

			case "linebreak":
				if (node.children !== undefined && node.children !== null) {
					return fail(`${path} linebreak unexpectedly carries children`, node.type);
				}
				return { ok: true };

			case "heading":
				if (!HEADING_TAGS.has(node.tag)) {
					return fail(`${path}.tag is not h2, h3 or h4`, node.type);
				}
				break;

			case "list": {
				if (!LIST_TYPES.has(node.listType)) {
					return fail(`${path}.listType is not bullet or number`, node.type);
				}
				const expectedTag = node.listType === "number" ? "ol" : "ul";
				if (node.tag !== expectedTag) {
					return fail(`${path}.tag does not match listType`, node.type);
				}
				if (typeof node.start !== "number" || !Number.isInteger(node.start) || node.start < 1) {
					return fail(`${path}.start is not a positive integer`, node.type);
				}
				break;
			}

			case "listitem":
				if (parentType !== "list") {
					return fail(`${path} listitem is not a direct child of a list`, node.type);
				}
				if (typeof node.value !== "number" || !Number.isInteger(node.value) || node.value < 1) {
					return fail(`${path}.value is not a positive integer`, node.type);
				}
				if (node.checked !== undefined && node.checked !== null) {
					return fail(`${path}.checked is unsupported outside checklist content`, node.type);
				}
				break;

			case "link":
			case "autolink": {
				const linkFailure = validateLink(node, path);
				if (linkFailure) return linkFailure;
				break;
			}
		}

		const formatFailure = validateElementFormat(node, path);
		if (formatFailure) return formatFailure;

		const children = validateChildren(node, path);
		if (!children.ok) return children;
		if (node.type === "list" && children.children.some((child) => child.type !== "listitem")) {
			return fail(`${path}.children contains a non-listitem node`, node.type);
		}
		for (const [index, child] of children.children.entries()) {
			const childResult = walk(child, `${path}.children[${index}]`, false, node.type);
			if (!childResult.ok) return childResult;
		}
		return { ok: true };
	};

	return walk(document.root, "root", true, null);
}

/**
 * Find the first `text` node carrying a format bit the contract does not define.
 *
 * Returns the offending bitmask, or `null`. Deliberately a rejection rather than a
 * silent drop, which is the v2 contract's explicit instruction:
 *
 *   „Neznámy bit znamená contract violation kandidáta; nesmie sa potichu zahodiť."
 *
 * The v1 comment argued the other way — ignore unknown bits so a future editor feature
 * cannot blank out a paragraph — and that reasoning was sound for the failure it feared.
 * It is the wrong trade here. Dropping a bit does not blank a paragraph; it renders the
 * paragraph without the emphasis the editor applied, which is a quiet misrepresentation of
 * published content. A rejected candidate is visible and recoverable; a subscript silently
 * rendered as plain text is neither.
 *
 * Bit 0 — no formatting — is the overwhelmingly common case and passes trivially.
 */
export function findUnsupportedTextFormat(document: LexicalDocument): number | null {
	const walk = (node: LexicalNode): number | null => {
		if (node.type === "text" && typeof node.format === "number" && Number.isInteger(node.format)) {
			if ((node.format & ~KNOWN_FORMAT_BITS) !== 0) return node.format;
		}
		for (const child of nodeChildren(node)) {
			const found = walk(child);
			if (found !== null) return found;
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

	try {
		const parsed = new URL(trimmed);
		return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
	} catch {
		return null;
	}
}

/** Which Payload collection an internal link points at. */
export type LinkTargetCollection = "pages" | "posts";

export interface LexicalLink {
	/** External/custom link: an already-validated href. */
	readonly url: string | null;
	/** Internal link: the referenced collection plus that document's slug. */
	readonly internal: { collection: LinkTargetCollection; slug: string } | null;
	readonly newTab: boolean;
}

/**
 * The collections this consumer contract understands. `brands` is deliberately absent:
 * the Payload editor offers it, the Page V2 consumer contract does not, and the contract
 * states that an unknown `relationTo` is a violation rather than something to degrade.
 * {@link findUnsupportedLinkTarget} enforces that before anything renders.
 */
const LINK_COLLECTIONS = new Set<string>(["pages", "posts"]);

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

/**
 * The first link in `document` whose destination the contract does not allow, or `null`.
 *
 * Two cases, both contract violations rather than degrades:
 *
 *   custom url the storefront refuses   `javascript:`, `data:`, a protocol-relative or
 *                                       backslash-authority path — {@link safeLinkUrl}
 *                                       decides, and this reuses that exact decision so
 *                                       the two can never disagree.
 *   `relationTo` outside the contract   `brands` is the named example.
 *
 * The distinction against a degrade is the relationship *target*, not the relationship:
 * „Podporovaný Page/Post link s `null` alebo chýbajúcim relationship targetom nesmie
 * vytvoriť odhadovanú route" — that one still renders as inert text, because the editor
 * pointed at a collection this contract knows and the document is simply gone. A link to
 * a collection the contract never agreed to is a different fact: it means the provider
 * and this consumer disagree about what a link can be, and the candidate is rejected.
 */
export function findUnsupportedLinkTarget(document: LexicalDocument): string | null {
	const walk = (node: LexicalNode): string | null => {
		if (node.type === "link" || node.type === "autolink") {
			const fields =
				typeof node.fields === "object" && node.fields !== null
					? (node.fields as Record<string, unknown>)
					: {};
			if (fields.linkType === "internal") {
				const doc = fields.doc;
				const relationTo =
					typeof doc === "object" && doc !== null ? (doc as { relationTo?: unknown }).relationTo : undefined;
				if (typeof relationTo === "string" && !LINK_COLLECTIONS.has(relationTo)) {
					return `relationTo ${relationTo}`;
				}
			} else if (fields.url !== undefined && fields.url !== null && safeLinkUrl(fields.url) === null) {
				return `url ${typeof fields.url === "string" ? fields.url : typeof fields.url}`;
			}
		}
		for (const child of nodeChildren(node)) {
			const found = walk(child);
			if (found !== null) return found;
		}
		return null;
	};
	return walk(document.root);
}
