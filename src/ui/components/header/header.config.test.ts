import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoriesFor, categoryHref } from "@/config/categories";
import { ALL_CATEGORIES_NAV, HEADER_PRIMARY_NAV, localizedNavHref } from "./header.config";

const HERE = join(__dirname);
const source = (file: string) => readFileSync(join(HERE, file), "utf8");

describe("category navigation lists", () => {
	it("lists every category the homepage grid shows, in the same order", () => {
		expect(ALL_CATEGORIES_NAV.map((item) => item.href)).toEqual(categoriesFor("home").map(categoryHref));
		// Never fewer categories than the desktop row holds: since the second pass the row links
		// all six, besides Značky and Poradňa.
		const categoryHrefs = new Set(ALL_CATEGORIES_NAV.map((item) => item.href));
		const rowCategories = HEADER_PRIMARY_NAV.filter((item) => categoryHrefs.has(item.href));
		expect(ALL_CATEGORIES_NAV.length).toBeGreaterThanOrEqual(rowCategories.length);
	});

	it("localizes a category link per market and leaves other links alone", () => {
		expect(localizedNavHref("sk-eur", "/stresne-nosice")).toBe("/stresne-nosice");
		expect(localizedNavHref("cz-czk", "/stresne-nosice")).toBe("/stresni-nosice");
		expect(localizedNavHref("sk-eur", "/poradna")).toBe("/poradna");
	});
});

/**
 * The regression this guards against shipped for six months: the mobile menu rendered
 * `HeaderPrimaryNav`, whose <nav> is `hidden lg:flex`, inside a sheet that only exists below
 * `lg`. The links were in the DOM with `display: none`, so the menu showed a search field and
 * nothing else on every phone. Nothing failed, because nothing looked.
 */
describe("the mobile menu", () => {
	it("does not reuse the desktop-only primary nav", () => {
		const mainRow = source("header-main-row.tsx");
		const menuBlock = mainRow.slice(mainRow.indexOf("<MobileMenu>"), mainRow.indexOf("</MobileMenu>"));
		expect(menuBlock).toContain("<HeaderMenuNav");
		expect(menuBlock).not.toContain("HeaderPrimaryNav");
	});

	it("renders its category list without a breakpoint that hides it", () => {
		const menuNav = source("header-menu-nav.tsx");
		expect(menuNav).not.toMatch(/className="[^"]*\bhidden\b/);
		expect(menuNav).toContain("ALL_CATEGORIES_NAV");
	});
});

describe("the Všetky kategórie button", () => {
	it("is a real menu trigger, not a bare button", () => {
		const trigger = source("all-categories-trigger.tsx");
		expect(trigger).toContain("DropdownMenuTrigger");
		expect(trigger).toContain("DropdownMenuContent");
		expect(source("header-nav-row.tsx")).toContain("items={allCategories}");
	});
});
