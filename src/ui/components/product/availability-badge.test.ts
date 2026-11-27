import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sk from "@/i18n/messages/sk-SK.json";
import {
	AvailabilityBadge,
	isLastPiece,
	resolveAvailability,
	type AvailabilityInput,
} from "./availability-badge";

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../../i18n/messages");

/**
 * Untracked sale-to-order products receive a synthetic quantity cap, which must
 * never become a stock promise. Tracked products are the inverse: their
 * channel-aware quantity is the real warehouse fact.
 */
describe("resolveAvailability", () => {
	it("renders the CFM sale-to-order mode", () => {
		expect(resolveAvailability({ mode: "sale_to_order" })).toEqual({ key: "onDemand", tone: "info" });
	});

	it("says NOTHING when the metadata is absent", () => {
		// CFM has not published availability for this product yet. Silence is the
		// only honest output — a guess here is a promise to the customer.
		expect(resolveAvailability({})).toBeNull();
		expect(resolveAvailability({ mode: null })).toBeNull();
		expect(resolveAvailability({ mode: "" })).toBeNull();
	});

	it("says nothing for an unrecognised mode rather than inventing one", () => {
		expect(resolveAvailability({ mode: "in_stock" })).toBeNull();
		expect(resolveAvailability({ mode: "sale-to-order" })).toBeNull();
	});

	it("never turns a positive quantityAvailable into a stock claim", () => {
		// 50 is Saleor's configuration cap for these variants, not real stock.
		expect(resolveAvailability({ quantityAvailable: 50 })).toBeNull();
		expect(resolveAvailability({ quantityAvailable: 1 })).toBeNull();
		expect(resolveAvailability({ quantityAvailable: 999 })).toBeNull();
	});

	it("lets real tracked stock win over a stale sale-to-order mode", () => {
		expect(
			resolveAvailability({
				mode: "sale_to_order",
				trackInventory: true,
				quantityAvailable: 3,
			}),
		).toEqual({ key: "inStock", tone: "success" });
	});

	it("keeps an untracked synthetic cap as sale-to-order", () => {
		expect(
			resolveAvailability({
				mode: "sale_to_order",
				trackInventory: false,
				quantityAvailable: 50,
			}),
		).toEqual({ key: "onDemand", tone: "info" });
	});

	it("does report a hard zero as out of stock", () => {
		expect(resolveAvailability({ quantityAvailable: 0 })).toEqual({ key: "outOfStock", tone: "muted" });
	});

	it("lets a hard zero win over the sale-to-order mode", () => {
		// Nothing orderable is orderable-on-demand.
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: 0 })).toEqual({
			key: "outOfStock",
			tone: "muted",
		});
	});

	it("reports a tracked zero as out of stock", () => {
		expect(
			resolveAvailability({ mode: "sale_to_order", trackInventory: true, quantityAvailable: 0 }),
		).toEqual({ key: "outOfStock", tone: "muted" });
	});

	it("treats an unknown quantity as unknown, not as zero", () => {
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: null })).toEqual({
			key: "onDemand",
			tone: "info",
		});
		expect(resolveAvailability({ mode: "sale_to_order", quantityAvailable: undefined })).toEqual({
			key: "onDemand",
			tone: "info",
		});
	});
});

/**
 * The resolver returns a message KEY; the customer reads a STRING. Asserting the
 * key alone leaves the sentence on the page untested, and the sentence is the
 * part that either is or is not a promise the business can keep.
 *
 * These are dropship items ordered from the supplier on demand, so the Slovak
 * copy states the lead time rather than implying a shelf.
 */
