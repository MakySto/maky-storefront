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
		expect(marketsWithLegalCopy()).toEqual(["sk", "cz", "de", "at", "pl", "hu"]);
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

	it("gives Poland and Hungary their own copy, sharing no body with each other", () => {
		// Different languages, different national law, and — unlike de/deAt — not one
		// syllable of shared prose. They share the company, not the text.
		expect(legalLocaleFor("pl-pln")).toBe("pl");
		expect(legalLocaleFor("hu-huf")).toBe("hu");
		expect(legalLocaleFor("pl-pln")).not.toBe(legalLocaleFor("hu-huf"));
	});

	it("returns null for a market with no approved copy, and for nonsense", () => {
		// `it` stands in for "a market we have not written copy for". It used to be `pl`,
		// which stopped testing anything the moment Polish copy landed — the same way `de`
		// stopped when German did. Whoever adds Italian must move this fixture again
		// rather than delete the assertion, or the test goes on passing while checking
		// nothing.
		expect(legalLocaleFor("it-eur")).toBeNull();
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
			// arrived with `/de/...` and `/at/...` written out, and the Polish and Hungarian
			// documents likewise print `/pl/...` and `/hu/...` as their reference URLs, so
			// every approved market belongs in this pattern.
			expect(src).not.toMatch(/href="\/(sk|cz|de|at|pl|hu)\//);
		});
	}
});

describe("the <h1> and the <title> may differ, and only where the copy says so", () => {
	const ROUTES = [
		"src/app/[channel]/(main)/kontakt/page.tsx",
		"src/app/[channel]/(main)/doprava-a-platba/page.tsx",
		"src/app/[channel]/(main)/reklamacie-a-vratenie/page.tsx",
		"src/app/[channel]/(main)/obchodne-podmienky/page.tsx",
		"src/app/[channel]/(main)/ochrana-osobnych-udajov/page.tsx",
		"src/app/[channel]/(main)/cookies/page.tsx",
		"src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx",
	];

	it("leaves sk, cs, de and at with a single string, so their output cannot move", () => {
		// `heading` is optional and the factory falls back to `title`. The four markets
		// that shipped before it existed must therefore not acquire one: if they did, the
		// fallback would stop being what renders their <h1>, and this change would no
		// longer be output-neutral for them.
		for (const rel of ROUTES) {
			const src = source(rel);
			for (const locale of ["sk", "cs", "de", "deAt"]) {
				// One locale's object literal. The indent is captured and back-referenced so
				// the match stops at THAT entry's closing brace: the seven page routes nest
				// their locales one level deeper (inside `copy:`) than the withdrawal route
				// nests them inside `META`, and a fixed indent silently ran past the end of
				// the block into the next locale.
				const block = new RegExp(`\\n(\\t+)${locale}: \\{[\\s\\S]*?\\n\\1\\},`).exec(src)?.[0] ?? "";
				expect(block, `${rel} has no ${locale} entry to check`).not.toBe("");
				expect(block, `${rel} gave ${locale} a heading`).not.toMatch(/\bheading:/);
			}
		}
	});

	it("gives a heading only to the pages whose delivered h1 really differs", () => {
		// From the delivered PL/HU copy: Polish and Hungarian shipping, Polish terms and
		// both withdrawal pages carry a market qualifier or a longer phrase in the tab
		// that does not belong above the text. Everything else is genuinely one string.
		const shipping = source("src/app/[channel]/(main)/doprava-a-platba/page.tsx");
		expect(shipping).toContain('heading: "Dostawa i płatności"');
		expect(shipping).toContain('heading: "Szállítás és fizetés"');
		expect(shipping).toContain('title: "Dostawa i płatności – Polska"');

		const terms = source("src/app/[channel]/(main)/obchodne-podmienky/page.tsx");
		expect(terms).toContain('heading: "Regulamin sklepu"');

		const withdrawal = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx");
		expect(withdrawal).toContain('heading: "Odstąpienie od umowy"');
		expect(withdrawal).toContain('heading: "Elállási jog"');

		// Pages where the two are the same must NOT invent a third wording.
		expect(source("src/app/[channel]/(main)/kontakt/page.tsx")).not.toMatch(/\bheading:/);
		expect(source("src/app/[channel]/(main)/cookies/page.tsx")).not.toMatch(/\bheading:/);
	});

	it("renders the h1 from heading and keeps the title for SEO", () => {
		const factory = source("src/lib/legal/legal-route.tsx").replace(/\s+/g, " ");
		expect(factory).toContain("<LegalPage title={resolved.heading ?? resolved.title}>");
		expect(factory).toContain("title: formatPageTitle(resolved.title)");

		// The withdrawal page builds its own LegalPage and must follow the same rule.
		const withdrawal = source("src/app/[channel]/(main)/odstupenie-od-zmluvy/page.tsx").replace(/\s+/g, " ");
		expect(withdrawal).toContain("<LegalPage title={META[locale].heading ?? META[locale].title}>");
		expect(withdrawal).toContain("title: formatPageTitle(meta.title)");
	});
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
