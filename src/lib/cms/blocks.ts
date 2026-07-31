import {
	findUnrenderableNode,
	findUnsupportedTextFormat,
	isLexicalDocument,
	type LexicalDocument,
} from "./lexical";

/**
 * The seven Page block types of provider contract v2, and the parsers that admit them.
 *
 * Split out of `page-schema.ts` because that file's job is the envelope — three outcomes,
 * one document, the fail-closed rule — and seven block shapes would bury it.
 *
 * ## The rule every parser here obeys
 *
 * Required content missing means the whole candidate is rejected, exactly as an
 * unsupported `blockType` does. The required set is the provider's, not ours
 * (`__fixtures__/provider-v2/README.md`):
 *
 *   hero        heading
 *   richText    content
 *   image       media
 *   gallery     at least two items[].media
 *   cta         heading, at least one link
 *   faq         at least one question with an answer
 *   mediaText   content, media, mediaPosition
 *
 * Optional content missing means render without it. The distinction matters because the
 * two failures look identical from the outside and are opposite in kind: a page missing
 * an optional caption is fine, and a page missing its heading is a page nobody proofread.
 *
 * ## Lexical lives in three places now, not one
 *
 * `richText.content`, `faq.items[].answer` and `mediaText.content` are all Lexical
 * documents and all three run the same validation. Forgetting one would leave a hole
 * exactly where the fail-closed rule is supposed to be total — an unsupported node inside
 * an FAQ answer would render as a silently truncated answer.
 */

/** Fields every block carries, whatever its type. */
export interface CmsBlockCommon {
	readonly id: string | null;
	readonly anchorId: string | null;
	readonly blockName: string | null;
	readonly markets: readonly string[] | null;
}

/** An upload populated at `depth=1`. Only the parts the storefront renders. */
export interface CmsMedia {
	readonly id: string;
	readonly url: string;
	/** Required by the contract. A media object without it fails its block. */
	readonly alt: string;
	readonly width: number | null;
	readonly height: number | null;
	readonly mimeType: string | null;
	/** Generated variants, by name — `thumbnail`, `card`, `content`, `hero`, `og`. */
	readonly sizes: Readonly<Record<string, { readonly url: string; readonly width: number | null }>>;
}

/**
 * Where a block-level link points.
 *
 * `none` is a first-class outcome, not an error. The contract is explicit that a
 * page/post link whose relationship target is null or absent must NOT produce a guessed
 * route, and that its label may render as non-interactive text. Modelling that as a
 * variant rather than a null href means the renderer has to decide what to do about it.
 *
 * Route derivation deliberately does NOT happen here: the market prefix depends on the
 * channel, which the parser has no business knowing. The parser says where the link
 * points; the renderer says what that is in this market.
 */
export type CmsLinkTarget =
	| { readonly kind: "external"; readonly url: string }
	| { readonly kind: "internal"; readonly collection: "pages" | "posts"; readonly slug: string }
	| { readonly kind: "none" };

export interface CmsBlockLink {
	readonly label: string;
	readonly target: CmsLinkTarget;
	readonly newTab: boolean;
	readonly appearance: "primary" | "secondary";
	readonly id: string | null;
}

export interface CmsHeroBlock extends CmsBlockCommon {
	readonly blockType: "hero";
	readonly heading: string;
	readonly subheading: string | null;
	readonly media: CmsMedia | null;
	readonly links: readonly CmsBlockLink[];
}

export interface CmsRichTextBlock extends CmsBlockCommon {
	readonly blockType: "richText";
	readonly content: LexicalDocument;
}

export interface CmsImageBlock extends CmsBlockCommon {
	readonly blockType: "image";
	readonly media: CmsMedia;
	readonly caption: string | null;
}

export interface CmsGalleryItem {
	readonly id: string | null;
	readonly media: CmsMedia;
	readonly caption: string | null;
}

export interface CmsGalleryBlock extends CmsBlockCommon {
	readonly blockType: "gallery";
	readonly items: readonly CmsGalleryItem[];
}

