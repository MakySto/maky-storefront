import xss, { safeAttrValue as defaultSafeAttrValue, type IWhiteList } from "xss";

/**
 * What may reach a page from a product description, and how.
 *
 * Saleor's text is sanitized to a handful of inline tags (`sanitizeInline`) BEFORE it is placed
 * in any markup this code builds. The finished markup is then sanitized once more
 * (`sanitizeBlock`) against a whitelist that includes the tags and classes the renderers emit
 * themselves. Nothing from Saleor can reach a `class` or a `role`: the inline pass has no such
 * attribute, and the second pass accepts only the exact values listed here, so widening the
 * whitelist for a new block never opens a general styling channel.
 */

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

/**
 * The one class this renderer emits for a plain table.
 *
 * A wide table has to be able to scroll inside its own box, or it widens the
 * page and the whole document pans sideways on a phone. That needs a container
 * element, and the container needs a hook to style — so `div` carries `class`,
 * and `safeAttrValue` below rejects every value except this exact one (or a
 * token of the lists further down). Nothing from Saleor can reach that attribute
 * in any case: cell text is sanitized with INLINE_TAGS first, which has neither
 * `div` nor any `class`.
 */
export const TABLE_SCROLL_CLASS = "maky-prose-scroll";

const BLOCK_TAGS: IWhiteList = {
	...INLINE_TAGS,
	// `class` and the few ARIA/focus attributes exist for what the renderers build themselves —
	// the scroll container, the comparison table and the typed content blocks. Text from Saleor
	// is sanitized with INLINE_TAGS before it is placed in any of them, so none of it can reach
	// these attributes; and `safeAttrValue` below accepts only the exact values emitted here.
	a: ["href", "title", "target", "rel", "class"],
	aside: ["class", "role", "aria-label"],
	blockquote: [],
	caption: ["class"],
	dd: [],
	details: ["class"],
	div: ["class", "tabindex", "role", "aria-label"],
	dl: [],
	dt: [],
	figcaption: [],
	figure: [],
	h2: [],
	h3: ["class"],
	h4: ["class"],
	h5: [],
	h6: [],
	hr: [],
	img: ["src", "alt", "width", "height", "loading", "decoding"],
	li: ["class"],
	ol: ["class"],
	p: [],
	section: ["class"],
	span: ["class", "aria-hidden"],
	strong: ["class"],
	summary: ["class"],
	table: ["class"],
	tbody: [],
	td: ["class", "colspan"],
	th: ["class", "scope", "colspan"],
	thead: [],
	tr: ["class"],
	ul: ["class"],
};

/**
 * The classes each tag may carry in the comparison table (styled in `brand.css`). `not-prose`
 * keeps the typography plugin's table rules off it.
 */
const COMPARISON_CLASSES: Record<string, readonly string[]> = {
	div: ["maky-cmp", "maky-cmp-head", "maky-cmp-frame", "maky-cmp-scroll", "not-prose"],
	span: [
		"maky-cmp-cap",
		"maky-cmp-you",
		"maky-cmp-name",
		"maky-cmp-yes",
		"maky-cmp-no",
		"maky-cmp-nil",
		"maky-cmp-fade",
		"maky-cmp-gl",
		"maky-cmp-sv",
		"maky-cmp-sr",
	],
	caption: ["maky-cmp-sr"],
	table: ["maky-cmp-table"],
	tr: ["maky-cmp-grp", "maky-cmp-common"],
	th: ["maky-cmp-self"],
	td: ["maky-cmp-self", "maky-cmp-same", "maky-cmp-nw"],
};

/**
 * The icons the typed blocks may draw (masks in `brand.css`). A producer may name one on a
 * feature (`FEATURE_ICONS`, the closed set of `docs/contracts/maky-content.md`); anything else is
 * drawn as the generic mark, so an unknown name can neither break the page nor reach a class.
 * The structural icons belong to the renderers: a callout's kind, a benefit's tick, the FAQ's
 * chevron, a document's file and download marks.
 */
export const FEATURE_ICONS = [
	"battery",
	"stand",
	"smartphone",
	"lightbulb",
	"snowflake",
	"plug",
	"shield",
] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];
const STRUCTURAL_ICONS = [
	"alert",
	"check",
	"chevron",
	"download",
	"file",
	"info",
	"package",
	"sparkles",
] as const;
export type IconName = FeatureIcon | (typeof STRUCTURAL_ICONS)[number];

