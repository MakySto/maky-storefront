import {
	escapeHtml,
	FEATURE_ICONS,
	plainText,
	sanitizeInline,
	type FeatureIcon,
	type IconName,
} from "./editorjs-sanitize";
import {
	POSTER_WIDTH,
	videoPosterSrc,
	youtubeEmbedUrl,
	youtubeIdFromWatchUrl,
	youtubeWatchUrl,
} from "./video-embed";

/**
 * The typed content profile, `maky-content/1`: the roles a product description can have beyond
 * paragraphs, headings and lists, read out of the blocks Saleor keeps.
 *
 * Saleor 3.23.31 stores only paragraph, header, list, quote, embed, image and table blocks, and
 * rejects the whole mutation on any other type, so the roles travel inside those:
 *
 * - the document's `version` is `maky-content/1` or `maky-content/1:<template>`;
 * - a block's `id` names its role: `maky:callout:tip|info|warn`, `maky:benefits`, `maky:inbox`,
 *   `maky:features`, `maky:steps`, `maky:faq`, `maky:specs`, `maky:documents`, `maky:video` (a `#2`
 *   suffix only keeps a repeated role unique);
 * - an unmarked `header` directly above a marked block is that block's title.
 *
 * The contract, with the sample both repositories test against, is
 * `docs/contracts/maky-content.md`.
 *
 * What this module promises:
 *
 * - Text never gets lost. Every carrier is a standard block, so a reader that does not know the
 *   profile still shows all of it. A marked block this module cannot read (wrong carrier, an
 *   empty or unexpected item, an unsafe link) is NOT dropped: the caller renders it as the
 *   standard block it is, and the problem is reported as an issue. A warning that cannot be
 *   drawn as a callout is an issue of severity `error`.
 * - Nothing from Saleor reaches markup except through `sanitizeInline`. The classes, the icon
 *   names and the labels are this file's own; the second pass in `sanitizeBlock` accepts only
 *   those.
 * - A video is never loaded by the description. The role draws a link to the watch page and a play
 *   mark over the still YouTube keeps of the film, all built from an identifier this file parses
 *   itself (`video-embed.ts`); the still is asked of this site's own image optimizer, and the browser
 *   turns the link into the player on the click, so nothing of YouTube is asked of the shopper's
 *   browser before the shopper asks for the film.
 */

const PROFILE_MAJOR = 1;

type CalloutKind = "tip" | "info" | "warn";
const CALLOUT_KINDS: readonly CalloutKind[] = ["tip", "info", "warn"];

type Role =
	| "callout"
	| "benefits"
	| "inbox"
	| "features"
	| "steps"
	| "faq"
	| "specs"
	| "documents"
	| "video"
	| "cta";
const ROLES: readonly Role[] = [
	"callout",
	"benefits",
	"inbox",
	"features",
	"steps",
	"faq",
	"specs",
	"documents",
	"video",
	"cta",
];

/** The fixed words of the blocks, in the shopper's language. Never taken from the document. */
export interface ContentLabels {
	/** What kind of note a callout is, as its accessible name. */
	callout: Record<CalloutKind, string>;
	/** The words of a video's preview, which is all that stands there until the shopper asks for the film. */
	video: {
		/** The action, said to assistive technology before the film's title: "Prehrať video". */
		play: string;
		/** What the preview says under the title: where the film is hosted and that nothing loads before the click. */
		note: string;
	};
	/**
	 * The shop's own configurator, as a callout names it. The producer's sentence is plain words, the same
	 * in every market ("… overiť kompatibilitu v našom konfigurátore."), and the address is the market's,
	 * so the page joins the two: the first time a callout says `phrase` in plain text, those words are a
	 * link to `href`. Absent where no wording is known, and the sentence then stays text.
	 */
	configurator?: { phrase: string; href: string };
	/**
	 * The products a document names (`meta.productId` of a box item), as this market's catalogue answered
	 * for them: only a product that is published here and complete in this language is in the map. An item
	 * whose product is not in it is drawn without picture and link; nothing is guessed in its place.
	 */
	products?: ReadonlyMap<string, ContentProduct>;
	/** What a box item that links to its product says it does: "Pozrieť diel". */
	viewPart?: string;
}

