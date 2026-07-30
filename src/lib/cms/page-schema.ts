import { findUnrenderableNode, isLexicalDocument, type LexicalDocument } from "./lexical";

/**
 * Runtime validation of the Payload `/api/pages` response.
 *
 * Payload's generated `payload-types.ts` is not used as the contract here. It types
 * Lexical children as `type: any` with an open index signature, so it would compile
 * against anything; and it describes the CMS's own schema, not what actually
 * arrived over the wire. A published page is untrusted input like any other HTTP
 * response, so it is validated structurally at this boundary.
 *
 * Three outcomes, which must never collapse into one branch:
 *
 *   `ok`      — a published document to render
 *   `empty`   — the CMS answered authoritatively that nothing matches (`docs: []`)
 *   `invalid` — the response did not match the contract; treat as an upstream fault
 *
 * `empty` means the page does not exist and must NOT resurrect a stale fallback.
 * `invalid` means we cannot trust what we got and must fall back.
 *
 * ## All-or-nothing
 *
 * A document is rendered whole or not at all. Anything the storefront cannot render
 * faithfully — an unsupported `blockType`, an unknown content-bearing Lexical node —
 * makes the entire candidate `invalid` rather than being skipped.
 *
 * The rejected alternative was to drop the offending part and render the rest. It
 * produces a page that looks fine, a publish that reported success, and an editor who
 * never learns a paragraph is missing. A page that visibly reverts to its bootstrap
 * copy is a worse-looking failure and a far better one: it is noticed. The cost is
 * real and worth stating — adding a block type in Payload takes this route back to its
 * code fallback until the storefront learns to render it.
 *
 * ## All-or-nothing is about CONTENT, not about key sets
 *
 * The rule above fires on things the storefront would have to render and cannot: an
 * unsupported `blockType`, a content-bearing Lexical node it has no case for. It does
 * NOT fire on an unread field. Every response already carries several — `createdAt`,
 * `hasNextPage`, `totalDocs` — and the parser reads past them by naming what it wants
 * and rebuilding a `CmsPage` from scratch, so nothing unnamed reaches the renderer.
 *
 * Do not "harden" this by rejecting unknown keys. It reads as symmetry with the rule
 * above and is the opposite of it: a CMS-side field addition is routine and additive,
 * and turning one into a rejection would take a healthy page back to its bootstrap copy
 * for a field nobody renders. The concrete case is `legalMetadata`, the inert group the
 * Payload Forms migration adds to every Page; `legal-metadata-compat.test.ts` pins that
 * behaviour, and re-runs the genuine fail-closed rules with the group present to show
 * they still bite.
 */

export interface CmsSeoMeta {
	readonly title: string | null;
	readonly description: string | null;
	readonly image: string | null;
}

interface CmsBlockCommon {
	readonly id: string | null;
	readonly anchorId: string | null;
	readonly blockName: string | null;
	readonly markets: readonly string[] | null;
}

export interface CmsRichTextBlock extends CmsBlockCommon {
	readonly blockType: "richText";
	readonly content: LexicalDocument;
}

/** V1 renders `richText` and nothing else. An unknown type rejects the document. */
export type CmsBlock = CmsRichTextBlock;

export interface CmsPage {
	readonly id: string;
	readonly title: string;
	readonly slug: string;
	readonly summary: string | null;
	readonly layout: readonly CmsBlock[];
	readonly markets: readonly string[] | null;
	readonly meta: CmsSeoMeta;
	readonly updatedAt: string | null;
}

/**
 * Why a candidate was rejected, in a shape a log line can carry.
 *
 * `reason` alone is not enough to act on. When an editor reports "the About page went
 * back to the old text", the answer has to be one grep away: which document, which
 * slug, which block type or node type. Hence the identifying fields, populated
 * whenever validation got far enough to know them.
 */
export interface CmsContractViolation {
	readonly reason: string;
	readonly documentId: string | null;
	readonly slug: string | null;
	/** Set when an unsupported Page `blockType` is the cause. */
	readonly blockType: string | null;
	/** Set when an unrenderable Lexical node type is the cause. */
	readonly nodeType: string | null;
}

export type CmsPageParse =
	| { readonly status: "ok"; readonly page: CmsPage }
	| { readonly status: "empty" }
	| { readonly status: "invalid"; readonly violation: CmsContractViolation };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** `null` (all markets) or an array of strings. Anything else is a contract break. */
function parseMarkets(value: unknown): { ok: true; markets: readonly string[] | null } | { ok: false } {
	if (value === null || value === undefined) return { ok: true, markets: null };
	if (!Array.isArray(value)) return { ok: false };
	if (!value.every((entry) => typeof entry === "string")) return { ok: false };
	return { ok: true, markets: value as readonly string[] };
}