/**
 * The classes of the typed content blocks, as one set for the tags that carry them. Every
 * renderer in `editorjs-content.ts` builds its markup from these and nothing else.
 */
const CONTENT_CLASS_TOKENS: readonly string[] = [
	"not-prose",
	// the titled wrapper of a block and its heading
	"maky-blk",
	"maky-h",
	// callouts
	"maky-callout",
	"maky-callout-tip",
	"maky-callout-info",
	"maky-callout-warn",
	"maky-callout-b",
	"maky-callout-t",
	// the parts items are built from
	"maky-ico",
	...[...FEATURE_ICONS, ...STRUCTURAL_ICONS].map((name) => `maky-ico-${name}`),
	"maky-mark",
	"maky-tile",
	"maky-tile-lg",
	"maky-txt",
	"maky-t",
	"maky-d",
	"maky-cap",
	// one per role
	"maky-benefits",
	"maky-inbox",
	"maky-features",
	"maky-feature",
	"maky-steps",
	"maky-faq",
	"maky-qa",
	"maky-q",
	"maky-a",
	"maky-docs",
	"maky-doc",
	"maky-doc-a",
	"maky-specs",
	"maky-sg",
	"maky-sg-t",
	"maky-sr",
	"maky-sr-long",
];

const CONTENT_CLASS_TAGS = new Set([
	"a",
	"aside",
	"details",
	"div",
	"h3",
	"h4",
	"li",
	"ol",
	"section",
	"span",
	"strong",
	"summary",
	"ul",
]);

/** What a value is allowed to be, per attribute, once the tag has let the attribute through. */
const FIXED_ATTRIBUTE_VALUES: Record<string, RegExp> = {
	scope: /^(col|row|rowgroup)$/,
	colspan: /^[1-9]\d?$/,
	tabindex: /^0$/,
	role: /^(region|note)$/,
	"aria-hidden": /^true$/,
};

const STRIPPED_BODIES = ["script", "style", "iframe", "object", "embed"];

/** Every inline text from Saleor passes through here before it is put in markup. */
export const sanitizeInline = (value: unknown): string =>
	xss(typeof value === "string" ? value : "", {
		whiteList: INLINE_TAGS,
		stripIgnoreTag: true,
		stripIgnoreTagBody: STRIPPED_BODIES,
	});

/** The finished markup of one block, checked once more against the renderers' own whitelist. */
export const sanitizeBlock = (value: string): string =>
	xss(value, {
		whiteList: BLOCK_TAGS,
		stripIgnoreTag: true,
		stripIgnoreTagBody: STRIPPED_BODIES,
		safeAttrValue(tag, name, attributeValue, cssFilter) {
			// `class` exists for what the renderers build and nothing else. A value is kept only
			// when it is the scroll container's exact class, or when every token is one this tag
			// is listed for; anything else is dropped rather than passed through, so widening the
			// whitelist cannot become a general styling channel.
			if (name === "class") {
				if (attributeValue === TABLE_SCROLL_CLASS && tag === "div") return attributeValue;
				const allowed = [
					...(COMPARISON_CLASSES[tag] ?? []),
					...(CONTENT_CLASS_TAGS.has(tag) ? CONTENT_CLASS_TOKENS : []),
				];
				const tokens = attributeValue.split(/\s+/).filter(Boolean);
				return tokens.length > 0 && tokens.every((token) => allowed.includes(token)) ? tokens.join(" ") : "";
			}
			if (name === "aria-label") {
				return tag === "div" || tag === "aside"
					? defaultSafeAttrValue(tag, name, attributeValue, cssFilter)
					: "";
			}
			const fixed = FIXED_ATTRIBUTE_VALUES[name];
			if (fixed) return fixed.test(attributeValue) ? attributeValue : "";
			return defaultSafeAttrValue(tag, name, attributeValue, cssFilter);
		},
	});

export const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The visible text of an HTML string: every tag dropped, the entities left as the text they are. */
export const plainText = (html: string): string => xss(html, { whiteList: {}, stripIgnoreTag: true });
