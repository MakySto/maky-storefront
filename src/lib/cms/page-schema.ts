import { isLexicalDocument, type LexicalDocument } from "./lexical";

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

/**
 * A block type this version does not render.
 *
 * Kept in the parsed output rather than dropped during parsing so the renderer can
 * emit one structured log line naming it. A published block that vanishes without
 * a trace is the failure mode worth engineering against: the editor sees "success"
 * and never learns half the page is missing.
 */
export interface CmsUnsupportedBlock extends CmsBlockCommon {
	readonly blockType: string;
	readonly unsupported: true;
}

export type CmsBlock = CmsRichTextBlock | CmsUnsupportedBlock;

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

export type CmsPageParse =
	| { readonly status: "ok"; readonly page: CmsPage }
	| { readonly status: "empty" }
	| { readonly status: "invalid"; readonly reason: string };

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

function parseBlock(
	value: unknown,
	index: number,
): { ok: true; block: CmsBlock } | { ok: false; reason: string } {
	if (!isRecord(value)) return { ok: false, reason: `layout[${index}] is not an object` };

	const blockType = value.blockType;
	if (typeof blockType !== "string" || blockType.length === 0) {
		return { ok: false, reason: `layout[${index}] has no blockType` };
	}

	const markets = parseMarkets(value.markets);
	if (!markets.ok) return { ok: false, reason: `layout[${index}].markets is not null or string[]` };

	const common: CmsBlockCommon = {
		id: optionalString(value.id),
		anchorId: optionalString(value.anchorId),
		blockName: optionalString(value.blockName),
		markets: markets.markets,
	};

	if (blockType === "richText") {
		// A known block type with a malformed payload is a contract break, not an
		// unsupported block — we would be silently dropping content we claim to render.
		if (!isLexicalDocument(value.content)) {
			return { ok: false, reason: `layout[${index}] richText content is not a Lexical document` };
		}
		return { ok: true, block: { ...common, blockType: "richText", content: value.content } };
	}

	return { ok: true, block: { ...common, blockType, unsupported: true } };
}

export function parsePagesResponse(raw: unknown): CmsPageParse {
	if (!isRecord(raw)) return { status: "invalid", reason: "response body is not an object" };

	const docs = raw.docs;
	if (!Array.isArray(docs)) return { status: "invalid", reason: "response has no docs array" };
	if (docs.length === 0) return { status: "empty" };

	const doc = docs[0];
	if (!isRecord(doc)) return { status: "invalid", reason: "docs[0] is not an object" };

	const id = optionalString(doc.id);
	const title = optionalString(doc.title);
	const slug = optionalString(doc.slug);
	if (!id) return { status: "invalid", reason: "docs[0].id is missing" };
	if (!title) return { status: "invalid", reason: "docs[0].title is missing" };
	if (!slug) return { status: "invalid", reason: "docs[0].slug is missing" };

	// Defence in depth. The query already filters `_status=published`; refusing a
	// non-published document here means a CMS-side change to that filter cannot
	// quietly publish a draft to the storefront.
	if (doc._status !== "published") {
		return { status: "invalid", reason: `docs[0]._status is ${JSON.stringify(doc._status)}, not published` };
	}

	if (!Array.isArray(doc.layout)) return { status: "invalid", reason: "docs[0].layout is not an array" };

	const markets = parseMarkets(doc.markets);
	if (!markets.ok) return { status: "invalid", reason: "docs[0].markets is not null or string[]" };

	const layout: CmsBlock[] = [];
	for (const [index, entry] of doc.layout.entries()) {
		const parsed = parseBlock(entry, index);
		if (!parsed.ok) return { status: "invalid", reason: parsed.reason };
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