export interface CmsCtaBlock extends CmsBlockCommon {
	readonly blockType: "cta";
	readonly heading: string;
	readonly text: string | null;
	readonly links: readonly CmsBlockLink[];
}

export interface CmsFaqItem {
	readonly id: string | null;
	readonly question: string;
	readonly answer: LexicalDocument;
}

export interface CmsFaqBlock extends CmsBlockCommon {
	readonly blockType: "faq";
	readonly heading: string | null;
	readonly items: readonly CmsFaqItem[];
}

export interface CmsMediaTextBlock extends CmsBlockCommon {
	readonly blockType: "mediaText";
	readonly heading: string | null;
	readonly content: LexicalDocument;
	readonly media: CmsMedia;
	/** `left` or `right`. An unrecognised value falls back to `right`; see `readMediaPosition`. */
	readonly mediaPosition: "left" | "right";
	readonly links: readonly CmsBlockLink[];
}

export type CmsBlock =
	| CmsHeroBlock
	| CmsRichTextBlock
	| CmsImageBlock
	| CmsGalleryBlock
	| CmsCtaBlock
	| CmsFaqBlock
	| CmsMediaTextBlock;

/**
 * The block types this storefront renders, in the contract's own order.
 *
 * A `blockType` outside this set rejects the whole candidate. The set is exported so a
 * test can assert the renderer has a case for every member — the two drifting apart is
 * the silent-partial-render failure this pilot exists to prevent, and a comment asking
 * two files to stay in sync would not survive contact with an eighth block.
 */
export const SUPPORTED_BLOCK_TYPES = [
	"hero",
	"richText",
	"image",
	"gallery",
	"cta",
	"faq",
	"mediaText",
] as const;

export type SupportedBlockType = (typeof SUPPORTED_BLOCK_TYPES)[number];

export function isSupportedBlockType(value: unknown): value is SupportedBlockType {
	return typeof value === "string" && (SUPPORTED_BLOCK_TYPES as readonly string[]).includes(value);
}

export type BlockFailure = {
	readonly ok: false;
	readonly reason: string;
	readonly blockType?: string;
	readonly nodeType?: string;
};

type BlockResult = { readonly ok: true; readonly block: CmsBlock } | BlockFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** `null` (all markets) or an array of strings. Anything else is a contract break. */
function parseMarkets(value: unknown): { ok: true; markets: readonly string[] | null } | { ok: false } {
	if (value === null || value === undefined) return { ok: true, markets: null };
	if (!Array.isArray(value)) return { ok: false };
	if (!value.every((entry) => typeof entry === "string")) return { ok: false };
	return { ok: true, markets: value as readonly string[] };
}

function readCommon(value: Record<string, unknown>): { ok: true; common: CmsBlockCommon } | { ok: false } {
	const markets = parseMarkets(value.markets);
	if (!markets.ok) return { ok: false };
	return {
		ok: true,
		common: {
			id: optionalString(value.id),
			anchorId: optionalString(value.anchorId),
			blockName: optionalString(value.blockName),
			markets: markets.markets,
		},
	};
}

/**
 * A populated upload, or `null` when the relationship is absent, unpopulated or unusable.
 *
 * `alt` is required by the contract and treated as such: a media object without it is not
 * usable media, so the block that requires media fails. Rendering `alt=""` instead would
 * be inventing an editorial decision — "this image is decorative" — that nobody made.
 *
 * An unpopulated relationship at depth=1 arrives as a bare id string. That is not a
 * malformed response, it is a relationship the query did not expand, so it reads as
 * absent rather than as a contract violation.
 */
