import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import {
	QUOTE_REFERENCE_MAX,
	cleanQuoteReference,
	quoteReferenceFor,
	quoteReferenceFromFragment,
	quoteRequestHref,
} from "./quote-request";

/**
 * "Request a quote": the product travels from its page to `/kontakt` in the URL fragment.
 *
 * What is pinned here is the part that has no browser in it: what a reference is allowed to be, how it is
 * built from a product, how it goes into a link and how it comes out of one. The fragment is written by
 * whoever writes the link, and what it says is printed on this shop's page, so reading is as strict as writing.
 */

const SK = CHANNEL_MAP.sk.saleorSlug;
const DE = CHANNEL_MAP.de.saleorSlug;
const US = CHANNEL_MAP.us.saleorSlug;

const FRIDGE = "PRO-USER CoolZ 83 l (TK20410)";
const fragmentOf = (href: string): string => href.slice(href.indexOf("#"));

describe("cleanQuoteReference", () => {
	it("leaves an ordinary product name and its code as they are", () => {
		expect(cleanQuoteReference(FRIDGE)).toBe(FRIDGE);
		expect(cleanQuoteReference("Strešný box Thule Motion XT XL 500 l")).toBe(
			"Strešný box Thule Motion XT XL 500 l",
		);
	});

	it("keeps the first line only and collapses white space", () => {
		expect(cleanQuoteReference("  CoolZ   83 l \n Pošlite mi peniaze ")).toBe("CoolZ 83 l");
		expect(cleanQuoteReference("CoolZ\u2028Second line")).toBe("CoolZ");
		expect(cleanQuoteReference("CoolZ\t83\u00a0l")).toBe("CoolZ 83 l");
	});

	it("drops formatting characters, the right-to-left override among them", () => {
		// U+202E would make the rest of a line read backwards; U+200B and U+00AD are invisible.
		expect(cleanQuoteReference("CoolZ\u202E 83\u200B l\u00AD")).toBe("CoolZ 83 l");
	});

	it("is null when nothing is left", () => {
		for (const raw of ["", "   ", "\n\n", "\u200B\u202E", "\t"]) {
			expect(cleanQuoteReference(raw), JSON.stringify(raw)).toBeNull();
		}
	});

	it("cuts a long reference at the limit and says so with an ellipsis", () => {
		const cut = cleanQuoteReference("a".repeat(500));
		expect(cut).not.toBeNull();
		expect(Array.from(cut ?? "")).toHaveLength(QUOTE_REFERENCE_MAX);
		expect(cut?.endsWith("…")).toBe(true);
		// Exactly the limit is not cut.
		expect(cleanQuoteReference("a".repeat(QUOTE_REFERENCE_MAX))).toBe("a".repeat(QUOTE_REFERENCE_MAX));
	});

	it("cuts on a code point, never through a surrogate pair", () => {
		const emoji = "\u{1F600}";
		const cut = cleanQuoteReference(`${"a".repeat(QUOTE_REFERENCE_MAX - 2)}${emoji.repeat(3)}`) ?? "";
		expect(Array.from(cut)).toHaveLength(QUOTE_REFERENCE_MAX);
		// encodeURIComponent throws on a lone surrogate.
		expect(() => encodeURIComponent(cut)).not.toThrow();
	});
});

describe("quoteReferenceFor", () => {
	it("is the name, then the public code in brackets", () => {
		expect(quoteReferenceFor("PRO-USER CoolZ 83 l", "TK20410")).toBe(FRIDGE);
	});

	it("is the one of them that there is", () => {
		expect(quoteReferenceFor("PRO-USER CoolZ 83 l", null)).toBe("PRO-USER CoolZ 83 l");
		expect(quoteReferenceFor("PRO-USER CoolZ 83 l", undefined)).toBe("PRO-USER CoolZ 83 l");
		expect(quoteReferenceFor("PRO-USER CoolZ 83 l", "  ")).toBe("PRO-USER CoolZ 83 l");
		expect(quoteReferenceFor("", "TK20410")).toBe("TK20410");
		expect(quoteReferenceFor("\u200B", "")).toBeNull();
	});

	it("cuts the name, never the code, when both do not fit", () => {
		const reference = quoteReferenceFor("N".repeat(300), "TK20410") ?? "";
		expect(Array.from(reference)).toHaveLength(QUOTE_REFERENCE_MAX);
		expect(reference.endsWith("… (TK20410)")).toBe(true);
		expect(reference.startsWith("N".repeat(109))).toBe(true);
	});

	it("falls back to plain cutting when the code alone is too long to leave room for a name", () => {
		const reference = quoteReferenceFor("CoolZ", "C".repeat(200)) ?? "";
		expect(Array.from(reference).length).toBeLessThanOrEqual(QUOTE_REFERENCE_MAX);
	});
});

