import { marketHref } from "@/lib/channel-map";

/**
 * A request for a quote, from a product page to `/kontakt`.
 *
 * A product the shop shows but cannot sell in a market (a car fridge in the United States and
 * Canada, 2026-10-08) gets a "request a quote" link instead of a buy button, and the link opens
 * the contact page. The product travels in the URL's FRAGMENT, `/us/kontakt#quote=CoolZ%2083%20l%20(TK20410)`:
 *
 * - the fragment never reaches the server, so `/kontakt` stays the one static page it is, a legally
 *   required disclosure with no per-product variants to cache, crawl or log;
 * - only the browser reads it, to show the product above the approved contact copy and to fill the
 *   message of the form where the form is offered.
 *
 * The fragment can be written by anybody, and what it says is shown on this shop's page, so a
 * reference is cleaned on the way in as well as on the way out (`cleanQuoteReference`): one line, no
 * control or formatting characters (the right-to-left override among them), at most 120 characters. It
 * is only ever rendered as text, never as markup or as a link.
 */

/** The fragment's key: `#quote=…`. */
export const QUOTE_FRAGMENT_KEY = "quote";

/** The longest reference carried, in characters (code points). A product name and its code fit. */
export const QUOTE_REFERENCE_MAX = 120;

const codePoints = (text: string): string[] => Array.from(text);

/**
 * One tidy line of text, or null when nothing is left of it.
 *
 * Only the first line is kept. Control characters become a space; format characters (soft hyphen,
 * zero-width and bidirectional marks), private-use, unassigned and lone surrogate code points are
 * dropped; runs of white space collapse to one space. A reference longer than the limit is cut on a
 * code point, never in the middle of a surrogate pair, and ends in an ellipsis.
 */
export function cleanQuoteReference(raw: string): string | null {
	const firstLine = raw.split(/[\r\n\u2028\u2029]/u)[0] ?? "";
	const text = firstLine
		.replace(/\p{Cc}/gu, " ")
		.replace(/[\p{Cf}\p{Co}\p{Cs}\p{Cn}]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
	if (!text) return null;
	const points = codePoints(text);
	if (points.length <= QUOTE_REFERENCE_MAX) return text;
	return `${points
		.slice(0, QUOTE_REFERENCE_MAX - 1)
		.join("")
		.trimEnd()}…`;
}

/**
 * What a product page calls the product it asks a quote for: its name, then its public code in
 * brackets. When both do not fit, the name is cut and the code stays, because the code is what the
 * shop finds the product by.
 */
export function quoteReferenceFor(name: string, code?: string | null): string | null {
	const cleanName = cleanQuoteReference(name);
	const cleanCode = code ? cleanQuoteReference(code) : null;
	if (!cleanCode) return cleanName;
	if (!cleanName) return cleanCode;

	const suffix = ` (${cleanCode})`;
	const room = QUOTE_REFERENCE_MAX - codePoints(suffix).length;
	if (room < 1) return cleanQuoteReference(`${cleanName}${suffix}`);
	const points = codePoints(cleanName);
	const fitted =
		points.length <= room
			? cleanName
			: `${points
					.slice(0, room - 1)
					.join("")
					.trimEnd()}…`;
	return `${fitted}${suffix}`;
}

/** The link a product page puts on its "request a quote" button. Without a reference, the plain contact page. */
export function quoteRequestHref(channel: string, reference: string | null | undefined): string {
	const base = marketHref(channel, "/kontakt");
	const cleaned = reference ? cleanQuoteReference(reference) : null;
	return cleaned ? `${base}#${QUOTE_FRAGMENT_KEY}=${encodeURIComponent(cleaned)}` : base;
}

/** The reference in a URL fragment (`#quote=…`, leading `#` optional), cleaned, or null when there is none. */
export function quoteReferenceFromFragment(fragment: string): string | null {
	const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
	const raw = params.get(QUOTE_FRAGMENT_KEY);
	return raw ? cleanQuoteReference(raw) : null;
}
