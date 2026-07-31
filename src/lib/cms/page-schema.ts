import { parseBlock, readBlockMarkets, readMedia, type CmsBlock, type CmsBlockWarning } from "./blocks";
import { isMarketCode, isVisibleInMarket, type MarketCode } from "./markets";

// Re-exported so consumers keep importing the page contract from one place; the block
// shapes live in `blocks.ts` because seven of them would bury the envelope logic here.
export type {
	CmsBlock,
	CmsBlockLink,
	CmsBlockWarning,
	CmsMedia,
	CmsCtaBlock,
	CmsFaqBlock,
	CmsGalleryBlock,
	CmsHeroBlock,
	CmsImageBlock,
	CmsMediaTextBlock,
	CmsRichTextBlock,
} from "./blocks";

/**
 * Runtime validation of the Payload `/api/pages` response.
 *
 * Payload's generated `payload-types.ts` is not used as the contract here. It types
 * Lexical children as `type: any` with an open index signature, so it would compile
 * against anything; and it describes the CMS's own schema, not what actually
 * arrived over the wire. A published page is untrusted input like any other HTTP
 * response, so it is validated structurally at this boundary.
 *
 * Four outcomes, which must never collapse into one branch:
 *
 *   `ok`      — a published document to render
 *   `empty`   — the CMS answered authoritatively that nothing matches (`docs: []`)
 *   `market-mismatch` — a valid envelope excludes the requested market
 *   `invalid` — the response did not match the contract; treat as an upstream fault
 *
 * `empty` and `market-mismatch` are authoritative absences and must NOT resurrect a stale fallback.
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
 * This does not turn optional presentation metadata into page availability. A supported
 * Page/Post link whose destination has no consumer route and a harmless relative URL keep
 * their visible label without an `href`; an unusable optional `meta.image` is omitted. A
 * structurally valid optional hero upload whose MIME is outside the provider image contract
 * is omitted too. Each degradation is logged. Unknown relationship collections, malformed
 * wrappers, unsafe URL schemes and unsupported required media remain hard failures. In other
 * words, the words stay all-or-nothing; only a destination or optional preview that cannot be
 * emitted safely may disappear.
 *
 * ## All-or-nothing is about CONTENT, not about key sets
 *
 * The rule above fires on things the storefront would have to render and cannot: an
 * unsupported `blockType`, a content-bearing Lexical node it has no case for. It does
 * NOT fire on an unread field. Every response already carries several — `createdAt`,
 * `hasNextPage`, `totalDocs` — and the parser reads past them by naming what it wants
 * and rebuilding a `CmsPage` from the named parts.
 *
 * One honest exception to "rebuilt from named parts": `content` is passed through whole,
 * because a Lexical tree is not something this layer can usefully rebuild. So an unnamed
 * key sitting inside a rich-text value does reach the block object — it is simply never
 * read and never emitted, since the renderer switches on `node.type` and reads named
 * props. The walk that DOES reject descends only through `children` arrays of things with
 * a string `type`, so a plain object hung off the tree is invisible to it. Pinned.
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

export type CmsParseWarning =
	| CmsBlockWarning
	| {
			readonly code: "meta-image-omitted";
			readonly reason: string;
	  };

export type CmsPageParse =
	| { readonly status: "ok"; readonly page: CmsPage; readonly warnings: readonly CmsParseWarning[] }
	| { readonly status: "empty" }
	| {
			readonly status: "market-mismatch";
			readonly documentId: string;
			readonly slug: string;
			readonly markets: readonly string[];
	  }
	| { readonly status: "invalid"; readonly violation: CmsContractViolation };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** `null`/`[]` means all markets; every entry must be a provider market enum. */
function parseMarkets(value: unknown): { ok: true; markets: readonly string[] | null } | { ok: false } {
	if (value === null || value === undefined) return { ok: true, markets: null };
	if (!Array.isArray(value) || !value.every(isMarketCode)) return { ok: false };
	return { ok: true, markets: value };
}

type MetaResult =
	| { readonly ok: true; readonly meta: CmsSeoMeta; readonly warnings: readonly CmsParseWarning[] }
	| { readonly ok: false; readonly reason: string };

function parseMeta(value: unknown): MetaResult {
	if (value === undefined || value === null) {
		return { ok: true, meta: { title: null, description: null, image: null }, warnings: [] };
	}
	if (!isRecord(value)) return { ok: false, reason: "docs[0].meta is not an object" };

	let image: string | null = null;
	const warnings: CmsParseWarning[] = [];
	if (value.image !== undefined && value.image !== null) {
		const parsedImage = readMedia(value.image);
		if (parsedImage.kind !== "ok") {
			const why = parsedImage.kind === "unusable" ? parsedImage.why : "is absent";
			warnings.push({
				code: "meta-image-omitted",
				reason: `docs[0].meta.image ${why}`,
			});
		} else {
			image = parsedImage.media.url;
		}
	}

	return {
		ok: true,
		meta: {
			title: optionalString(value.title),
			description: optionalString(value.description),
			image,
		},
		warnings,
	};
}

export function parsePagesResponse(raw: unknown, market?: MarketCode): CmsPageParse {
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
	if (!markets.ok) return invalid("docs[0].markets contains an unsupported market");

	// Page visibility is authoritative and precedes all block validation. A CZ-only
	// document cannot become an indexable SK bootstrap merely because its CZ content uses
	// a block this storefront does not understand.
	if (market && !isVisibleInMarket(markets.markets, market)) {
		return {
			status: "market-mismatch",
			documentId: id,
			slug,
			markets: markets.markets ?? [],
		};
	}

	const layout: CmsBlock[] = [];
	const warnings: CmsParseWarning[] = [];
	for (const [index, entry] of doc.layout.entries()) {
		// Filter each block before validating its content, as required by V2. We still
		// validate the markets field itself, because an unknown market is an enum break.
		const visibility = readBlockMarkets(entry, index);
		if (!visibility.ok) return invalid(visibility.reason);
		if (market && !isVisibleInMarket(visibility.markets, market)) continue;

		const parsed = parseBlock(entry, index);
		if (!parsed.ok) {
			return invalid(parsed.reason, { blockType: parsed.blockType, nodeType: parsed.nodeType });
		}
		layout.push(parsed.block);
		if (parsed.warnings) warnings.push(...parsed.warnings);
	}

	const meta = parseMeta(doc.meta);
	if (!meta.ok) return invalid(meta.reason);

	return {
		status: "ok",
		page: {
			id,
			title,
			slug,
			summary: optionalString(doc.summary),
			layout,
			markets: markets.markets,
			meta: meta.meta,
			updatedAt: optionalString(doc.updatedAt),
		},
		warnings: [...warnings, ...meta.warnings],
	};
}
