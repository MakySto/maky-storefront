import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

/**
 * `[channel]` used to accept any string, so /pilcicke-nohavice-…, /wishlist,
 * /admin and /products all rendered the storefront with 200 + index,follow — and
 * the rendered page then emitted category links under the same bogus prefix.
 * Google indexed the output. These tests pin the gate shut.
 */

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

const statusOf = (path: string) => proxy(req(path)).status;

describe("invalid first segment", () => {
	const junk = [
		"/pilcicke-nohavice-engelbert-strauss-kwf-profi",
		"/pilcicke-nohavice-engelbert-strauss-kwf-profi/categories/tazne-zariadenia",
		"/wishlist/categories/autochladnicky",
		"/admin/categories/stresne-nosice",
		"/admin/pages/privacy",
		"/products/signup",
		"/gb/login",
		"/neexistujuci-kanal",
		"/neexistujuci-kanal/categories/neexistujuca-kategoria",
	];

	for (const path of junk) {
		it(`404s ${path}`, () => {
			expect(statusOf(path)).toBe(404);
		});
	}

	it("marks the 404 noindex for good measure", () => {
		expect(proxy(req("/admin/categories/stresne-nosice")).headers.get("x-robots-tag")).toBe("noindex");
	});

	it("does not redirect junk anywhere — no generic /:invalid/categories/:slug rescue", () => {
		const res = proxy(req("/wishlist/categories/autochladnicky"));
		expect(res.headers.get("location")).toBeNull();
	});
});

describe("legitimate traffic still passes", () => {
	it("rewrites a valid market instead of 404ing it", () => {
		const res = proxy(req("/sk/categories/tazne-zariadenia"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-market")).toBe("sk");
	});

	it("keeps every configured market working", () => {
		for (const market of ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(statusOf(`/${market}`), market).not.toBe(404);
		}
	});

	it("leaves the market-less checkout routes alone", () => {
		expect(statusOf("/checkout")).not.toBe(404);
		expect(statusOf("/checkout/complete")).not.toBe(404);
	});

	it("does not touch reserved infrastructure prefixes", () => {
		for (const path of ["/api/revalidate", "/_next/whatever", "/.well-known/acme-challenge/token"]) {
			expect(statusOf(path), path).not.toBe(404);
		}
	});

	it("passes static assets and root metadata routes straight through", () => {
		// These used to be safe because the matcher skipped every dotted path. It
		// no longer does, so they have to survive the gate on their own.
		for (const path of [
			"/logo.svg",
			"/logo-dark.svg",
			"/logo-deer.webp",
			"/favicon-32x32.png",
			"/site.webmanifest",
			"/llms.txt",
			"/robots.txt",
			"/sitemap.xml",
			"/icon.png",
			"/apple-icon.png",
			"/opengraph-image.png",
			"/twitter-image.png",
			"/favicon.ico",
		]) {
			const res = proxy(req(path));
			expect(res.status, path).not.toBe(404);
			expect(res.headers.get("location"), path).toBeNull();
			expect(res.headers.get("x-middleware-rewrite"), path).toBeNull();
		}
	});
});

/**
 * The matcher used to exclude `.*\..*` — every path containing a dot anywhere —
 * so none of these ever reached the gate. They answered HTTP 200 with
 * `index, follow` and a self-canonical, and the rendered page emitted twelve more
 * crawlable links under the bogus prefix. Verified live on production
 * 2026-08-06 before the fix. On a domain migrated off WooCommerce this pointed
 * straight at the legacy /*.php inventory.
 */
describe("dotted first segment", () => {
	const junk = [
		"/does.not.exist",
		"/does.not.exist/categories/stresne-boxy",
		"/admin.php",
		"/wp-login.php",
		"/index.php",
		"/wp-content/uploads/2023/01/foo.jpg",
		"/sitemap_index.xml",
		"/wp-sitemap.xml",
	];

	for (const path of junk) {
		it(`404s ${path}`, () => {
			expect(statusOf(path)).toBe(404);
		});
	}

	it("marks them noindex", () => {
		expect(proxy(req("/admin.php")).headers.get("x-robots-tag")).toBe("noindex");
	});

	it("still rewrites a dotted slug UNDER a valid market instead of 404ing it", () => {
		// A dot below the market prefix is a product slug, not a bogus market. It
		// used to bypass the proxy entirely, so `[channel]` received "sk" instead
		// of "sk-eur" and the Saleor lookup missed for the wrong reason.
		const res = proxy(req("/sk/some.dotted-slug"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("sk-eur");
	});

	it("keeps client-side navigation working — RSC suffixes are not junk", () => {
		for (const path of ["/sk/categories/stresne-boxy.rsc", "/sk/stresny-box.rsc"]) {
			const res = proxy(req(path));
			expect(res.status, path).not.toBe(404);
			expect(res.headers.get("x-channel"), path).toBe("sk-eur");
		}
	});

	it("still 301s a raw Saleor slug to its friendly market", () => {
		const res = proxy(req("/sk-eur/categories/stresne-boxy"));
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toContain("/sk/categories/stresne-boxy");
	});

	it("still 308s a retired product URL", () => {
		const res = proxy(req("/sk/products/stresny-box-thule-motion-3-l-titan-glossy-639701"));
		expect(res.status).toBe(308);
	});

	it("still redirects the bare root to a market", () => {
		expect(proxy(req("/")).status).toBe(307);
	});
});
