import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHANNEL_MAP } from "@/lib/channel-map";
import { LEGAL_BODY_NAMES, LEGAL_LOCALES, legalLocaleFor, marketsWithLegalCopy } from "./locale";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Every bilingual legal page, by the module that holds its copy. */
const CONTENT = [
	"kontakt",
	"doprava-a-platba",
	"reklamacie-a-vratenie",
	"odstupenie-od-zmluvy",
	"obchodne-podmienky",
	"ochrana-osobnych-udajov",
	"cookies",
];

describe("which markets have approved legal copy", () => {
	it("maps only markets a human has signed off, not every channel with a locale", () => {
		expect(marketsWithLegalCopy()).toEqual(["sk", "cz", "de", "at"]);
		// There are far more channels than there is approved copy. That gap is the point:
		// a market must not inherit a warranty clause just because a locale string exists.
		expect(Object.keys(CHANNEL_MAP).length).toBeGreaterThan(marketsWithLegalCopy().length);
	});

	it("resolves the Saleor slug, which is what the route params carry", () => {
		expect(legalLocaleFor("sk-eur")).toBe("sk");
		expect(legalLocaleFor("cz-czk")).toBe("cs");
	});

	it("gives Germany and Austria separate legal copy, not one shared German entry", () => {
		// Same language, different law. Austria calls a withdrawal a Rücktritt, runs
		// cookie consent off § 165(3) TKG 2021 rather than § 25 TDDDG, and has its own
		// data-protection authority. Collapsing these into one entry would push those
		// differences into a `channel` branch inside the bodies, where no type and no
		// test can reach them.
		expect(legalLocaleFor("de-eur")).toBe("de");
		expect(legalLocaleFor("at-eur")).toBe("deAt");
		expect(legalLocaleFor("de-eur")).not.toBe(legalLocaleFor("at-eur"));
	});

	it("returns null for a market with no approved copy, and for nonsense", () => {
		expect(legalLocaleFor("pl-pln")).toBeNull();
		expect(legalLocaleFor("us-usd")).toBeNull();
		expect(legalLocaleFor("")).toBeNull();
		expect(legalLocaleFor("../etc/passwd")).toBeNull();
	});
});

describe("every legal page exists in every approved language", () => {
	for (const page of CONTENT) {
		it(`${page} exports a body per language`, () => {
			const src = source(`src/ui/content/legal/${page}.tsx`);
			// One export per entry in LEGAL_LOCALES: `Sk` and `Cs`. A page that gained a
			// language in the map but not a body would 500 at request time, because the
			// factory indexes `copy[locale]` — this is what catches that at build time.
			for (const locale of LEGAL_LOCALES) {
				const name = LEGAL_BODY_NAMES[locale];
				expect(src, `${page} is missing the ${name} body`).toMatch(new RegExp(`export function ${name}\\b`));
			}
		});

		it(`${page} routes internal links through marketHref, not a hardcoded market`, () => {
			const src = source(`src/ui/content/legal/${page}.tsx`);
			// `href="/sk/..."` in a Czech body would silently send the reader to the Slovak
			// page. Nothing else in the stack would notice. The delivered German copy
			// arrived with `/de/...` and `/at/...` written out, so those belong here too.
			expect(src).not.toMatch(/href="\/(sk|cz|de|at)\//);
		});
	}
});

describe("the online withdrawal function is locked to the market its contract names", () => {
	it("requires the SK locale as well as the operational interlock", () => {
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		// Returns V2 pins `market: "SK"` / `locale: "sk"` as literal types, so Payload
		// rejects a notice from any other market. Offering a Czech customer a button that
		// cannot produce a record is the exact outcome the feature exists to prevent.
		expect(page).toContain('legalLocaleFor(channel) === "sk"');
		expect(page).toContain("isWithdrawalFormServable() &&");
	});

	it("still serves the PAGE to every market with approved copy", () => {
		const page = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		// The gate suppresses the form. Suppressing the page would pull a statutory
		// disclosure off a live market, and under cacheComponents a page-level notFound()
		// is not even a 404 — it is HTTP 200 serving the English not-found page.
		expect(page).toContain("const locale = legalLocaleFor(channel); if (!locale) notFound();");
		expect(page).not.toMatch(/if \(!formServable\) notFound\(\)/);
	});
});