function parseMeta(value: unknown): CmsSeoMeta {
	if (!isRecord(value)) return { title: null, description: null, image: null };

	// `image` is an upload relationship: an id string at depth 0, a populated object
	// at depth >= 1. Only a populated absolute URL is usable in OG metadata.
	let image: string | null = null;
	const rawImage = value.image;
	if (isRecord(rawImage)) {
		const url = optionalString(rawImage.url);
		if (url && /^https?:\/\//.test(url)) image = url;
	}

	return {
		title: optionalString(value.title),
		description: optionalString(value.description),
		image,
	};
}

type BlockFailure = { ok: false; reason: string; blockType?: string; nodeType?: string };

function parseBlock(value: unknown, index: number): { ok: true; block: CmsBlock } | BlockFailure {
	if (!isRecord(value)) return { ok: false, reason: `layout[${index}] is not an object` };

	const blockType = value.blockType;
	if (typeof blockType !== "string" || blockType.length === 0) {
		return { ok: false, reason: `layout[${index}] has no blockType` };
	}

	const markets = parseMarkets(value.markets);
	if (!markets.ok) return { ok: false, reason: `layout[${index}].markets is not null or string[]` };

	// An unsupported block type rejects the document. Rendering the rest would show a
	// page the editor never published and never gets told about.
	if (blockType !== "richText") {
		return { ok: false, reason: `layout[${index}] has unsupported blockType ${blockType}`, blockType };
	}

	// A known block type with a malformed payload is a contract break too — we would be
	// silently dropping content we claim to render.
	if (!isLexicalDocument(value.content)) {
		return { ok: false, reason: `layout[${index}] richText content is not a Lexical document` };
	}

	// The Lexical tree is validated here, not in the renderer, so an unrenderable node
	// can still reject the whole candidate while the previous good render stands.
	const unrenderable = findUnrenderableNode(value.content);
	if (unrenderable) {
		return {
			ok: false,
			reason: `layout[${index}] richText contains unrenderable node ${unrenderable}`,
			nodeType: unrenderable,
		};
	}

	return {
		ok: true,
		block: {
			id: optionalString(value.id),
			anchorId: optionalString(value.anchorId),
			blockName: optionalString(value.blockName),
			markets: markets.markets,
			blockType: "richText",
			content: value.content,
		},
	};
}

export function parsePagesResponse(raw: unknown): CmsPageParse {
	/** Identifying fields are filled in as soon as they are known and trusted. */
	let documentId: string | null = null;
	let documentSlug: string | null = null;

	const invalid = (reason: string, extra: { blockType?: string; nodeType?: string } = {}): CmsPageParse => ({
		status: "invalid",
		violation: {
			reason,
			documentId,
			slug: documentSlug,
			blockType: extra.blockType ?? null,
			nodeType: extra.nodeType ?? null,
		},
	});

	if (!isRecord(raw)) return invalid("response body is not an object");

	const docs = raw.docs;
	if (!Array.isArray(docs)) return invalid("response has no docs array");
	if (docs.length === 0) return { status: "empty" };

	const doc = docs[0];
	if (!isRecord(doc)) return invalid("docs[0] is not an object");

	const id = optionalString(doc.id);
	const title = optionalString(doc.title);
	const slug = optionalString(doc.slug);
	documentId = id;
	documentSlug = slug;

	if (!id) return invalid("docs[0].id is missing");
	if (!title) return invalid("docs[0].title is missing");
	if (!slug) return invalid("docs[0].slug is missing");

	// Defence in depth. The query already filters `_status=published`; refusing a
	// non-published document here means a CMS-side change to that filter cannot
	// quietly publish a draft to the storefront.
	if (doc._status !== "published") {
		return invalid(`docs[0]._status is ${JSON.stringify(doc._status)}, not published`);
	}

	if (!Array.isArray(doc.layout)) return invalid("docs[0].layout is not an array");

	const markets = parseMarkets(doc.markets);
	if (!markets.ok) return invalid("docs[0].markets is not null or string[]");

	const layout: CmsBlock[] = [];
	for (const [index, entry] of doc.layout.entries()) {
		const parsed = parseBlock(entry, index);
		if (!parsed.ok) {
			return invalid(parsed.reason, { blockType: parsed.blockType, nodeType: parsed.nodeType });
		}
		layout.push(parsed.block);
	}

	return {
		status: "ok",
		page: {
			id,
			title,
			slug,
			summary: optionalString(doc.summary),
			layout,
			markets: markets.markets,
			meta: parseMeta(doc.meta),
			updatedAt: optionalString(doc.updatedAt),
		},
	};
}
