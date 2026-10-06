import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	CATEGORY_SLUGS,
	OTHER_CATEGORY_SLUGS,
	STOREFRONT_CATEGORIES,
	categoriesFor,
	categoryHref,
	categoryUrl,
	isCategorySlug,
} from "@/config/categories";
import { HEADER_PRIMARY_NAV } from "@/ui/components/header/header.config";
import { MARKET_ROOT_SEGMENTS } from "@/lib/routing.generated";

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

const SRC = new URL("..", import.meta.url).pathname;

/** Every `.ts`/`.tsx` under src/, excluding tests and this config itself. */
function sourceFiles(dir = SRC, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === "gql" || entry === "node_modules" || entry === "__fixtures__") continue;
			sourceFiles(full, out);
			continue;
		}
		if (!/\.tsx?$/.test(entry)) continue;
		if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
		if (full.endsWith("/config/categories.ts")) continue;
		out.push(full);
	}
	return out;
}

describe("storefront category catalogue", () => {
	it("has no duplicate slug and no duplicate key", () => {
		const slugs = STOREFRONT_CATEGORIES.map((c) => c.slug);
		const keys = STOREFRONT_CATEGORIES.map((c) => c.key);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every withheld category a reason", () => {
		for (const category of STOREFRONT_CATEGORIES) {
			if (category.surfaces.length === 0) {
				expect(category.withheldReason, `${category.slug} is withheld without a reason`).toBeTruthy();
			}
		}
	});

	it("surfaces at least one category in the nav and on the homepage", () => {
		expect(categoriesFor("nav").length).toBeGreaterThan(0);
		expect(categoriesFor("home").length).toBeGreaterThan(0);
	});

	it("names every surfaced category in all 12 locale files", () => {
		const surfaced = STOREFRONT_CATEGORIES.filter((c) => c.surfaces.length > 0);
		for (const locale of LOCALES) {
			const messages = JSON.parse(readFileSync(join(SRC, `i18n/messages/${locale}.json`), "utf8")) as {
				nav?: Record<string, string>;
			};
			for (const category of surfaced) {
				expect(messages.nav?.[category.key], `${locale} is missing nav.${category.key}`).toBeTruthy();
			}
		}
	});

	it("builds the header nav from the catalogue, not from hand-written hrefs", () => {
		const categoryHrefs = new Set(STOREFRONT_CATEGORIES.map(categoryHref));
		const navHrefs = HEADER_PRIMARY_NAV.filter((item) => categoryHrefs.has(item.href)).map(
			(item) => item.href,
		);
		expect(navHrefs).toEqual(categoriesFor("nav").map(categoryHref));
	});

	it("puts category URLs at the root, with no /categories/ segment", () => {
		for (const category of STOREFRONT_CATEGORIES) {
			expect(categoryHref(category)).toBe(`/${category.slug}`);
		}
		expect(HEADER_PRIMARY_NAV.some((item) => item.href.includes("/categories/"))).toBe(false);
	});

	/**
	 * Owner, 2026-10-06: no category URL carries `/categories/` — not the catalogue's 8 and not the
	 * accessory buckets, sub-categories and maker shelves behind them. The proxy tells a category from
	 * a product with `CATEGORY_SLUGS` and nothing else, so a slug missing from it falls back to
	 * `/categories/` and one that is only half-registered would answer at a root nothing routes.
	 */
	describe("every category Saleor holds", () => {
		it("is in the set the proxy resolves the root with, catalogue and other alike", () => {
			for (const category of STOREFRONT_CATEGORIES)
				expect(isCategorySlug(category.slug), category.slug).toBe(true);
			for (const slug of OTHER_CATEGORY_SLUGS) expect(isCategorySlug(slug), slug).toBe(true);
			expect(CATEGORY_SLUGS.size).toBe(STOREFRONT_CATEGORIES.length + OTHER_CATEGORY_SLUGS.length);
		});

		it("has its public URL at the root", () => {
			for (const slug of CATEGORY_SLUGS) expect(categoryUrl(slug), slug).toBe(`/${slug}`);
		});

		it("keeps a category this build does not know on its /categories/ URL until it is added", () => {
			expect(isCategorySlug("a-category-this-build-does-not-know")).toBe(false);
			expect(categoryUrl("a-category-this-build-does-not-know")).toBe(
				"/categories/a-category-this-build-does-not-know",
			);
		});

		it("is written once: no slug twice, none both in the catalogue and in the other list", () => {
			const all = [...STOREFRONT_CATEGORIES.map((category) => category.slug), ...OTHER_CATEGORY_SLUGS];
			expect(new Set(all).size).toBe(all.length);
		});

		it("is a plain lower-case slug, so a URL segment never needs encoding or escaping", () => {
			for (const slug of CATEGORY_SLUGS) expect(slug, slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		});
	});

	/**
	 * The root is a namespace shared with product slugs, and the proxy resolves it
	 * from this set alone — no upstream call. A category slug that collides with a
	 * real route segment would be shadowed by that route and unreachable, with
	 * nothing failing anywhere. `pnpm check:nav` covers the other half of the
	 * namespace, the 9,577 product slugs, which only Saleor knows.
	 */
	it("has no category slug that collides with a market root segment", () => {
		for (const slug of CATEGORY_SLUGS) {
			expect(MARKET_ROOT_SEGMENTS.has(slug), `${slug} is also a route`).toBe(false);
		}
	});

	/**
	 * The regression this whole file exists for.
	 *
	 * The homepage grid linked to `/categories/nosice-lyz` and the header nav to
	 * `/categories/nosice-lyzi`. Only the second is a category in Saleor, and because a
	 * category page answers HTTP 200 whether or not it resolves — streaming cannot set a
	 * 404 once the shell is flushed — the broken tile served 200 with a "Stránka
	 * nenájdená" body. No status-code check could see it. This one can: a category slug
	 * written anywhere in src/ other than the catalogue is a defect by construction.
	 */
	it("has no category slug hard-coded anywhere else in src/", () => {
		const known = CATEGORY_SLUGS;
		const offenders: string[] = [];

		for (const file of sourceFiles()) {
			const contents = readFileSync(file, "utf8");
			for (const [, slug] of contents.matchAll(/["'`]\/categories\/([a-z0-9-]+)["'`]/g)) {
				if (!known.has(slug)) offenders.push(`${file.replace(SRC, "src/")}: /categories/${slug}`);
			}
		}

		expect(offenders).toEqual([]);
	});
});