/** What the catalogue answered for a product a document names. */
export interface ContentProduct {
	/** The product's page in this market. */
	href: string;
	/** The picture, as an address of this site's image optimizer; null when the product has none. */
	image: string | null;
}

export interface ContentBlock {
	type: string;
	id?: unknown;
	data: Record<string, unknown>;
}

interface Envelope {
	/** The profile's major version is one this reader knows: markers are read. */
	typed: boolean;
	/** The template the document names, or null. The registry decides whether it is known. */
	template: string | null;
}

interface Marker {
	role: Role;
	kind: string | null;
}

export interface ContentIssue {
	/** `error` is for what a shopper could be harmed by missing: a warning that cannot be shown. */
	severity: "warn" | "error";
	code: "malformed-block" | "unknown-role" | "warning-not-shown";
	/** Index of the block in the document. */
	block: number;
	marker: string;
	detail: string;
}

const VERSION = /^maky-content\/(\d+)(?::([a-z0-9-]+))?$/;
const MARKER = /^maky:([a-z]+)(?::([a-z]+))?(?:#[1-9]\d?)?$/;

/**
 * Read the envelope. A version that is not this profile, or a major this reader does not know,
 * means the markers are ignored and the document is rendered as plain blocks — which is what a
 * reader that predates the profile does, so a newer producer degrades the same way.
 */
export function readEnvelope(version: unknown): Envelope {
	const found = typeof version === "string" ? VERSION.exec(version) : null;
	if (!found || Number(found[1]) !== PROFILE_MAJOR) return { typed: false, template: null };
	return { typed: true, template: found[2] ?? null };
}

/**
 * `{ role, kind }` of a block id, or null when it is not a marker this reader knows. A well-formed
 * marker of a role it does not know is null too: the caller asks `isUnknownRole` to report it.
 */
export function readMarker(id: unknown): Marker | null {
	if (typeof id !== "string") return null;
	const found = MARKER.exec(id);
	if (!found || !(ROLES as readonly string[]).includes(found[1])) return null;
	return { role: found[1] as Role, kind: found[2] ?? null };
}

/** A well-formed marker of a role this reader does not know (a newer producer, or a typo). */
export function isUnknownRole(id: unknown): boolean {
	if (typeof id !== "string") return false;
	const found = MARKER.exec(id);
	return Boolean(found && !(ROLES as readonly string[]).includes(found[1]));
}

// ─── Reading items ───────────────────────────────────────────────────────────────────────────

interface Item {
	content: string;
	children: unknown[];
	meta: Record<string, unknown> | null;
}

function readItem(raw: unknown): Item | null {
	if (typeof raw === "string") return { content: raw, children: [], meta: null };
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	if (typeof record.content !== "string") return null;
	return {
		content: record.content,
		children: Array.isArray(record.items) ? record.items : [],
		meta: record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : null,
	};
}

/** The text of an item as a shopper reads it, for the "is there anything here" question. */
const visibleText = (html: string): string => plainText(sanitizeInline(html)).trim();

/** Every item of a list block, or null when the block has none or one of them is not readable. */
function readItems(data: Record<string, unknown>): Item[] | null {
	if (!Array.isArray(data.items) || data.items.length === 0) return null;
	const items: Item[] = [];
	for (const raw of data.items) {
		const item = readItem(raw);
		if (!item || !visibleText(item.content)) return null;
		items.push(item);
	}
	return items;
}

const LEADING_STRONG = /^\s*<(strong|b)>([\s\S]*?)<\/\1>\s*([\s\S]*)$/i;

/** `<strong>Title</strong> text` -> its two parts. An item without the leading title is all text. */
function splitTitle(content: string): { title: string; text: string } {
	const found = LEADING_STRONG.exec(content);
	if (!found) return { title: "", text: sanitizeInline(content) };
	return { title: sanitizeInline(found[2]), text: sanitizeInline(found[3]) };
}

const ico = (name: IconName): string => `<span class="maky-ico maky-ico-${name}" aria-hidden="true"></span>`;

/** The title and the text of an item, as the parts every item-built role shares. */
function textParts(content: string, extra = ""): string {
	const { title, text } = splitTitle(content);
	return (
		`<span class="maky-txt">${title ? `<strong class="maky-t">${title}</strong>` : ""}` +
		`${text ? `<span class="maky-d">${text}</span>` : ""}${extra}</span>`
	);
}

// ─── Roles ───────────────────────────────────────────────────────────────────────────────────

/** One row of a parameter sheet as plain text: the label and its value, for what is set outside the sheet. */
export interface SpecFact {
	label: string;
	value: string;
}

/** A role's body, or the reason it cannot be drawn as that role. */
type Body = { html: string; facts?: SpecFact[] } | { problem: string };

const refuse = (problem: string): Body => ({ problem });

function listItemsHtml(items: unknown[]): string {
	return items
		.map((raw) => {
			const item = readItem(raw);
			if (!item) return "";
			const children = listItemsHtml(item.children);
			return `<li>${sanitizeInline(item.content)}${children ? `<ul>${children}</ul>` : ""}</li>`;
		})
		.join("");
}

/**
 * Make the first `phrase` that stands in plain text a link to `href`. `html` is sanitized inline text
 * inside the wrappers this file puts round it, so every `<` in it opens or closes a tag and the rest of
 * the text is escaped. Words that are already inside a link stay that link, and words a tag cuts in two
 * are not found: both are left as the producer wrote them, never turned into a link inside a link.
 */
function linkFirst(html: string, phrase: string, href: string): string {
	let anchors = 0;
	let linked = false;
	return html
		.split(/(<[^>]*>)/)
		.map((part) => {
			if (part.startsWith("<")) {
				if (/^<a[\s>]/i.test(part)) anchors += 1;
				else if (/^<\/a\s*>/i.test(part)) anchors = Math.max(0, anchors - 1);
				return part;
			}
			const at = linked || anchors > 0 ? -1 : part.indexOf(phrase);
			if (at < 0) return part;
			linked = true;
			return `${part.slice(0, at)}<a href="${escapeHtml(href)}">${phrase}</a>${part.slice(
				at + phrase.length,
			)}`;
		})
		.join("");
}

function calloutBody(block: ContentBlock, kind: string | null, title: string, labels: ContentLabels): Body {
	if (!kind || !(CALLOUT_KINDS as readonly string[]).includes(kind)) {
		return refuse(`callout kind ${JSON.stringify(kind)} is not tip, info or warn`);
	}
	const data = block.data ?? {};
	let inner: string;
	if (block.type === "paragraph") {
		if (!visibleText(String(data.text ?? ""))) return refuse("the callout is empty");
		inner = `<p>${sanitizeInline(data.text)}</p>`;
	} else if (block.type === "list") {
		const items = Array.isArray(data.items) ? data.items : [];
		const html = listItemsHtml(items);
		if (!html) return refuse("the callout is empty");
		inner = `<${data.style === "ordered" ? "ol" : "ul"}>${html}</${data.style === "ordered" ? "ol" : "ul"}>`;
	} else {
		return refuse(`a callout is carried by a paragraph or a list, not a ${block.type}`);
	}
	const kindIcon: Record<CalloutKind, IconName> = { tip: "lightbulb", info: "info", warn: "alert" };
	const label = labels.callout[kind as CalloutKind];
	const configurator = labels.configurator;
	if (configurator) inner = linkFirst(inner, configurator.phrase, configurator.href);
	return {
		html:
			`<aside class="maky-callout maky-callout-${kind} not-prose" role="note" aria-label="${escapeHtml(
				label,
			)}">` +
			`${ico(kindIcon[kind as CalloutKind])}<div class="maky-callout-b">` +
			`${title ? `<strong class="maky-callout-t">${title}</strong>` : ""}${inner}</div></aside>`,
	};
}

/**
 * A benefit without a leading title is a selling point that stands on its own ("Aerodynamický profil
 * znižuje hluk vetra"): the whole of it is the title, set as the titles of the other benefits are, not
 * as the small grey text that follows a title.
 */
function benefitText(content: string): string {
	return LEADING_STRONG.test(content)
		? textParts(content)
		: `<span class="maky-txt"><strong class="maky-t">${sanitizeInline(content)}</strong></span>`;
}

function benefitsBody(items: Item[]): Body {
	if (items.some((item) => item.children.length > 0)) return refuse("a benefit has nested items");
	const rows = items.map(
		(item) =>
			`<li><span class="maky-mark" aria-hidden="true">${ico("check")}</span>${benefitText(
				item.content,
			)}</li>`,
	);
	return { html: `<ul class="maky-benefits">${rows.join("")}</ul>` };
}

/** The code of a part: letters, digits and the few marks a set code carries (`2×N10035+N30302`). */
const PART_CODE = /^[A-Za-z0-9][A-Za-z0-9 ._×+-]{0,39}$/;
/** A Saleor global id, as `meta.productId` carries it. */
const PRODUCT_ID = /^[A-Za-z0-9+/=_-]{1,100}$/;
/** The only picture address a part may carry: this site's image optimizer, asked by `content-products.ts`. */
const OPTIMIZED_IMAGE = /^\/_next\/image\?url=[^\s"'<>]+$/;

interface PartMeta {
	qty: number | null;
	unit: string;
	code: string;
	productId: string;
}

/** What an item of the box says about the part it names: how many, of what unit, which code, which product. */
function partMeta(item: Item): PartMeta {
	const meta = item.meta ?? {};
	const qty =
		typeof meta.qty === "number" && Number.isInteger(meta.qty) && meta.qty > 0 && meta.qty < 1000
			? meta.qty
			: null;
	const unit = typeof meta.unit === "string" ? plainText(sanitizeInline(meta.unit)).trim().slice(0, 40) : "";
	const code = typeof meta.code === "string" && PART_CODE.test(meta.code.trim()) ? meta.code.trim() : "";
	const productId =
		typeof meta.productId === "string" && PRODUCT_ID.test(meta.productId) ? meta.productId : "";
	return { qty, unit, code, productId };
}

/** The ids of the products the boxes of a document name, in order, each once. */
export function contentProductIds(blocks: readonly ContentBlock[]): string[] {
	const ids = new Set<string>();
	for (const block of blocks) {
		if (readMarker(block.id)?.role !== "inbox" || block.type !== "list") continue;
		const items = Array.isArray(block.data?.items) ? block.data.items : [];
		for (const raw of items) {
			const item = readItem(raw);
			if (item && partMeta(item).productId) ids.add(partMeta(item).productId);
		}
	}
	return [...ids];
}

function inboxBody(items: Item[], labels: ContentLabels): Body {
	if (items.some((item) => item.children.length > 0)) return refuse("an item of the box has nested items");
	const rows = items.map((item) => {
		const part = partMeta(item);
		const product = part.productId ? labels.products?.get(part.productId) : undefined;
		const image = product?.image && OPTIMIZED_IMAGE.test(product.image) ? product.image : null;
		const counted = [part.qty ? `${part.qty}${part.unit ? ` × ${part.unit}` : ""}` : part.unit, part.code]
			.filter(Boolean)
			.join(" · ");
		// An item that says nothing but its text is the box item it always was.
		if (!counted && !product) {
			return `<li><span class="maky-tile" aria-hidden="true">${ico("package")}</span>${textParts(
				item.content,
			)}</li>`;
		}
		const lead = image
			? `<span class="maky-part-img" aria-hidden="true"><img src="${escapeHtml(
					image,
				)}" alt="" width="128" height="128" loading="lazy" decoding="async"></span>`
			: `<span class="maky-tile" aria-hidden="true">${ico("package")}</span>`;
		const body = `${lead}${textParts(
			item.content,
			counted ? `<span class="maky-part-qty">${counted}</span>` : "",
		)}`;
		const go = labels.viewPart ? `<span class="maky-part-go">${escapeHtml(labels.viewPart)}</span>` : "";
		const inner = product
			? `<a class="maky-part-a" href="${escapeHtml(product.href)}">${body}${go}</a>`
			: `<span class="maky-part-a">${body}</span>`;
		return `<li class="maky-part">${inner}</li>`;
	});
	return { html: `<ul class="maky-inbox">${rows.join("")}</ul>` };
}

function stepsBody(items: Item[]): Body {
	if (items.some((item) => item.children.length > 0)) return refuse("a step has nested items");
	return {
		html: `<ol class="maky-steps">${items
			.map((item) => `<li>${textParts(item.content)}</li>`)
			.join("")}</ol>`,
	};
}

const isFeatureIcon = (name: unknown): name is FeatureIcon =>
	typeof name === "string" && (FEATURE_ICONS as readonly string[]).includes(name);

function featuresBody(items: Item[]): Body {
	const rows: string[] = [];
	for (const item of items) {
		if (item.children.length > 1) return refuse("a feature has more than one caption");
		let caption = "";
		if (item.children.length === 1) {
			const child = readItem(item.children[0]);
			if (!child || child.children.length > 0 || !visibleText(child.content)) {
				return refuse("a feature's caption is not readable");
			}
			caption = `<span class="maky-cap">${sanitizeInline(child.content)}</span>`;
		}
		// An unknown icon name is the producer's defect, not the shopper's: the generic mark keeps the page whole.
		const icon: IconName = isFeatureIcon(item.meta?.icon) ? item.meta.icon : "sparkles";
		rows.push(
			`<li class="maky-feature"><span class="maky-tile maky-tile-lg" aria-hidden="true">${ico(icon)}</span>` +
				`${textParts(item.content, caption)}</li>`,
		);
	}
	return { html: `<ul class="maky-features">${rows.join("")}</ul>` };
}

function faqBody(items: Item[]): Body {
	const rows: string[] = [];
	for (const item of items) {
		if (item.children.length !== 1) return refuse("a question needs exactly one answer");
		const answer = readItem(item.children[0]);
		if (!answer || answer.children.length > 0 || !visibleText(answer.content)) {
			return refuse("an answer is not readable");
		}
		rows.push(
			`<details class="maky-qa"><summary class="maky-q"><span>${sanitizeInline(item.content)}</span>${ico(
				"chevron",
			)}</summary><div class="maky-a">${sanitizeInline(answer.content)}</div></details>`,
		);
	}
	return { html: `<div class="maky-faq">${rows.join("")}</div>` };
}

const DOCUMENT_LINK = /^\s*<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*([\s\S]*)$/i;
const decodeAmpersands = (value: string): string => value.replace(/&amp;/g, "&");
/** A link a document may have: https, or a path on this site. Never protocol-relative, never a scheme of its own. */
const isDocumentUrl = (url: string): boolean =>
	/^https:\/\/[^\s"'<>]+$/i.test(url) || /^\/(?!\/)[^\s"'<>]*$/.test(url);

function documentsBody(items: Item[]): Body {
	const rows: string[] = [];
	for (const item of items) {
		if (item.children.length > 0) return refuse("a document has nested items");
		const found = DOCUMENT_LINK.exec(item.content);
		const url = found ? decodeAmpersands(found[1]) : "";
		if (!found || !isDocumentUrl(url)) return refuse("a document needs a link that is https or on this site");
		const title = plainText(found[2]).trim();
		if (!title) return refuse("a document has no title");
		const meta = plainText(found[3]).trim();
		rows.push(
			`<li class="maky-doc"><span class="maky-tile" aria-hidden="true">${ico("file")}</span>` +
				`<span class="maky-txt"><a class="maky-doc-a" href="${escapeHtml(
					url,
				)}" target="_blank" rel="noopener noreferrer">${title}</a>` +
				// The mark at the end says "this saves a file", which is true of a file on this site; a
				// maker's PDF on its own host is opened in a tab, and the page does not say it saves.
				`${meta ? `<span class="maky-d">${meta}</span>` : ""}</span>${
					url.startsWith("/") ? ico("download") : ""
				}</li>`,
		);
	}
	return { html: `<ul class="maky-docs">${rows.join("")}</ul>` };
}

/**
 * A call to action: one button, from a list of one item that is a single link ("Poradiť s výberom").
 * The link is https or a path on this site, as a document's is, and opens in the same tab: it is
 * a way on in the shop (the contact page, a form), not a file. The label is the link's own text.
 */
function ctaBody(items: Item[]): Body {
	const [item, ...rest] = items;
	if (!item || rest.length > 0 || item.children.length > 0) return refuse("a call to action is one link");
	const found = DOCUMENT_LINK.exec(item.content);
	const url = found ? decodeAmpersands(found[1]) : "";
	if (!found || !isDocumentUrl(url) || plainText(found[3]).trim()) {
		return refuse("a call to action is one link that is https or on this site");
	}
	const label = plainText(found[2]).trim();
	if (!label) return refuse("a call to action has no label");
	return {
		html: `<div class="maky-cta"><a class="maky-cta-a" href="${escapeHtml(url)}">${label}</a></div>`,
	};
}

/**
 * A video: a link to its watch page, set as a 16:9 preview over the film's own still, with a play
 * mark and the film's title. No frame and no address from the document are in it: the identifier is
 * parsed here and every address rebuilt from it. The one picture in the markup is this site's own image
 * optimizer's address for the still (`videoPosterSrc`), never YouTube's, so the markup holds nothing
 * that asks YouTube for anything. Without a script the link opens the watch page in a new tab;
 * `VideoClickToPlay` turns it into the player.
 */
function videoBody(block: ContentBlock, labels: ContentLabels): Body {
	if (block.type !== "embed") return refuse(`a video is carried by an embed, not a ${block.type}`);
	const data = block.data ?? {};
	if (data.service !== "youtube")
		return refuse(`video service ${JSON.stringify(data.service)} is not youtube`);
	const id = youtubeIdFromWatchUrl(data.source);
	if (!id) return refuse("the video's source is not a youtube.com watch address");
	// The two addresses are the document's record of ONE video. Two different ones are a defect of
	// the producer, and a page that picked either would be guessing which film the product means.
	if (data.embed !== youtubeEmbedUrl(id)) {
		return refuse("the video's embed address is not the one its source names");
	}
	// Text, not inline markup: the title sits inside the preview's own link, and a link inside a
	// link is a second destination the page never wrote.
	const title = plainText(sanitizeInline(data.caption)).trim();
	if (!title) return refuse("a video has no title");
	// Decorative, so no alt text: the link says what the preview is. It is drawn in the stage, under the
	// play mark, and a still that does not load leaves the card the shop made. The words are not drawn
	// over it: a still carries lettering of its own, and two sets of words that meet read as a clash.
	const still = `<img src="${escapeHtml(videoPosterSrc(id))}" alt="" width="${POSTER_WIDTH}" height="${
		(POSTER_WIDTH * 9) / 16
	}" loading="lazy" decoding="async">`;
	return {
		html:
			`<div class="maky-video"><a class="maky-video-a" href="${youtubeWatchUrl(
				id,
			)}" target="_blank" rel="noopener noreferrer">` +
			`<span class="maky-video-stage">${still}` +
			`<span class="maky-video-play" aria-hidden="true">${ico("play")}</span></span>` +
			`<span class="maky-video-txt"><span class="maky-video-sr">${escapeHtml(labels.video.play)}: </span>` +
			`<strong class="maky-video-t">${title}</strong>` +
			`<span class="maky-video-n">${escapeHtml(labels.video.note)}</span></span></a></div>`,
	};
}

/** A value longer than this reads as a sentence: it gets the row's full width. */
const LONG_VALUE = 32;

function specsBody(block: ContentBlock): Body {
	const data = block.data ?? {};
	if (block.type !== "table") return refuse(`specs are carried by a table, not a ${block.type}`);
	if (data.withHeadings === true) return refuse("specs have no heading row");
	if (!Array.isArray(data.content)) return refuse("specs have no rows");

	const groups: { title: string | null; rows: { label: string; value: string }[] }[] = [];
	const facts: SpecFact[] = [];
	let valued = 0;
	for (const row of data.content) {
		if (!Array.isArray(row) || row.length !== 2 || row.some((cell) => typeof cell !== "string")) {
			return refuse("a specs row is not two text cells");
		}
		const [label, value] = (row as string[]).map((cell) => cell.trim());
		if (!label && !value) continue;
		if (label && !value) {
			// A group's title: the first cell filled, the second empty.
			groups.push({ title: sanitizeInline(label), rows: [] });
			continue;
		}
		if (!label) return refuse("a specs row has a value and no label");
		if (groups.length === 0) groups.push({ title: null, rows: [] });
		groups[groups.length - 1].rows.push({ label: sanitizeInline(label), value: sanitizeInline(value) });
		facts.push({
			label: plainText(sanitizeInline(label)).trim(),
			value: plainText(sanitizeInline(value)).trim(),
		});
		valued += 1;
	}
	if (valued === 0) return refuse("specs have no row with a value");

	const html = groups
		.map((group) => {
			const rows = group.rows
				.map((row) => {
					const long = plainText(row.value).length > LONG_VALUE;
					return `<div class="maky-sr${long ? " maky-sr-long" : ""}"><dt>${row.label}</dt><dd>${
						row.value
					}</dd></div>`;
				})
				.join("");
			return `<section class="maky-sg">${group.title ? `<h4 class="maky-sg-t">${group.title}</h4>` : ""}${
				rows ? `<dl>${rows}</dl>` : ""
			}</section>`;
		})
		.join("");
	return { html: `<div class="maky-specs">${html}</div>`, facts };
}

// ─── One marked block ────────────────────────────────────────────────────────────────────────

interface RenderedRole {
	role: Role;
	/** The block as it stands in the description: its title, if any, and its body. */
	html: string;
	/** The block's own heading as sanitized inline HTML, or null. */
	title: string | null;
	/** The block without its heading. */
	body: string;
	/** A parameter sheet's rows as plain text, in order; set only for `specs`. */
	facts?: SpecFact[];
}

type RoleOutcome = RenderedRole | { problem: string };

/**
 * Render a block that carries a role marker, with the unmarked heading directly above it (if
 * there is one) as its title. Answers `{ problem }` when the block cannot be drawn as its role;
 * the caller then renders it as the standard block it is, so no text is lost.
 *
 * A callout holds its title inside the box. Every other role is a titled section whose heading is
 * an `h3`: the description sits under the page's own "Product description" heading, so the level
 * is the page's to choose and the producer's heading level is not used.
 */
export function renderRole(
	block: ContentBlock,
	marker: Marker,
	header: ContentBlock | null,
	labels: ContentLabels,
): RoleOutcome {
	const headingHtml = header ? sanitizeInline(header.data?.text) : "";
	const title = visibleText(headingHtml) ? headingHtml : null;

	if (marker.role === "callout") {
		const body = calloutBody(block, marker.kind, title ?? "", labels);
		if ("problem" in body) return body;
		return { role: "callout", html: body.html, title: null, body: body.html };
	}

	let body: Body;
	if (marker.role === "video") {
		body = videoBody(block, labels);
	} else if (marker.role === "specs") {
		body = specsBody(block);
	} else if (block.type !== "list") {
		body = refuse(`${marker.role} is carried by a list, not a ${block.type}`);
	} else {
		const items = readItems(block.data ?? {});
		if (!items) {
			body = refuse(`${marker.role} has no items, or an item without text`);
		} else {
			switch (marker.role) {
				case "benefits":
					body = benefitsBody(items);
					break;
				case "inbox":
					body = inboxBody(items, labels);
					break;
				case "steps":
					body = stepsBody(items);
					break;
				case "features":
					body = featuresBody(items);
					break;
				case "faq":
					body = faqBody(items);
					break;
				case "documents":
					body = documentsBody(items);
					break;
				case "cta":
					body = ctaBody(items);
					break;
				default:
					body = refuse(`${marker.role} is not drawn from a list`);
			}
		}
	}
	if ("problem" in body) return body;
	return {
		role: marker.role,
		html: `<section class="maky-blk not-prose">${title ? `<h3 class="maky-h">${title}</h3>` : ""}${
			body.html
		}</section>`,
		title,
		body: body.html,
		...(body.facts ? { facts: body.facts } : {}),
	};
}

/**
 * Whether a block has anything a shopper would read. A block that does not is not a loss when it
 * cannot be shown; one that does and is not shown is.
 */
export function hasText(block: ContentBlock): boolean {
	const data = block.data ?? {};
	if (typeof data.text === "string") return Boolean(visibleText(data.text));
	if (Array.isArray(data.items)) {
		return data.items.some((raw) => {
			const item = readItem(raw);
			return item ? Boolean(visibleText(item.content)) || item.children.length > 0 : false;
		});
	}
	if (Array.isArray(data.content)) {
		return data.content.some(
			(row) => Array.isArray(row) && row.some((cell) => typeof cell === "string" && visibleText(cell)),
		);
	}
	// A block this module cannot read the text of: assume it has some.
	return true;
}
