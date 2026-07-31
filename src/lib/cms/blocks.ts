import { isLexicalDocument, safeLinkUrl, type LexicalDocument, validateLexicalDocument } from "./lexical";
import { cmsPathForRelationship } from "./link-routes";
import { isMarketCode } from "./markets";

/**
 * The seven Page block types of provider contract v2, and the parsers that admit them.
 *
 * Split out of `page-schema.ts` because that file's job is the envelope — four outcomes,
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
	readonly mimeType: string;
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
	| {
			readonly kind: "internal";
			readonly collection: "pages" | "posts";
			readonly slug: string;
	  }
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
	/** Exact provider enum; anything else rejects the candidate before rendering. */
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

type OptionalPositiveInteger = { readonly ok: true; readonly value: number | null } | { readonly ok: false };

function readOptionalPositiveInteger(value: unknown): OptionalPositiveInteger {
	if (value === undefined || value === null) return { ok: true, value: null };
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return { ok: false };
	return { ok: true, value };
}

/** `null`/`[]` means all markets; every non-empty entry must be a provider enum. */
function parseMarkets(value: unknown): { ok: true; markets: readonly string[] | null } | { ok: false } {
	if (value === null || value === undefined) return { ok: true, markets: null };
	if (!Array.isArray(value) || !value.every(isMarketCode)) return { ok: false };
	return { ok: true, markets: value };
}

export type BlockMarketsResult =
	| { readonly ok: true; readonly markets: readonly string[] | null }
	| BlockFailure;

/** Read only the field needed to market-filter a block before content validation. */
export function readBlockMarkets(value: unknown, index: number): BlockMarketsResult {
	const at = `layout[${index}]`;
	if (!isRecord(value)) return { ok: false, reason: `${at} is not an object` };
	const markets = parseMarkets(value.markets);
	if (!markets.ok)
		return {
			ok: false,
			reason: `${at}.markets contains an unsupported market`,
		};
	return { ok: true, markets: markets.markets };
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
 * A populated upload admitted by the V2 media contract.
 *
 * The canonical request uses `depth=1`, so only null/missing is absence. A bare id or
 * another non-object value means the relationship was not populated as promised and must
 * reject the candidate. Public block media is restricted to the provider CDN origin and
 * image MIME types that `next/image` can render safely.
 */
const CMS_MEDIA_HOSTNAME = "cms-media.maky.store";
const CMS_MEDIA_PATH_PREFIX = "/media/";
const SUPPORTED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

function readCmsMediaUrl(value: unknown): string | null {
	const raw = optionalString(value)?.trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		if (
			url.protocol !== "https:" ||
			url.hostname !== CMS_MEDIA_HOSTNAME ||
			url.port !== "" ||
			url.username !== "" ||
			url.password !== "" ||
			!url.pathname.startsWith(CMS_MEDIA_PATH_PREFIX) ||
			url.pathname.length <= CMS_MEDIA_PATH_PREFIX.length
		) {
			return null;
		}
		return raw;
	} catch {
		return null;
	}
}

export type MediaResult =
	| { readonly kind: "absent" }
	| { readonly kind: "unusable"; readonly why: string }
	| { readonly kind: "ok"; readonly media: CmsMedia };

export function readMedia(value: unknown): MediaResult {
	if (value === null || value === undefined) return { kind: "absent" };
	if (!isRecord(value)) return { kind: "unusable", why: "media relationship is not populated" };

	const id = optionalString(value.id)?.trim() ?? null;
	const url = readCmsMediaUrl(value.url);
	const alt = optionalString(value.alt)?.trim() ?? null;
	const mimeType = optionalString(value.mimeType)?.trim().toLowerCase() ?? null;
	if (!id) return { kind: "unusable", why: "media has no id" };
	if (!alt) return { kind: "unusable", why: "media has no alt text" };
	if (!url)
		return {
			kind: "unusable",
			why: "media url is outside the approved CDN origin",
		};
	if (!mimeType || !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
		return { kind: "unusable", why: "media mimeType is not a supported image" };
	}

	const width = readOptionalPositiveInteger(value.width);
	const height = readOptionalPositiveInteger(value.height);
	if (!width.ok || !height.ok) {
		return { kind: "unusable", why: "media dimensions are not positive integers" };
	}

	const sizes: Record<string, { url: string; width: number | null }> = {};
	if (isRecord(value.sizes)) {
		for (const [name, raw] of Object.entries(value.sizes)) {
			if (!isRecord(raw)) continue;
			const sizeUrl = readCmsMediaUrl(raw.url);
			if (!sizeUrl) continue;
			const sizeWidth = readOptionalPositiveInteger(raw.width);
			const sizeHeight = readOptionalPositiveInteger(raw.height);
			if (!sizeWidth.ok || !sizeHeight.ok) {
				return { kind: "unusable", why: `media size ${name} dimensions are not positive integers` };
			}
			sizes[name] = { url: sizeUrl, width: sizeWidth.value };
		}
	}

	return {
		kind: "ok",
		media: {
			id,
			url,
			alt,
			width: width.value,
			height: height.value,
			mimeType,
			sizes,
		},
	};
}

/**
 * Parse one block-level link without silently repairing malformed published content.
 *
 * Only a null/missing reference target may degrade to inert text. Unknown enums,
 * malformed wrappers, unsafe custom URLs and populated targets with no storefront route
 * reject the complete candidate.
 */
