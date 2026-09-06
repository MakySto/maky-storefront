import { describe, expect, it } from "vitest";

import { FITMENT_VERDICTS, isFitmentOfferable, type FitmentVerdict } from "./contract";

/**
 * The one gate, and the two halves it will not separate.
 *
 * Six surfaces ask this question — the resolver, the configurator, the offer layer, the
 * PLP, the PDP and the server-side cart gate. Six answers is five chances to disagree,
 * and the one that disagrees generously is the one that sells a rack that does not fit.
 */

const sellable = { sellable: true, reasons: [] };
const held = { sellable: false, reasons: ["known_mapping_suspect"] };

describe("which verdicts may be offered at all", () => {
	it("is exactly the two that mean 'it fits'", () => {
		const offerable = FITMENT_VERDICTS.filter((v: FitmentVerdict) =>
			isFitmentOfferable({ verdict: v, eligibility: sellable }),
		);
		expect(offerable).toEqual(["VERIFIED_FIT", "MANUFACTURER_FIT"]);
	});

	it("never offers NEEDS_DETAIL — that is a question we have not asked yet", () => {
		expect(isFitmentOfferable({ verdict: "NEEDS_DETAIL", eligibility: sellable })).toBe(false);
	});
});

describe("the source's own decision is not optional", () => {
	it("refuses a perfect verdict on a product the source will not stand behind", () => {
		// The 47 known-suspect mappings: correct years, matching qualifiers, and a source
		// that says do not sell this one. Fixing the years did not make it a fit.
		expect(isFitmentOfferable({ verdict: "VERIFIED_FIT", eligibility: held })).toBe(false);
		expect(isFitmentOfferable({ verdict: "MANUFACTURER_FIT", eligibility: held })).toBe(false);
	});

	it("treats a MISSING decision as refusal, never as permission", () => {
		// A row that does not say it may be sold is a row that may not be sold. Anything
		// else makes an exporter bug an opportunity to sell.
		expect(isFitmentOfferable({ verdict: "VERIFIED_FIT" })).toBe(false);
		expect(isFitmentOfferable({ verdict: "VERIFIED_FIT", eligibility: null })).toBe(false);
	});
});
