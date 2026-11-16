import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "@/lib/channel-map";
import { marketHasRoute } from "@/lib/route-policy";
import { orderLegalLinks } from "./order-legal-links";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (relativePath: string): string => readFileSync(join(root, relativePath), "utf8");

describe("orderLegalLinks", () => {
	it("links the Slovak market's own three pages", () => {
		expect(orderLegalLinks("sk-eur")).toEqual({
			terms: "/sk/obchodne-podmienky",
			privacy: "/sk/ochrana-osobnych-udajov",
			withdrawal: "/sk/odstupenie-od-zmluvy",
		});
	});

	it("gives every market either all three links under its own prefix, or none", () => {
		for (const [market, config] of Object.entries(CHANNEL_MAP)) {
			const links = orderLegalLinks(config.saleorSlug);
			const served = ["obchodne-podmienky", "ochrana-osobnych-udajov", "odstupenie-od-zmluvy"].every(
				(segment) => marketHasRoute(market, segment),
			);
			if (!served) {
				expect(links, market).toBeNull();
				continue;
			}
			expect(Object.values(links ?? {}), market).toHaveLength(3);
			for (const href of Object.values(links ?? {})) expect(href.startsWith(`/${market}/`), href).toBe(true);
		}
	});

	it("says nothing for a channel it does not know", () => {
		expect(orderLegalLinks("not-a-channel")).toBeNull();
		expect(orderLegalLinks("")).toBeNull();
	});
});

/**
 * Where the sentence is. There is no DOM in this suite, so this reads the sources (the idiom of
 * `order-summary-vat.test.ts`): each of the three places an order can be placed from carries the note, and the
 * note stands before the button it speaks about.
 */
describe("the order sentence stands beside every order button", () => {
	const collapse = (text: string): string => text.replace(/\s+/g, " ");

	it("in the card form, above the button", () => {
		const form = collapse(read("src/checkout/components/payment/stripe/stripe-payment-form.tsx"));
		const note = form.indexOf("<OrderLegalNote");
		expect(note).toBeGreaterThan(-1);
		expect(form.indexOf("<Button", note)).toBeGreaterThan(note);
	});

	it("in the order that needs no payment", () => {
		expect(read("src/checkout/components/payment/stripe/free-order-checkout.tsx")).toContain(
			"<OrderLegalNote",
		);
	});

	it("in the payment step for a method that submits the step's own form", () => {
		expect(collapse(read("src/checkout/views/saleor-checkout/payment-step.tsx"))).toContain(
			"{!usesClientSubmit ? <OrderLegalNote",
		);
	});

	it("opens the pages in a new tab, so a filled-in card form survives reading them", () => {
		const note = read("src/checkout/components/payment/order-legal-note.tsx");
		expect(note).toContain('target="_blank"');
		expect(note).toContain('rel="noopener"');
	});

	it("has the sentence with its three links in every language", () => {
		for (const config of Object.values(CHANNEL_MAP)) {
			const messages = JSON.parse(read(`src/i18n/messages/${config.locale}.json`)) as {
				checkout: { payment: { legalNote: string } };
			};
			const sentence = messages.checkout.payment.legalNote;
			for (const tag of ["terms", "privacy", "withdrawal"]) {
				expect(sentence, config.locale).toContain(`<${tag}>`);
				expect(sentence, config.locale).toContain(`</${tag}>`);
			}
		}
	});
});
