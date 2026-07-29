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
 * Only `pages` has a public route today. Next resolves static segments before the
 * `[productSlug]` catch-all, so `/sk/o-nas` reaches the o-nas route rather than
 * being read as a product slug — but a CMS page with no matching route would fall
 * through to the product lookup. `posts` and `brands` have no storefront route at
 * all yet, so those links render as plain text instead of pointing at a 404.
 */
function internalHref(internal: NonNullable<LexicalLink["internal"]>, channel: string): string | null {
	if (internal.collection === "pages") return marketHref(channel, `/${internal.slug}`);
	return null;
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

	// Unsafe scheme or an unresolvable reference: keep the words, drop the link.
	return <Fragment key={key}>{children}</Fragment>;
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
			return <List key={key}>{renderChildren(node, channel, key)}</List>;
		}

		case "listitem":
			return <li key={key}>{renderChildren(node, channel, key)}</li>;

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
