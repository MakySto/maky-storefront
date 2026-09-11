/**
 * The limited inline HTML CFM puts inside block text, parsed into a tree.
 *
 * The schema allows exactly two things — `<a href="/…">` and `<b>` — and the real
 * export agrees: across 15 958 text fragments the only tags present are `a`
 * (12 240) and `b` (14), the only attribute on `a` is `href`, all 1 473 distinct
 * hrefs are simple relative paths, and there is no nesting at all. Measured on
 * 2026-09-11, not assumed.
 *
 * It is parsed into nodes rather than handed to `dangerouslySetInnerHTML`, so the
 * renderer emits React elements and text. That makes injection structurally
 * impossible instead of merely filtered: there is no path by which a supplied
 * string becomes markup, whatever a future export contains. Anything this parser
 * does not recognise survives as literal TEXT — visible and wrong rather than
 * silent and dangerous, which is the safe direction for content that crosses a
 * network from another system.
 */

export type InlineNode =
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "bold"; readonly children: readonly InlineNode[] }
	| { readonly kind: "link"; readonly href: string; readonly children: readonly InlineNode[] };

const ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

export function decodeEntities(value: string): string {
	return value.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * An internal path we are willing to link to, or `null`.
 *
 * Only a single-slash-rooted path. That rejects `javascript:`, `data:` and
 * protocol-relative `//evil.test` — the last being the one that looks like a path
 * and is not. No scheme is allowed at all: every link in this content is internal
 * by contract, so an external one would be a contract change, not a value to be
 * quietly accepted. Whitespace and control characters are refused outright,
 * because they are how a blocked scheme gets smuggled past a naive prefix test.
 */
export function safeInternalPath(href: string): string | null {
	const value = decodeEntities(href).trim();
	if (!value.startsWith("/")) return null;
	if (value.startsWith("//")) return null;
	if (/[\u0000-\u0020\u007f<>"'\\]/.test(value)) return null;
	return value;
}

const TAG = /<(\/?)(a|b)\b([^>]*)>/gi;

export function parseInline(raw: string): readonly InlineNode[] {
	const out: InlineNode[] = [];
	let cursor = 0;
	let open: { tag: "a" | "b"; href: string | null; children: InlineNode[] } | null = null;

	const push = (node: InlineNode) => (open ? open.children.push(node) : out.push(node));
	const pushText = (value: string) => {
		if (value.length > 0) push({ kind: "text", value: decodeEntities(value) });
	};

	for (const match of raw.matchAll(TAG)) {
		const [full, closing, nameRaw, attrs] = match;
		const index = match.index ?? 0;
		const name = nameRaw.toLowerCase() as "a" | "b";

		pushText(raw.slice(cursor, index));
		cursor = index + full.length;

		if (!closing) {
			if (open) {
				// Nesting does not occur in the data and is not supported. Keeping the
				// tag as text makes the anomaly visible instead of guessing at intent.
				pushText(full);
				continue;
			}
			const href =
				name === "a" ? safeInternalPath(/href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "") ?? null : null;
			open = { tag: name, href, children: [] };
			continue;
		}

		if (!open || open.tag !== name) {
			pushText(full); // stray close tag — show it, do not swallow it
			continue;
		}
		const { tag, href, children } = open;
		open = null;
		if (tag === "b") out.push({ kind: "bold", children });
		else if (href) out.push({ kind: "link", href, children });
		// An <a> whose href we refused keeps its text and loses the link.
		else out.push(...children);
	}

	pushText(raw.slice(cursor));
	// An unterminated tag: keep what it contained rather than dropping it.
	if (open) out.push(...open.children);
	return out;
}

/**
 * Add the market prefix to an internal path — exactly once.
 *
 * `urlPath` in the snapshot carries no market segment, and prefixing an already
 * prefixed path is how `/sk/sk/...` happens.
 */
export function withMarketPrefix(path: string, market: string): string {
	const prefix = `/${market}`;
	if (path === prefix || path.startsWith(`${prefix}/`)) return path;
	return `${prefix}${path}`;
}
