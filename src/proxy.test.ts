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
