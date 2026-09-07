import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { companyInfo } from "./company";

/**
 * The storefront shipped for a month stating "Predávajúci nie je platiteľom DPH"
 * in the pricing clause of the terms of sale while product pages priced with VAT.
 * Google indexed it. These assertions exist so that cannot come back quietly.
 */

const BANNED = [
	"nie je platiteľom DPH",
	"nie sme platiteľom DPH",
	"nie je platiteľom dane z pridanej hodnoty",
	"Platiteľ DPH:</strong> nie",
	"neplatiteľ",
];

const LEGAL_SURFACES = [
	"src/app/[channel]/(main)/kontakt/page.tsx",
	"src/app/[channel]/(main)/obchodne-podmienky/page.tsx",
	"src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx",
	"src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx",
	"src/app/[channel]/(main)/ochrana-osobnych-udajov/page.tsx",
	"src/app/[channel]/(main)/o-nas/page.tsx",
	"src/config/company.ts",
];

const read = (rel: string) => {
	const abs = path.join(process.cwd(), rel);
	return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
};

describe("company identity", () => {
	it("carries the VAT number", () => {
		expect(companyInfo.icDph).toBe("SK2122890660");
	});

	it("does not keep a separate vatPayer boolean that could drift from icDph", () => {
		expect(companyInfo).not.toHaveProperty("vatPayer");
	});

	it("states an effective date for VAT registration and for the terms", () => {
		expect(companyInfo.vatEffectiveFrom).toBeTruthy();
		expect(companyInfo.termsEffectiveFrom).toBe(companyInfo.vatEffectiveFrom);
	});
});

describe("legal surfaces", () => {
	for (const rel of LEGAL_SURFACES) {
		it(`${rel} claims no non-VAT-payer status`, () => {
			const src = read(rel);
			if (src === null) return; // page not present in this build of the app
			for (const phrase of BANNED) {
				expect(src, `"${phrase}" must not appear in ${rel}`).not.toContain(phrase);
			}
		});
	}

	it("the terms of sale identify the seller with the VAT number", () => {
		const src = read("src/app/[channel]/(main)/obchodne-podmienky/page.tsx");
		expect(src).toContain("companyInfo.icDph");
		// Either wording is fine; what must never pass is a negated one, hence the
		// lookbehind. `BANNED` above catches the known negations, this catches the
		// affirmative claim actually being present.
		expect(src).toMatch(/(?<!nie )je platiteľom (?:DPH|dane z pridanej hodnoty)/);
	});

	it("the contact page identifies the seller with the VAT number", () => {
		const src = read("src/app/[channel]/(main)/kontakt/page.tsx");
		expect(src).toContain("companyInfo.icDph");
	});
});
