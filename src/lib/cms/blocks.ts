import {
	findUnrenderableNode,
	findUnsupportedLinkTarget,
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
type MediaResult =
	/** No relationship at all, or one the query did not expand. Legitimately no media. */
	| { readonly kind: "absent" }
	/** A populated object the storefront cannot render — missing alt, unsafe url. */
	| { readonly kind: "unusable"; readonly why: string }
	| { readonly kind: "ok"; readonly media: CmsMedia };

function readMedia(value: unknown): MediaResult {
	// An unpopulated relationship arrives as a bare id string or null. That is not a
	// malformed response, it is a relationship the query did not expand.
	if (!isRecord(value)) return { kind: "absent" };

	const id = optionalString(value.id);
	const url = optionalString(value.url);
	const alt = optionalString(value.alt);
	if (!id && !url) return { kind: "absent" };
	if (!alt) return { kind: "unusable", why: "media has no alt text" };
	if (!url || !/^https?:\/\//.test(url)) return { kind: "unusable", why: "media url is not http(s)" };

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
		kind: "ok",
		media: {
			id: id ?? url,
			url,
			alt,
			width: optionalNumber(value.width),
			height: optionalNumber(value.height),
			mimeType: optionalString(value.mimeType),
			sizes,
		},
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
function readBlockLink(value: unknown): CmsBlockLink | null | { unsupportedCollection: string } {
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
			// An unknown collection is a contract violation, not a degrade. The contract
			// separates the two cases explicitly: a null or absent target must not produce a
			// guessed route (degrade), while „Neznáme `relationTo` … sú contract violation".
			// `brands` is the named example — the Payload editor offers it, this consumer
			// contract does not, and quietly rendering the label as text would hide a link
			// an editor believed they had made.
			if (typeof collection === "string" && collection !== "pages" && collection !== "posts") {
				return { unsupportedCollection: collection };
			}
			const doc = reference.value;
			const slug = isRecord(doc) ? optionalString(doc.slug) : null;
			if ((collection === "pages" || collection === "posts") && slug) {
				target = { kind: "internal", collection, slug };
			}
		}
	}

	return { label, target, newTab, appearance, id };
}

function readLinks(
	value: unknown,
):
	| { readonly ok: true; readonly links: readonly CmsBlockLink[] }
	| { readonly ok: false; readonly collection: string } {
	if (!Array.isArray(value)) return { ok: true, links: [] };
	const links: CmsBlockLink[] = [];
	for (const entry of value) {
		const link = readBlockLink(entry);
		if (link && "unsupportedCollection" in link) return { ok: false, collection: link.unsupportedCollection };
		if (link) links.push(link);
	}
	return { ok: true, links };
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
	const link = findUnsupportedLinkTarget(value);
	if (link !== null) {
		return { ok: false, reason: `${where} contains an unsupported link target: ${link}` };
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
			const heroMedia = readMedia(value.media);
			if (heroMedia.kind === "unusable") {
				return { ok: false, reason: `${at} hero ${heroMedia.why}` };
			}
			const heroLinks = readLinks(value.links);
			if (!heroLinks.ok) {
				return { ok: false, reason: `${at} hero links to unsupported collection ${heroLinks.collection}` };
			}
			return {
				ok: true,
				block: {
					...base,
					blockType: "hero",
					heading,
					subheading: optionalString(value.subheading),
					// Optional — but "no image" and "an image we cannot render" are different
					// facts. Treating the second as the first would drop a published picture in
					// silence, which is what every other media block rejects the document for.
					media: heroMedia.kind === "ok" ? heroMedia.media : null,
					links: heroLinks.links,
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
			if (media.kind !== "ok") {
				return { ok: false, reason: `${at} image ${media.kind === "unusable" ? media.why : "has no media"}` };
			}
			return {
				ok: true,
				block: { ...base, blockType: "image", media: media.media, caption: optionalString(value.caption) },
			};
		}

		case "gallery": {
			if (!Array.isArray(value.items)) return { ok: false, reason: `${at} gallery has no items` };
			const items: CmsGalleryItem[] = [];
			for (const entry of value.items) {
				if (!isRecord(entry)) return { ok: false, reason: `${at} gallery item is not an object` };
				const media = readMedia(entry.media);
				if (media.kind !== "ok") {
					const why = media.kind === "unusable" ? media.why : "has no media";
					return { ok: false, reason: `${at} gallery item ${why}` };
				}
				items.push({
					id: optionalString(entry.id),
					media: media.media,
					caption: optionalString(entry.caption),
				});
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
			const ctaLinks = readLinks(value.links);
			if (!ctaLinks.ok) {
				return { ok: false, reason: `${at} cta links to unsupported collection ${ctaLinks.collection}` };
			}
			if (ctaLinks.links.length === 0) return { ok: false, reason: `${at} cta has no links` };
			return {
				ok: true,
				block: {
					...base,
					blockType: "cta",
					heading,
					text: optionalString(value.text),
					links: ctaLinks.links,
				},
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
			if (media.kind !== "ok") {
				const why = media.kind === "unusable" ? media.why : "has no media";
				return { ok: false, reason: `${at} mediaText ${why}` };
			}
			if (typeof value.mediaPosition !== "string" || value.mediaPosition.length === 0) {
				return { ok: false, reason: `${at} mediaText has no mediaPosition` };
			}
			const mediaTextLinks = readLinks(value.links);
			if (!mediaTextLinks.ok) {
				return {
					ok: false,
					reason: `${at} mediaText links to unsupported collection ${mediaTextLinks.collection}`,
				};
			}
			return {
				ok: true,
				block: {
					...base,
					blockType: "mediaText",
					heading: optionalString(value.heading),
					content: value.content as LexicalDocument,
					media: media.media,
					// The contract names the field required but never enumerates its values, so
					// an unrecognised one degrades to the default layout instead of taking the
					// page down over a presentation detail. Absence still fails, above.
					mediaPosition: readMediaPosition(value.mediaPosition),
					links: mediaTextLinks.links,
				},
			};
		}

		default: {
			const exhaustive: never = blockType;
			return { ok: false, reason: `${at} has unhandled blockType ${String(exhaustive)}` };
		}
	}
}
