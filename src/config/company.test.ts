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
	// German (DE + AT). The German copy states the affirmative — "in der Slowakei
	// umsatzsteuerlich registriert" — and the failure mode to guard is the same one
	// that shipped in Slovak: a negation that reads as reassurance. `Kleinunternehmer`
	// is the § 19 UStG small-business exemption; claiming it on a page that also prices
	// with VAT would be the exact contradiction this file exists to prevent.
	"nicht umsatzsteuerlich registriert",
	"nicht umsatzsteuerpflichtig",
	"keine Umsatzsteuer ausgewiesen",
	"Kleinunternehmer",
	// Polish. The copy states the affirmative — "zarejestrowanym podatnikiem VAT na
	// Słowacji" — and the failure mode is the same negation-as-reassurance that shipped
	// in Slovak. "Zwolnienie podmiotowe" is the art. 113 small-business VAT exemption;
	// claiming it on pages that price with VAT would be the same contradiction.
	"nie jest podatnikiem VAT",
	"nie jesteśmy podatnikiem VAT",
	"niezarejestrowany podatnik VAT",
	"zwolniony z VAT",
	"zwolnienie podmiotowe",
	// Hungarian. "Alanyi adómentes" is the equivalent small-business exemption, and
	// "nem áfaalany" the direct negation of the affirmative claim the copy makes.
	"nem áfaalany",
	"nem vagyunk áfaalany",
	"nem alanya az áfának",
	"alanyi adómentes",
	"áfamentes",
	// Italian. The copy states the affirmative — "registrata ai fini IVA in Slovacchia" —
	// so the failure mode is its negation. "Regime forfettario" is the Italian
	// small-business flat-rate regime, the counterpart of Kleinunternehmer and zwolnienie
	// podmiotowe; claiming it on pages that price with VAT is the same contradiction.
	"non è soggetto a IVA",
	"non siamo soggetti a IVA",
	"non è registrata ai fini IVA",
	"regime forfettario",
	"esente da IVA",
	// French. Affirmative in the copy is "assujettie à la TVA en Slovaquie". "Franchise en
	// base de TVA" is the equivalent small-business exemption. Both genders of the
	// negation are listed because the subject is "la société".
	"non assujetti à la TVA",
	"non assujettie à la TVA",
	"ne sommes pas assujettis à la TVA",
	"franchise en base de TVA",
	"exonéré de TVA",
	"exonérée de TVA",
];

/**
 * Every file that can put a VAT claim in front of a customer.
 *
 * A glob, not a list, because the copy moved once already: it used to live inline in the
 * route files and now lives in `src/ui/content/legal/` so a second language could share
 * the route. A fixed list would have gone on passing while pointing at files that no
 * longer contain any prose — the assertions would still be green and would be checking
 * nothing. Resolving the surfaces at run time means new pages and new languages are
 * covered the moment they exist, which is the only way this guard survives a refactor.
 */
const LEGAL_SLUGS = [
	"kontakt",
	"obchodne-podmienky",
	"reklamacie-a-vratenie",
	"odstupenie-od-zmluvy",
	"ochrana-osobnych-udajov",
	"o-nas",
	"doprava-a-platba",
	"cookies",
];

function legalSurfaces(): string[] {
	const routes = LEGAL_SLUGS.map((slug) => `src/app/[channel]/(main)/${slug}/page.tsx`);
	const contentDir = path.join(process.cwd(), "src/ui/content/legal");
	const content = fs.existsSync(contentDir)
		? fs
				.readdirSync(contentDir)
				.filter((f) => f.endsWith(".tsx"))
				.map((f) => `src/ui/content/legal/${f}`)
		: [];
	return [...routes, ...content, "src/ui/components/legal/o-nas-static.tsx", "src/config/company.ts"];
}

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
	for (const rel of legalSurfaces()) {
		it(`${rel} claims no non-VAT-payer status`, () => {
			const src = read(rel);
			if (src === null) return; // page not present in this build of the app
			for (const phrase of BANNED) {
				expect(src, `"${phrase}" must not appear in ${rel}`).not.toContain(phrase);
			}
		});
	}

	it("the terms of sale identify the seller with the VAT number", () => {
		const src = legalSurfaces()
			.map(read)
			.filter((s): s is string => s !== null)
			.join("\n");
		expect(src).toContain("companyInfo.icDph");
		// Either wording is fine; what must never pass is a negated one, hence the
		// lookbehind. `BANNED` above catches the known negations, this catches the
		// affirmative claim actually being present.
		expect(src).toMatch(/(?<!nie )je platiteľom (?:DPH|dane z pridanej hodnoty)/);
	});

	it("every language that states VAT payer status states it affirmatively", () => {
		const src = legalSurfaces()
			.map(read)
			.filter((s): s is string => s !== null)
			.join("\n");
		// Czech spells it "plátcem"; a negated Czech form must fail here too.
		expect(src).not.toMatch(/n(?:e|ie)ní plátcem/i);
		expect(src).not.toMatch(/nie je platiteľom/i);
		// German negates by inserting `nicht`/`kein` around the registration claim, so
		// the wording differs from the Slovak and Czech forms above and needs its own
		// pattern rather than another entry in BANNED.
		expect(src).not.toMatch(/(?:nicht|kein[e]?)\s+(?:in der Slowakei\s+)?umsatzsteuerlich/i);
		expect(src).not.toMatch(/keine\s+Umsatzsteuer-Identifikationsnummer/i);
		// Polish inserts the negation before the noun phrase, so the German pattern above
		// does not reach it: "nie jest zarejestrowana jako podatnik VAT".
		expect(src).not.toMatch(
			/nie\s+(?:jest|jesteśmy|są)\s+(?:zarejestrowan\w+\s+)?(?:jako\s+)?podatnik\w*\s+VAT/i,
		);
		expect(src).not.toMatch(/nie\s+jest\s+zarejestrowan\w+\s+(?:jako\s+)?podatnik/i);
		// Hungarian negates with a preceding "nem" and agglutinates the rest, so it too
		// needs its own pattern rather than another BANNED entry.
		expect(src).not.toMatch(/nem\s+(?:nyilvántartott\s+)?áfaalany/i);
		expect(src).not.toMatch(/nem\s+(?:vagyunk|minősül)\s+áfaalany/i);
	});
});
