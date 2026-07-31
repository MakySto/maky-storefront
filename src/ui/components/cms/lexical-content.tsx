import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
	alignmentClass,
	headingTag,
	listTag,
	nodeChildren,
	nodeText,
	readLink,
	textFormats,
	type LexicalDocument,
	type LexicalLink,
	type LexicalNode,
} from "@/lib/cms/lexical";
import { cmsPathForRelationship } from "@/lib/cms/link-routes";
import { marketHref } from "@/lib/channel-map";

/**
 * Renders Payload Lexical content as React elements.
 *
 * A server component with no client JS: it produces elements directly rather than
 * an HTML string, so there is no `dangerouslySetInnerHTML` and no sanitiser in the
 * path. That is a deliberate departure from the Saleor `/pages/[slug]` reader,
 * which goes EditorJS → html string → `xss()` → `dangerouslySetInnerHTML`. Safety
 * here comes from construction; the only attribute carrying untrusted input is a
 * link `href`, and that is validated in `safeLinkUrl`.
 *
 * Coverage is deliberately wider than the current content. Verified in production:
 * paragraph, text, linebreak, autolink. Also handled because the editor can emit
 * them: heading, list, listitem, link, quote. An unhandled node renders nothing
 * and logs — it must never throw, and it must never pass silently.
 */

function logUnsupported(event: string, detail: Record<string, unknown>): void {
	console.error(`[cms] ${event}`, JSON.stringify(detail));
}

/**
 * Storefront URL for an internally linked CMS document.
 *
 * Only registered `pages` slugs have public routes today. Next resolves static segments before the
 * `[productSlug]` catch-all, so `/sk/o-nas` reaches the o-nas route rather than
 * being read as a product slug. Unknown Page slugs and populated Post targets are
 * rejected before rendering; the nullable return is defensive, not a degradation path.
 */
function internalHref(internal: NonNullable<LexicalLink["internal"]>, channel: string): string | null {
	const path = cmsPathForRelationship(internal.collection, internal.slug);
	return path ? marketHref(channel, path) : null;
}

function renderTextNode(node: LexicalNode, key: string): ReactNode {
	const text = nodeText(node);
	if (text.length === 0) return null;

	const format = textFormats(node);
	let content: ReactNode = text;

	// Nesting order is cosmetic — any order produces the same rendering.
	if (format.code) content = <code>{content}</code>;
	if (format.strikethrough) content = <s>{content}</s>;
	if (format.underline) content = <u>{content}</u>;
	if (format.italic) content = <em>{content}</em>;
	if (format.bold) content = <strong>{content}</strong>;

	return <Fragment key={key}>{content}</Fragment>;
}

function renderLinkNode(node: LexicalNode, channel: string, key: string): ReactNode {
	const link = readLink(node);
	const children = renderChildren(node, channel, key);

	if (link.internal) {
		const href = internalHref(link.internal, channel);
		if (href) {
			return (
				<Link
					key={key}
					href={href}
					{...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
				>
					{children}
				</Link>
			);
		}
		logUnsupported("link-target-has-no-route", {
			collection: link.internal.collection,
			slug: link.internal.slug,
		});
		return <Fragment key={key}>{children}</Fragment>;
	}

	if (link.url) {
		return (
			<a key={key} href={link.url} {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
				{children}
			</a>
		);
	}

	// A null/missing supported relationship target may intentionally keep only its words.
	// Unsafe schemes and malformed/populated unroutable targets fail validation earlier.
	return <Fragment key={key}>{children}</Fragment>;
}

function renderListItem(node: LexicalNode, channel: string, key: string, numbered: boolean): ReactNode {
	const value =
		numbered && typeof node.value === "number" && Number.isInteger(node.value) && node.value > 0
			? node.value
			: undefined;
	return (
		<li key={key} {...(value === undefined ? {} : { value })}>
			{renderChildren(node, channel, key)}
		</li>
	);
}

function renderNode(node: LexicalNode, channel: string, key: string): ReactNode {
	switch (node.type) {
		case "paragraph":
			return (
				<p key={key} className={alignmentClass(node)}>
					{renderChildren(node, channel, key)}
				</p>
			);

		case "heading": {
			const Heading = headingTag(node);
			return (
				<Heading key={key} className={alignmentClass(node)}>
					{renderChildren(node, channel, key)}
				</Heading>
			);
		}

		case "quote":
			return <blockquote key={key}>{renderChildren(node, channel, key)}</blockquote>;

		case "list": {
			const List = listTag(node);
			const numbered = List === "ol";
			const start =
				numbered && typeof node.start === "number" && Number.isInteger(node.start) && node.start > 0
					? node.start
					: undefined;
			const children = nodeChildren(node).map((child, index) =>
				child.type === "listitem"
					? renderListItem(child, channel, key + "." + index, numbered)
					: renderNode(child, channel, key + "." + index),
			);
			return (
				<List key={key} {...(start === undefined ? {} : { start })}>
					{children}
				</List>
			);
		}

		case "listitem":
			return renderListItem(node, channel, key, false);

		case "text":
			return renderTextNode(node, key);

		case "linebreak":
			return <br key={key} />;

		case "link":
		case "autolink":
			return renderLinkNode(node, channel, key);

		default:
			logUnsupported("unsupported-lexical-node", { nodeType: node.type });
			return null;
	}
}

function renderChildren(node: LexicalNode, channel: string, keyPrefix: string): ReactNode[] {
	return nodeChildren(node).map((child, index) => renderNode(child, channel, `${keyPrefix}.${index}`));
}

/**
 * @param channel the `[channel]` route param (the Saleor slug, e.g. `sk-eur`),
 * used to build market-prefixed hrefs for internal links.
 */
export function LexicalContent({
	document,
	channel,
}: {
	document: LexicalDocument;
	channel: string;
}): ReactNode {
	return <>{renderChildren(document.root, channel, "root")}</>;
}
