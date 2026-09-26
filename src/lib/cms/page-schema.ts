import { parseBlock, readBlockMarkets, readMedia, type CmsBlock, type CmsBlockWarning } from "./blocks";
import { isContentReady } from "./content-readiness";
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
 * ## A block that cannot be rendered is skipped — on an editorial page
 *
 * Pages contract v3 (`__fixtures__/provider-v3/pages-content.md` §1) replaced the old
 * all-or-nothing rule, and the two kinds of page now answer differently:
 *
 *   editorial   an unsupported `blockType`, or a block that fails validation (an unknown
 *               Lexical node, a disallowed URL, missing required content, media without
 *               alt text), is SKIPPED. The other blocks render. Each skip is reported as a
 *               `block-skipped` warning — index, block type, node type, reason, never the
 *               block's content — and `client.ts` logs it as `[cms] block-skipped`.
 *   legal       `legalMetadata.documentType === "legal"` stays fail-closed: one bad block
 *               makes the whole document `invalid`, because a missing paragraph of legal
 *               text changes what the text says.
 *
 * The checks themselves are not softened. A block that breaks one — link protocols, the
 * media origin, locale without fallback, no raw HTML — is not rendered; the difference is
 * only whether its neighbours are.
 *
 * Skipping must never produce an empty success. When blocks were skipped and nothing is
 * left to show in this market — or what is left no longer satisfies the route's body
 * contract (`isContentReady`) — the document is `invalid`, exactly as v2 treated it, so the
 * route falls back to its bootstrap or its "temporarily unavailable" state with `noindex`.
 * The second half matters for `o-nas`: a skipped rich-text body next to a surviving image
 * would otherwise read as an authoritative "no content here" and 404 the About page.
 *
 * The v2 argument for all-or-nothing — a page that silently loses a paragraph — is answered
 * by the provider now refusing to publish an unsupported block at all (its readiness check),
 * which leaves skipping as the second line of defence for old data, plus the log line.
 *
 * This does not turn optional presentation metadata into page availability. A supported
 * Page/Post link whose destination has no consumer route and a harmless relative URL keep
 * their visible label without an `href`; an unusable optional `meta.image` is omitted. A
 * structurally valid optional hero upload whose MIME is outside the provider image contract
 * is omitted too. Each degradation is logged.
 *
 * ## Validation is about CONTENT, not about key sets
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

/**
 * One block an editorial page rendered without. Carries enough to find the block in
 * Payload and nothing of what it says.
 */
export interface CmsBlockSkipped {
	readonly code: "block-skipped";
	/** Position in the document's `layout`, before market filtering. */
	readonly index: number;
	/** The block's own `blockType`, whatever it was — `null` when it had none. */
	readonly blockType: string | null;
	/** The Lexical node type that made it unrenderable, when that was the cause. */
	readonly nodeType: string | null;
	readonly reason: string;
}

export type CmsParseWarning =
	| CmsBlockWarning
	| CmsBlockSkipped
	| {
			readonly code: "meta-image-omitted";
			readonly reason: string;
	  };

export interface CmsPageParseOptions {
	/**
	 * Admit a document whose `_status` is `draft`. Only the preview path sets this: the
	 * CMS answers `preview-resolve` with exactly the version the signed token names, which
	 * may be a draft. Every published read keeps refusing one.
	 */
	readonly allowDraft?: boolean;
}

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

/** `legalMetadata.documentType === "legal"`; any other value, or none, is editorial. */
function isLegalDocument(doc: Record<string, unknown>): boolean {
	const group = doc.legalMetadata;
	return isRecord(group) && group.documentType === "legal";
}

function declaredBlockType(entry: unknown): string | null {
	return isRecord(entry) && typeof entry.blockType === "string" && entry.blockType.length > 0
		? entry.blockType
		: null;
}

export function parsePagesResponse(
	raw: unknown,
	market?: MarketCode,
	options: CmsPageParseOptions = {},
): CmsPageParse {
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
	// quietly publish a draft to the storefront. Only the preview path admits a draft.
	const draftAdmitted = options.allowDraft === true && doc._status === "draft";
	if (doc._status !== "published" && !draftAdmitted) {
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

	// Editorial pages skip what they cannot render; legal pages refuse the document.
	const failClosed = isLegalDocument(doc);

	const layout: CmsBlock[] = [];
	const warnings: CmsParseWarning[] = [];
	/** The first skip, kept for the violation if skipping leaves nothing to show. */
	let firstSkip: { reason: string; blockType?: string; nodeType?: string } | null = null;
	let skipped = 0;

	for (const [index, entry] of doc.layout.entries()) {
		// Filter each block before validating its content, as required by V2. We still
		// validate the markets field itself, because an unknown market is an enum break —
		// one that hides the block, since there is no telling where it belongs.
		const visibility = readBlockMarkets(entry, index);
		if (visibility.ok && market && !isVisibleInMarket(visibility.markets, market)) continue;
		const parsed = visibility.ok ? parseBlock(entry, index) : visibility;

		if (!parsed.ok) {
			// `blockType` on a violation names an UNSUPPORTED type only; a supported block with
			// a bad payload leaves it null, as it always has.
			const failure = { reason: parsed.reason, blockType: parsed.blockType, nodeType: parsed.nodeType };
			if (failClosed) return invalid(failure.reason, failure);

			skipped += 1;
			firstSkip ??= failure;
			warnings.push({
				code: "block-skipped",
				index,
				blockType: declaredBlockType(entry),
				nodeType: parsed.nodeType ?? null,
				reason: parsed.reason,
			});
			continue;
		}
		layout.push(parsed.block);
		if (parsed.warnings) warnings.push(...parsed.warnings);
	}

	// Never an empty success: skipping that leaves this market with nothing to show — or
	// without the body its route requires — is the v2 outcome, a document we cannot serve.
	if (firstSkip && (layout.length === 0 || !isContentReady(slug, layout))) {
		return invalid(
			`${skipped} block(s) skipped, leaving nothing this market can render; first: ${firstSkip.reason}`,
			firstSkip,
		);
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
