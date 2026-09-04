import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The "z toho DPH" line is a statement about a tax document, so the only thing
 * worth testing is where the number comes from.
 *
 * There is no DOM in this suite (`environment: "node"`, `include: **\/*.test.ts`),
 * so this reads the sources — the same contract-test idiom as
 * `src/lib/withdrawal/ui-contract.test.ts`. A rendering test would prove the row
 * appears; these prove the figure in it was computed by Saleor and not here,
 * which is the part a person has to stand behind.
 */

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const read = (relativePath: string): string => readFileSync(join(root, relativePath), "utf8");
const collapse = (text: string): string => text.replace(/\s+/g, " ");

const SUMMARY = "src/checkout/views/saleor-checkout/order-summary.tsx";

describe("the VAT figure is read from the server, never derived here", () => {
	it("takes it from Saleor's TaxedMoney.tax on both the checkout and the order", () => {
		const summary = collapse(read(SUMMARY));

		// Checkout in progress and the placed order are two different documents with
		// two different field names for the same server-computed amount.
		expect(summary).toContain("tax: checkout.totalPrice?.tax?.amount || 0");
		expect(summary).toContain("tax: order.total?.tax?.amount || 0");
	});

	it("asks for the field, so the line cannot go quietly empty", () => {
		// Trimming `tax` out of a fragment would leave `tax` at 0 for every basket and
		// silently remove the line rather than break anything visible.
		expect(collapse(read("src/checkout/graphql/checkout.graphql"))).toContain(
			"totalPrice { gross { ...Money } tax { ...Money } }",
		);
		expect(collapse(read("src/checkout/graphql/order.graphql"))).toContain(
			"total { gross { ...Money } tax { ...Money } }",
		);
	});

	it("renders the server value and nothing computed from a rate", () => {
		const summary = read(SUMMARY);

		expect(collapse(summary)).toContain('<span>{t("summary.vatIncluded")}</span>');
		expect(collapse(summary)).toContain("<data value={tax}>{formatMoney(tax)}</data>");

		// Strip comments before looking for arithmetic — the reasons are written down
		// in this file and mention rates in prose.
		const code = summary.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

		// A VAT rate in the browser, in any of the forms it usually arrives in.
		expect(code).not.toMatch(/\b(?:0?\.2\d|1\.2\d|2[0-7])\s*(?:\/|\*)/);
		expect(code).not.toMatch(/(?:\/|\*)\s*(?:0?\.2\d|1\.2\d|2[0-7])\b/);
		expect(code).not.toMatch(/\bVAT_RATE\b|\btaxRate\b|\bvatRate\b/i);

		// And no reconstruction of the tax out of the other amounts.
		expect(code).not.toMatch(/tax\s*=\s*[^;\n]*(?:total|subtotal)\s*-/);
		expect(code).not.toMatch(/(?:total|subtotal)\s*-\s*(?:net|subtotal|total)\b/);
	});

	it("keeps it out of the additive column, where it would read as a second charge", () => {
		const summary = collapse(read(SUMMARY));

		// Everything inside the <dl> is an addend; the gross total already contains the
		// tax. The line therefore has to sit after the total block, not inside the list.
		const listEnd = summary.indexOf("</dl>");
		const vatLine = summary.indexOf('t("summary.vatIncluded")');
		const totalLine = summary.indexOf('t("summary.total")');

		expect(listEnd).toBeGreaterThan(-1);
		expect(vatLine).toBeGreaterThan(listEnd);
		expect(vatLine).toBeGreaterThan(totalLine);
	});

	it("shows nothing rather than a zero the server never asserted", () => {
		// Before a delivery address exists there is nothing to compute tax against, and
		// a market outside EU VAT genuinely has none. Both arrive here as 0.
		expect(collapse(read(SUMMARY))).toContain("{tax > 0 && (");
	});

	it("carries the Slovak wording, and marks the key as legally sensitive", () => {
		const sk = JSON.parse(read("src/i18n/messages/sk-SK.json")) as {
			checkout: { summary: Record<string, string> };
		};
		expect(sk.checkout.summary.vatIncluded).toBe("z toho DPH");

		const manifest = JSON.parse(read("docs/i18n/commerce-source-en.json")) as {
			keys: Record<string, { legallySensitive?: boolean }>;
		};
		expect(manifest.keys["checkout.summary.vatIncluded"]?.legallySensitive).toBe(true);
	});
});
