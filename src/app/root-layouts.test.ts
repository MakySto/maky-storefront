import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The two root layouts, and why the app has two of them.
 *
 * `<html lang>` can only be emitted by a root layout, and a root layout at `app/` has no
 * `params` — `[channel]` sits below it — so a single root could name only one language for
 * all twelve markets. It named `sk`: measured on production 2026-09-20, `/at`, `/cz` and
 * `/us` were served `lang="sk"` and were corrected to `de`, `cs` and `en` only after
 * hydration, which never happens for a client that does not run JavaScript.
 *
 * Structure, not behaviour, because the behaviour only appears in a real build — and every
 * line below is something a plausible refactor breaks silently:
 *
 *   - re-adding `app/layout.tsx` makes it the single root again and quietly takes the lang
 *     with it;
 *   - moving `not-found.tsx` into a group hands unmatched URLs back to Next's own built-in
 *     "404: This page could not be found", unbranded and unstyled;
 *   - letting `not-found.tsx` render `DocumentShell` nests `<html>` inside `<body>`, which
 *     survives only because the HTML parser hoists the attributes back out;
 *   - dropping its `globals.css` import serves a correct 404 with no stylesheet at all.
 */
const app = (rel: string) => path.join(process.cwd(), "src/app", rel);
const read = (rel: string) => fs.readFileSync(app(rel), "utf8");
const exists = (rel: string) => fs.existsSync(app(rel));

describe("the app has exactly two root layouts", () => {
	it("has no single root layout at app/", () => {
		expect(exists("layout.tsx")).toBe(false);
	});

	it("gives the market segment its own root, so lang comes from the route", () => {
		const src = read("[channel]/layout.tsx");
		expect(src).toMatch(/<DocumentShell lang=\{LOCALE_MAP\[locale\]\?\.locale \?\? locale\}>/);
		// The FULL locale, in the JSX and not merely in a comment — `htmlLang` is two
		// letters, so Austria and Germany both claimed "de" and the US and Canada "en".
		expect(src).not.toMatch(/lang=\{[^}]*htmlLang/);
	});

	it("gives everything without a market the other root", () => {
		const src = read("(site)/layout.tsx");
		expect(src).toMatch(/<DocumentShell lang=\{LOCALE_MAP\[DEFAULT_LOCALE\]\.locale\}>/);
	});

	it("keeps `/` and the checkout inside that root, not at app/", () => {
		expect(exists("(site)/page.tsx")).toBe(true);
		expect(exists("(site)/checkout/page.tsx")).toBe(true);
		expect(exists("page.tsx")).toBe(false);
		expect(exists("checkout/page.tsx")).toBe(false);
	});

	it("both roots share one document, so the consent defaults cannot drift apart", () => {
		for (const rel of ["(site)/layout.tsx", "[channel]/layout.tsx"]) {
			expect(read(rel), rel).toMatch(/from "@\/ui\/components\/document-shell"/);
		}
		const shell = fs.readFileSync(path.join(process.cwd(), "src/ui/components/document-shell.tsx"), "utf8");
		expect(shell).toMatch(/maky-consent-default/);
		expect(shell).toMatch(/maky-gtm/);
		expect(shell).toMatch(/cf-web-analytics/);
	});
});

describe("the unmatched-URL 404 stays at the app root", () => {
	it("is not inside a route group", () => {
		// `/_not-found` is what src/proxy.ts rewrites junk to, in three places.
		expect(exists("not-found.tsx")).toBe(true);
		expect(exists("(site)/not-found.tsx")).toBe(false);
	});

	it("brings its own stylesheet, having no layout to inherit one from", () => {
		expect(read("not-found.tsx")).toMatch(/import "\.\/globals\.css"/);
	});

	it("does not render a second document inside Next's wrapper", () => {
		expect(read("not-found.tsx")).not.toMatch(/DocumentShell/);
	});
});
