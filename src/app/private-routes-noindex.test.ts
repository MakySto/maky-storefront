import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Routes that must never rank, and must stay crawlable so they can be dropped.
 *
 * robots.ts cannot do this job. Three of its five Disallow entries are
 * market-less legacy — "/cart" does not match "/sk/cart", nor "/orders"
 * "/sk/orders", nor "/account" "/sk/account" — and the comment in robots.ts
 * records why they must not simply come back with a market wildcard: Google
 * already holds junk URLs from this site, and a URL a crawler is forbidden to
 * fetch can never be re-crawled and therefore never de-indexed. `noindex` is
 * the mechanism; the Disallow lines may only return once Search Console shows
 * the junk has dropped out.
 *
 * Measured on production before this was added, all three answered
 * `<meta name="robots" content="index, follow">` under HTTP 200 — including
 * /sk/orders, which does nothing but call redirect(), because cacheComponents
 * flushes the shell before the component runs.
 */
const ROUTES = [
	"[channel]/(main)/cart/page.tsx",
	// Covers the whole /account subtree: no child overrides `robots`.
	"[channel]/(main)/account/layout.tsx",
	"[channel]/(main)/orders/page.tsx",
	"[channel]/(main)/login/page.tsx",
	"[channel]/(main)/signup/page.tsx",
];

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), "src/app", rel), "utf8");

describe("private routes are noindex, follow", () => {
	it.each(ROUTES)("%s declares robots index:false", (rel) => {
		expect(read(rel)).toMatch(/robots:\s*\{\s*index:\s*false/);
	});

	it.each(ROUTES)("%s stays crawlable with follow:true", (rel) => {
		expect(read(rel)).toMatch(/index:\s*false,\s*follow:\s*true/);
	});

	it("no /account child quietly overrides the layout's robots", () => {
		const dir = path.join(process.cwd(), "src/app/[channel]/(main)/account");
		const overrides = fs
			.readdirSync(dir, { recursive: true, encoding: "utf8" })
			.filter((f) => f.endsWith(".tsx") && f !== "layout.tsx")
			.filter((f) => /robots:/.test(fs.readFileSync(path.join(dir, f), "utf8")));
		expect(overrides).toEqual([]);
	});
});