function readMedia(value: unknown): CmsMedia | null {
	if (!isRecord(value)) return null;

	const id = optionalString(value.id);
	const url = optionalString(value.url);
	const alt = optionalString(value.alt);
	if (!id || !url || !alt) return null;
	if (!/^https?:\/\//.test(url)) return null;

	const sizes: Record<string, { url: string; width: number | null }> = {};
	if (isRecord(value.sizes)) {
		for (const [name, raw] of Object.entries(value.sizes)) {
			if (!isRecord(raw)) continue;
			const sizeUrl = optionalString(raw.url);
			if (!sizeUrl || !/^https?:\/\//.test(sizeUrl)) continue;
			sizes[name] = { url: sizeUrl, width: optionalNumber(raw.width) };
		}
	}

	return {
		id,
		url,
		alt,
		width: optionalNumber(value.width),
		height: optionalNumber(value.height),
		mimeType: optionalString(value.mimeType),
		sizes,
	};
}

/**
 * Where one block-level link points.
 *
 * Deliberately NOT shared with the Lexical link reader. The two shapes are similar enough
 * to invite it and different in exactly the way that produces a subtle bug: a block link
 * carries `newTab` and `reference` at the top level, a Lexical link carries `fields.newTab`
 * and `fields.doc`. One reader sniffing both would eventually read the wrong one.
 *
 * A `reference` that is null, absent, or points at a collection outside the contract
 * yields `kind: "none"` rather than a rejection — the contract says such a link must not
 * produce a guessed route, and that its label may still render as text.
 */
function readBlockLink(value: unknown): CmsBlockLink | null {
	if (!isRecord(value)) return null;

	const label = optionalString(value.label);
	if (!label) return null;

	const appearance = value.appearance === "secondary" ? "secondary" : "primary";
	const newTab = value.newTab === true;
	const id = optionalString(value.id);

	let target: CmsLinkTarget = { kind: "none" };

	if (value.type === "custom") {
		const url = optionalString(value.url);
		// Only http(s). A `javascript:` or `data:` URL in a link an editor typed is the one
		// place untrusted CMS input reaches an href.
		if (url && /^https?:\/\//i.test(url)) target = { kind: "external", url };
	} else if (value.type === "reference") {
		const reference = value.reference;
		if (isRecord(reference)) {
			const collection = reference.relationTo;
			const doc = reference.value;
			const slug = isRecord(doc) ? optionalString(doc.slug) : null;
			if ((collection === "pages" || collection === "posts") && slug) {
				target = { kind: "internal", collection, slug };
			}
		}
	}

	return { label, target, newTab, appearance, id };
}

function readLinks(value: unknown): readonly CmsBlockLink[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		const link = readBlockLink(entry);
		return link ? [link] : [];
	});
}

/** Validate one Lexical document, wherever it sits. Returns a failure or `null`. */
function checkLexical(value: unknown, where: string): BlockFailure | null {
	if (!isLexicalDocument(value)) {
		return { ok: false, reason: `${where} is not a Lexical document` };
	}
	const unrenderable = findUnrenderableNode(value);
	if (unrenderable) {
		return {
			ok: false,
			reason: `${where} contains unrenderable node ${unrenderable}`,
			nodeType: unrenderable,
		};
	}
	const format = findUnsupportedTextFormat(value);
	if (format !== null) {
		return { ok: false, reason: `${where} carries unsupported text format bits ${format}` };
	}
	return null;
}

/** `left` or `right`; anything else falls back rather than failing — see the comment. */
function readMediaPosition(value: unknown): "left" | "right" {
	return value === "left" ? "left" : "right";
}

/**
 * Parse one block, or explain why the whole candidate must be rejected.
 *
 * The dispatch below is exhaustive over `SupportedBlockType` and ends in a `never`
 * assignment, so adding an eighth block type to the contract fails the build here rather
 * than silently falling through to a default that renders nothing.
 */
export function parseBlock(value: unknown, index: number): BlockResult {
	const at = `layout[${index}]`;
	if (!isRecord(value)) return { ok: false, reason: `${at} is not an object` };

	const blockType = value.blockType;
	if (typeof blockType !== "string" || blockType.length === 0) {
		return { ok: false, reason: `${at} has no blockType` };
	}

	// An unsupported block type rejects the document. Rendering the rest would show a page
	// the editor never published and never gets told about.
	if (!isSupportedBlockType(blockType)) {
		return { ok: false, reason: `${at} has unsupported blockType ${blockType}`, blockType };
	}

	const common = readCommon(value);
	if (!common.ok) return { ok: false, reason: `${at}.markets is not null or string[]` };
	const base = common.common;

	switch (blockType) {
		case "hero": {
			const heading = optionalString(value.heading);
			if (!heading) return { ok: false, reason: `${at} hero has no heading` };
			return {
				ok: true,
				block: {
					...base,
					blockType: "hero",
					heading,
					subheading: optionalString(value.subheading),
					media: readMedia(value.media),
					links: readLinks(value.links),
				},
			};
		}

		case "richText": {
			const failure = checkLexical(value.content, `${at} richText content`);
			if (failure) return failure;
			return {
				ok: true,
				block: { ...base, blockType: "richText", content: value.content as LexicalDocument },
			};
		}

		case "image": {
			const media = readMedia(value.media);
			if (!media) return { ok: false, reason: `${at} image has no usable media` };
			return {
				ok: true,
				block: { ...base, blockType: "image", media, caption: optionalString(value.caption) },
			};
		}

		case "gallery": {
			if (!Array.isArray(value.items)) return { ok: false, reason: `${at} gallery has no items` };
			const items: CmsGalleryItem[] = [];
			for (const entry of value.items) {
				if (!isRecord(entry)) return { ok: false, reason: `${at} gallery item is not an object` };
				const media = readMedia(entry.media);
				if (!media) return { ok: false, reason: `${at} gallery item has no usable media` };
				items.push({ id: optionalString(entry.id), media, caption: optionalString(entry.caption) });
			}
			// The contract's required content is "at least two". A one-image gallery is a
			// shape the provider schema forbids, so its arrival means something upstream is
			// wrong rather than that an editor made a choice.
			if (items.length < 2) return { ok: false, reason: `${at} gallery needs at least two items` };
			return { ok: true, block: { ...base, blockType: "gallery", items } };
		}

		case "cta": {
			const heading = optionalString(value.heading);
			if (!heading) return { ok: false, reason: `${at} cta has no heading` };
			const links = readLinks(value.links);
			if (links.length === 0) return { ok: false, reason: `${at} cta has no links` };
			return {
				ok: true,
				block: { ...base, blockType: "cta", heading, text: optionalString(value.text), links },
			};
		}

		case "faq": {
			if (!Array.isArray(value.items)) return { ok: false, reason: `${at} faq has no items` };
			const items: CmsFaqItem[] = [];
			for (const [i, entry] of value.items.entries()) {
				if (!isRecord(entry)) return { ok: false, reason: `${at} faq item is not an object` };
				const question = optionalString(entry.question);
				if (!question) return { ok: false, reason: `${at} faq item ${i} has no question` };
				const failure = checkLexical(entry.answer, `${at} faq item ${i} answer`);
				if (failure) return failure;
				items.push({ id: optionalString(entry.id), question, answer: entry.answer as LexicalDocument });
			}
			if (items.length === 0) return { ok: false, reason: `${at} faq has no items` };
			return {
				ok: true,
				block: { ...base, blockType: "faq", heading: optionalString(value.heading), items },
			};
		}

		case "mediaText": {
			const failure = checkLexical(value.content, `${at} mediaText content`);
			if (failure) return failure;
			const media = readMedia(value.media);
			if (!media) return { ok: false, reason: `${at} mediaText has no usable media` };
			if (typeof value.mediaPosition !== "string" || value.mediaPosition.length === 0) {
				return { ok: false, reason: `${at} mediaText has no mediaPosition` };
			}
			return {
				ok: true,
				block: {
					...base,
					blockType: "mediaText",
					heading: optionalString(value.heading),
					content: value.content as LexicalDocument,
					media,
					// The contract names the field required but never enumerates its values, so
					// an unrecognised one degrades to the default layout instead of taking the
					// page down over a presentation detail. Absence still fails, above.
					mediaPosition: readMediaPosition(value.mediaPosition),
					links: readLinks(value.links),
				},
			};
		}

		default: {
			const exhaustive: never = blockType;
			return { ok: false, reason: `${at} has unhandled blockType ${String(exhaustive)}` };
		}
	}
}