describe("quoteRequestHref", () => {
	it("opens the contact page of the market with the product in the fragment", () => {
		expect(quoteRequestHref(US, FRIDGE)).toBe("/us/kontakt#quote=PRO-USER%20CoolZ%2083%20l%20(TK20410)");
		expect(quoteRequestHref(SK, FRIDGE)).toBe("/sk/kontakt#quote=PRO-USER%20CoolZ%2083%20l%20(TK20410)");
		expect(quoteRequestHref(DE, FRIDGE).startsWith("/de/kontakt#quote=")).toBe(true);
	});

	it("escapes what would end or split a fragment", () => {
		const href = quoteRequestHref(SK, "A&B #1 100% +x");
		expect(href).toBe("/sk/kontakt#quote=A%26B%20%231%20100%25%20%2Bx");
		expect(quoteReferenceFromFragment(fragmentOf(href))).toBe("A&B #1 100% +x");
	});

	it("is the plain contact page without a reference", () => {
		expect(quoteRequestHref(SK, null)).toBe("/sk/kontakt");
		expect(quoteRequestHref(SK, undefined)).toBe("/sk/kontakt");
		expect(quoteRequestHref(SK, "")).toBe("/sk/kontakt");
		expect(quoteRequestHref(SK, "\u200B")).toBe("/sk/kontakt");
	});

	it("does not put a market other than the product's own into the link", () => {
		for (const [market, row] of Object.entries(CHANNEL_MAP)) {
			expect(quoteRequestHref(row.saleorSlug, FRIDGE).startsWith(`/${market}/kontakt#`), market).toBe(true);
		}
	});
});

describe("quoteReferenceFromFragment", () => {
	it("reads the reference out of the fragment, with the hash or without it", () => {
		const fragment = fragmentOf(quoteRequestHref(US, FRIDGE));
		expect(quoteReferenceFromFragment(fragment)).toBe(FRIDGE);
		expect(quoteReferenceFromFragment(fragment.slice(1))).toBe(FRIDGE);
	});

	it("round-trips every market's link", () => {
		for (const row of Object.values(CHANNEL_MAP)) {
			const reference = quoteReferenceFor("Kompresorová autochladnička PRO-USER CoolZ 83 l", "TK20410");
			expect(quoteReferenceFromFragment(fragmentOf(quoteRequestHref(row.saleorSlug, reference)))).toBe(
				reference,
			);
		}
	});

	it("reads nothing where there is nothing to read", () => {
		for (const fragment of ["", "#", "#faq", "#other=1", "#quote=", "#quote=%20%20", "#quote=%0A", "quote"]) {
			expect(quoteReferenceFromFragment(fragment), fragment).toBeNull();
		}
	});

	it("cleans what a link carries, as it does what a page writes", () => {
		// A second line, and a right-to-left override (E2 80 AE in UTF-8).
		expect(quoteReferenceFromFragment("#quote=CoolZ%0A%0APosli%20peniaze")).toBe("CoolZ");
		expect(quoteReferenceFromFragment("#quote=Cool%E2%80%AEZ")).toBe("CoolZ");
		expect(Array.from(quoteReferenceFromFragment(`#quote=${"a".repeat(1000)}`) ?? "")).toHaveLength(
			QUOTE_REFERENCE_MAX,
		);
	});

	it("takes the first of several, and ignores other keys", () => {
		expect(quoteReferenceFromFragment("#utm=x&quote=First&quote=Second")).toBe("First");
	});

	it("does not throw on a malformed escape", () => {
		expect(() => quoteReferenceFromFragment("#quote=%E0%A4%A")).not.toThrow();
		expect(() => quoteReferenceFromFragment("#quote=%")).not.toThrow();
		expect(quoteReferenceFromFragment("#quote=100%")).toBe("100%");
	});
});