type BlockLinkRead =
	| { readonly ok: true; readonly link: CmsBlockLink }
	| { readonly ok: false; readonly reason: string };

function readBlockLink(value: unknown): BlockLinkRead {
	if (!isRecord(value)) return { ok: false, reason: "link is not an object" };

	const label = optionalString(value.label)?.trim() ?? null;
	if (!label) return { ok: false, reason: "link has no label" };
	if (
		value.appearance !== undefined &&
		value.appearance !== null &&
		value.appearance !== "primary" &&
		value.appearance !== "secondary"
	) {
		return { ok: false, reason: "link appearance is not primary or secondary" };
	}
	if (value.newTab !== undefined && value.newTab !== null && typeof value.newTab !== "boolean") {
		return { ok: false, reason: "link newTab is not a boolean" };
	}

	const appearance = value.appearance === "secondary" ? "secondary" : "primary";
	const newTab = value.newTab === true;
	const id = optionalString(value.id);
	let target: CmsLinkTarget;

	if (value.type === "custom") {
		const url = safeLinkUrl(value.url);
		if (!url) return { ok: false, reason: "custom link url is not allowed" };
		target = { kind: "external", url };
	} else if (value.type === "reference") {
		const reference = value.reference;
		if (reference === undefined || reference === null) {
			target = { kind: "none" };
		} else {
			if (!isRecord(reference)) {
				return {
					ok: false,
					reason: "link reference is a malformed relationship wrapper",
				};
			}
			const collection = reference.relationTo;
			if (collection !== "pages" && collection !== "posts") {
				return {
					ok: false,
					reason: "link relationTo is outside the consumer contract",
				};
			}
			const doc = reference.value;
			if (doc === undefined || doc === null) {
				target = { kind: "none" };
			} else {
				if (!isRecord(doc)) {
					return {
						ok: false,
						reason: "link target is not populated at depth=1",
					};
				}
				const slug = optionalString(doc.slug)?.trim() ?? null;
				if (!slug) return { ok: false, reason: "populated link target has no slug" };
				if (cmsPathForRelationship(collection, slug) === null) {
					return {
						ok: false,
						reason: "populated link target has no storefront route",
					};
				}
				target = { kind: "internal", collection, slug };
			}
		}
	} else {
		return { ok: false, reason: "link type is not custom or reference" };
	}

	return { ok: true, link: { label, target, newTab, appearance, id } };
}

function readLinks(
	value: unknown,
):
	| { readonly ok: true; readonly links: readonly CmsBlockLink[] }
	| { readonly ok: false; readonly reason: string } {
	if (value === undefined || value === null) return { ok: true, links: [] };
	if (!Array.isArray(value)) return { ok: false, reason: "links is not an array" };
	const links: CmsBlockLink[] = [];
	for (const [index, entry] of value.entries()) {
		const result = readBlockLink(entry);
		if (!result.ok) return { ok: false, reason: `links[${index}] ${result.reason}` };
		links.push(result.link);
	}
	return { ok: true, links };
}

/** Validate one Lexical document, wherever it sits. Returns a failure or `null`. */
function checkLexical(value: unknown, where: string): BlockFailure | null {
	if (!isLexicalDocument(value)) {
		return { ok: false, reason: `${where} is not a Lexical document` };
	}
	const validation = validateLexicalDocument(value);
	if (!validation.ok) {
		return {
			ok: false,
			reason: `${where}: ${validation.reason}`,
			...(validation.nodeType ? { nodeType: validation.nodeType } : {}),
		};
	}
	return null;
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
		return {
			ok: false,
			reason: `${at} has unsupported blockType ${blockType}`,
			blockType,
		};
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
				return {
					ok: false,
					reason: `${at} hero has invalid ${heroLinks.reason}`,
				};
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
				block: {
					...base,
					blockType: "richText",
					content: value.content as LexicalDocument,
				},
			};
		}

		case "image": {
			const media = readMedia(value.media);
			if (media.kind !== "ok") {
				return {
					ok: false,
					reason: `${at} image ${media.kind === "unusable" ? media.why : "has no media"}`,
				};
			}
			return {
				ok: true,
				block: {
					...base,
					blockType: "image",
					media: media.media,
					caption: optionalString(value.caption),
				},
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
				return {
					ok: false,
					reason: `${at} cta has invalid ${ctaLinks.reason}`,
				};
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
				items.push({
					id: optionalString(entry.id),
					question,
					answer: entry.answer as LexicalDocument,
				});
			}
			if (items.length === 0) return { ok: false, reason: `${at} faq has no items` };
			return {
				ok: true,
				block: {
					...base,
					blockType: "faq",
					heading: optionalString(value.heading),
					items,
				},
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
			if (value.mediaPosition !== "left" && value.mediaPosition !== "right") {
				return {
					ok: false,
					reason: `${at} mediaText has invalid mediaPosition`,
				};
			}
			const mediaTextLinks = readLinks(value.links);
			if (!mediaTextLinks.ok) {
				return {
					ok: false,
					reason: `${at} mediaText has invalid ${mediaTextLinks.reason}`,
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
					mediaPosition: value.mediaPosition,
					links: mediaTextLinks.links,
				},
			};
		}

		default: {
			const exhaustive: never = blockType;
			return {
				ok: false,
				reason: `${at} has unhandled blockType ${String(exhaustive)}`,
			};
		}
	}
}