describe("the Slovak sentence a sale-to-order product shows", () => {
	const ON_DEMAND_SK = "Na objednávku, dodanie 5–10 pracovných dní";

	/** Every shape CFM can hand a sale-to-order product. */
	const saleToOrderInputs = [
		{ mode: "sale_to_order" },
		{ mode: "sale_to_order", quantityAvailable: 50 },
		{ mode: "sale_to_order", quantityAvailable: 1 },
		{ mode: "sale_to_order", quantityAvailable: null },
		{ mode: "sale_to_order", quantityAvailable: undefined },
	];

	it("names the order and the delivery window", () => {
		expect(sk.common.onDemand).toBe(ON_DEMAND_SK);

		for (const input of saleToOrderInputs) {
			const resolved = resolveAvailability(input);
			expect(resolved, JSON.stringify(input)).not.toBeNull();
			expect(sk.common[resolved!.key], JSON.stringify(input)).toBe(ON_DEMAND_SK);
		}
	});

	it("never says Skladom and never says Posledné kusy", () => {
		// Both strings exist in the bundle and both would be lies here: `inStock` is
		// only reachable from a stock count nobody keeps, and `lowStock` is an
		// urgency line invented from Saleor's synthetic cap of 50.
		expect(sk.common.inStock).toBe("Skladom");
		expect(sk.product.lowStock).toBe("Posledné kusy");

		for (const input of saleToOrderInputs) {
			const rendered = sk.common[resolveAvailability(input)!.key];
			expect(rendered, JSON.stringify(input)).not.toBe(sk.common.inStock);
			expect(rendered, JSON.stringify(input)).not.toBe(sk.product.lowStock);
		}
	});
});

/**
 * One piece left of a tracked variant: the product page's quantity control is locked at 1 (both
 * buttons off) and the badge beside it is the only place that can say why.
 */
describe("the last piece of a tracked variant", () => {
	const LOCALES = [
		"cs-CZ",
		"de-AT",
		"de-DE",
		"en-CA",
		"en-US",
		"es-ES",
		"fr-FR",
		"hu-HU",
		"it-IT",
		"pl-PL",
		"ro-RO",
		"sk-SK",
	] as const;
	const messages = (locale: string) =>
		JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8")) as {
			common: Record<string, string>;
		};
	const detailed = (locale: string, input: AvailabilityInput) => {
		const common = messages(locale).common;
		return renderToStaticMarkup(
			createElement(AvailabilityBadge, { ...input, detailed: true, label: (key) => common[key] }),
		);
	};

	it("is one piece of counted stock and nothing else", () => {
		expect(isLastPiece({ trackInventory: true, quantityAvailable: 1 })).toBe(true);
		for (const quantityAvailable of [0, 2, 3, 50, null, undefined]) {
			expect(isLastPiece({ trackInventory: true, quantityAvailable }), String(quantityAvailable)).toBe(false);
		}
	});

	it("is never read from Saleor's cap on an untracked variant", () => {
		// For an untracked variant the number is a checkout ceiling, not stock.
		expect(isLastPiece({ trackInventory: false, quantityAvailable: 1 })).toBe(false);
		expect(isLastPiece({ quantityAvailable: 1 })).toBe(false);
		expect(isLastPiece({ mode: "sale_to_order", quantityAvailable: 1 })).toBe(false);
		expect(isLastPiece({ mode: "sale_to_order", trackInventory: null, quantityAvailable: 1 })).toBe(false);
	});

	it("is said under the state on the product page, in every market's language", () => {
		for (const locale of LOCALES) {
			const { common } = messages(locale);
			expect(common.lastPiece, locale).toBeTruthy();
			const html = detailed(locale, { trackInventory: true, quantityAvailable: 1 });
			expect(html, locale).toContain(common.inStock);
			expect(html, locale).toContain(common.lastPiece);
		}
		expect(messages("sk-SK").common.lastPiece).toBe("Posledný kus");
		expect(messages("de-DE").common.lastPiece).toBe("Letztes Stück");
	});

	it("is not said when more than one piece is in stock", () => {
		for (const locale of LOCALES) {
			const html = detailed(locale, { trackInventory: true, quantityAvailable: 2 });
			expect(html, locale).toContain(messages(locale).common.inStock);
			expect(html, locale).not.toContain(messages(locale).common.lastPiece);
		}
	});

	it("is not said for a product ordered on demand, whatever number Saleor reports", () => {
		const { common } = messages("sk-SK");
		for (const quantityAvailable of [1, 50, null]) {
			const html = detailed("sk-SK", { mode: "sale_to_order", quantityAvailable });
			expect(html, String(quantityAvailable)).toContain(common.onDemandShort);
			expect(html, String(quantityAvailable)).not.toContain(common.lastPiece);
		}
	});

	it("leaves the listing card's short badge as it was", () => {
		const { common } = messages("sk-SK");
		const html = renderToStaticMarkup(
			createElement(AvailabilityBadge, {
				trackInventory: true,
				quantityAvailable: 1,
				short: true,
				label: (key) => common[key],
			}),
		);
		expect(html).toContain(common.inStock);
		expect(html).not.toContain(common.lastPiece);
	});
});
