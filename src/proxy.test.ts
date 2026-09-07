import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "./proxy";

/**
 * `[channel]` used to accept any string, so /pilcicke-nohavice-…, /wishlist,
 * /admin and /products all rendered the storefront with 200 + index,follow — and
 * the rendered page then emitted category links under the same bogus prefix.
 * Google indexed the output. These tests pin the gate shut.
 */

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

const statusOf = async (path: string) => (await proxy(req(path))).status;

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
		it(`404s ${path}`, async () => {
			expect(await statusOf(path)).toBe(404);
		});
	}

	it("marks the 404 noindex for good measure", async () => {
		expect((await proxy(req("/admin/categories/stresne-nosice"))).headers.get("x-robots-tag")).toBe(
			"noindex",
		);
	});

	it("does not redirect junk anywhere — no generic /:invalid/categories/:slug rescue", async () => {
		const res = await proxy(req("/wishlist/categories/autochladnicky"));
		expect(res.headers.get("location")).toBeNull();
	});
});

describe("legitimate traffic still passes", () => {
	it("rewrites a valid market instead of 404ing it", async () => {
		const res = await proxy(req("/sk/tazne-zariadenia"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-market")).toBe("sk");
	});

	it("keeps every configured market working", async () => {
		for (const market of ["sk", "cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			expect(await statusOf(`/${market}`), market).not.toBe(404);
		}
	});

	it("leaves the market-less checkout routes alone", async () => {
		expect(await statusOf("/checkout")).not.toBe(404);
		expect(await statusOf("/checkout/complete")).not.toBe(404);
	});

	it("does not touch reserved infrastructure prefixes", async () => {
		for (const path of ["/api/revalidate", "/_next/whatever", "/.well-known/acme-challenge/token"]) {
			expect(await statusOf(path), path).not.toBe(404);
		}
	});

	it("passes static assets and root metadata routes straight through", async () => {
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
			const res = await proxy(req(path));
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
		it(`404s ${path}`, async () => {
			expect(await statusOf(path)).toBe(404);
		});
	}

	it("marks them noindex", async () => {
		expect((await proxy(req("/admin.php"))).headers.get("x-robots-tag")).toBe("noindex");
	});

	it("still rewrites a dotted slug UNDER a valid market instead of 404ing it", async () => {
		// A dot below the market prefix is a product slug, not a bogus market. It
		// used to bypass the proxy entirely, so `[channel]` received "sk" instead
		// of "sk-eur" and the Saleor lookup missed for the wrong reason.
		const res = await proxy(req("/sk/some.dotted-slug"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("sk-eur");
	});

	it("keeps client-side navigation working — RSC suffixes are not junk", async () => {
		for (const path of ["/sk/stresne-boxy.rsc", "/sk/stresny-box.rsc"]) {
			const res = await proxy(req(path));
			expect(res.status, path).not.toBe(404);
			expect(res.headers.get("x-channel"), path).toBe("sk-eur");
		}
	});

	it("still 301s a raw Saleor slug to its friendly market", async () => {
		const res = await proxy(req("/sk-eur/stresne-boxy"));
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toContain("/sk/stresne-boxy");
	});

	it("308s a retired category URL to the root", async () => {
		const res = await proxy(req("/sk/categories/stresne-boxy"));
		expect(res.status).toBe(308);
		expect(res.headers.get("location")).toContain("/sk/stresne-boxy");
	});

	it("leaves a NON-catalogue category on its /categories/ URL", async () => {
		// Saleor holds 30 categories; src/config/categories.ts names 8. The root
		// namespace is resolved from that build-time set with no upstream call, so a
		// slug it does not know soft-404s at the root. Redirecting this one would turn
		// a working accessory listing into a 404 for the sake of a tidier path — and
		// the sitemap and every product breadcrumb would follow it there.
		const res = await proxy(req("/sk/categories/prislusenstvo-k-stresnym-boxom"));
		expect(res.status).not.toBe(308);
		expect(res.headers.get("x-channel")).toBe("sk-eur");
		expect(res.headers.get("x-middleware-rewrite")).toContain(
			"/sk-eur/categories/prislusenstvo-k-stresnym-boxom",
		);
	});

	it("carries a root category onto its route file, keeping the public URL", async () => {
		const res = await proxy(req("/sk/stresne-boxy"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("sk-eur");
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/categories/stresne-boxy");
	});

	it("carries the RSC suffix into the category rewrite", async () => {
		// The decision is made on the normalized path, the rewrite keeps the raw one.
		// Match the raw segment against the catalogue and "stresne-boxy.rsc" is not a
		// category, so every in-app navigation into a category would fall through to
		// the product route while the first full-page load looked perfect.
		const res = await proxy(req("/sk/stresne-boxy.rsc"));
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/categories/stresne-boxy.rsc");
	});

	it("does not claim a root slug that is not a category", async () => {
		const res = await proxy(req("/sk/stresny-box-thule-motion-3"));
		expect(res.headers.get("x-middleware-rewrite")).toContain("/sk-eur/stresny-box-thule-motion-3");
		expect(res.headers.get("x-middleware-rewrite")).not.toContain("/categories/");
	});

	it("still 308s a retired product URL", async () => {
		const res = await proxy(req("/sk/products/stresny-box-thule-motion-3-l-titan-glossy-639701"));
		expect(res.status).toBe(308);
	});

	it("still redirects the bare root to a market", async () => {
		expect((await proxy(req("/"))).status).toBe(307);
	});
});

/**
 * The seven Slovak legal pages and the two CMS pages exist only for `sk` — each
 * calls notFound() for another channel — but `export const metadata` on them has
 * no such branch, so /de/kontakt answered HTTP 200 with a fully indexable Slovak
 * <head> over a 404-ed body.
 */
describe("a route that exists, but not in this market", () => {
	const SK_ONLY = [
		"kontakt",
		"obchodne-podmienky",
		"odstupenie-od-zmluvy",
		"reklamacie-a-vratenie",
		"ochrana-osobnych-udajov",
		"cookies",
		"doprava-a-platba",
		"o-nas",
		"poradna",
	];

	it("404s the Slovak-only pages under every other market", async () => {
		for (const segment of SK_ONLY) {
			for (const market of ["de", "cz", "fr", "us", "ca"]) {
				expect(await statusOf(`/${market}/${segment}`), `/${market}/${segment}`).toBe(404);
			}
		}
	});

	it("marks them noindex", async () => {
		expect((await proxy(req("/de/kontakt"))).headers.get("x-robots-tag")).toBe("noindex");
	});

	it("leaves them alone on sk", async () => {
		for (const segment of SK_ONLY) {
			const res = await proxy(req(`/sk/${segment}`));
			expect(res.status, `/sk/${segment}`).not.toBe(404);
			expect(res.headers.get("x-channel"), `/sk/${segment}`).toBe("sk-eur");
		}
	});

	it("does not touch routes that exist everywhere", async () => {
		for (const segment of ["products", "stresne-boxy", "cart", "search"]) {
			expect(await statusOf(`/de/${segment}`), `/de/${segment}`).not.toBe(404);
		}
	});

	it("does not mistake a product slug for a missing route", async () => {
		// A slug that is not a declared route belongs to the existence gate, which
		// is not enabled yet — it must pass through, not 404 on a static guess.
		const res = await proxy(req("/de/stresny-box-thule-motion-3"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("de-eur");
	});
});

/**
 * The `noindex` for a market that is not live lives here rather than in
 * generateMetadata, because metadata is baked into the prerendered shell under
 * cacheComponents and therefore cannot follow an env var. Measured 2026-08-06 on
 * a production build: with MAKY_LIVE_MARKETS="sk,cz" the sitemap picked cz up on
 * the next request while /cz kept serving the noindex from build time.
 */
describe("preview markets are not indexable", () => {
	const ENV = "MAKY_LIVE_MARKETS";
	afterEach(() => delete process.env[ENV]);

	const robotsFor = async (path: string) => (await proxy(req(path))).headers.get("x-robots-tag");

	it("does not mark the live market", async () => {
		expect(await robotsFor("/sk")).toBeNull();
		expect(await robotsFor("/sk/stresne-boxy")).toBeNull();
	});

	it("marks every other market, on every route under it", async () => {
		for (const market of ["cz", "de", "at", "pl", "hu", "it", "fr", "es", "ro", "us", "ca"]) {
			for (const path of ["", "/products", "/stresne-boxy", "/some-product"]) {
				expect(await robotsFor(`/${market}${path}`), `/${market}${path}`).toBe("noindex, nofollow");
			}
		}
	});

	it("follows the env override without a rebuild", async () => {
		process.env[ENV] = "sk,cz";
		expect(await robotsFor("/cz")).toBeNull();
		expect(await robotsFor("/de")).toBe("noindex, nofollow");
	});

	it("keeps the channel rewrite intact for a preview market", async () => {
		// Preview means "not indexable", not "broken". The market has to work.
		const res = await proxy(req("/de/stresne-boxy"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("de-eur");
		expect(res.headers.get("x-market")).toBe("de");
	});
});

/**
 * A preview market is a direct-access QA surface, not a destination we send
 * people to. Without this, a visitor from Germany opening https://maky.store/
 * would land in an unfinished storefront the moment that channel exists in
 * Saleor — no catalogue, no translated legal pages, no working payment.
 */
describe("root detection only ever chooses a live market", () => {
	const ENV = "MAKY_LIVE_MARKETS";
	afterEach(() => delete process.env[ENV]);

	const rootWith = async (headers: Record<string, string>, cookie?: string) => {
		const r = new NextRequest(new URL("https://maky.store/"), { headers: new Headers(headers) });
		if (cookie) r.cookies.set("maky-market", cookie);
		return proxy(r);
	};
	const target = (res: Response) => new URL(res.headers.get("location") ?? "https://x/").pathname;

	it("ignores a geo header pointing at a preview market", async () => {
		expect(target(await rootWith({ "CF-IPCountry": "DE" }))).toBe("/sk");
		expect(target(await rootWith({ "CF-IPCountry": "FR" }))).toBe("/sk");
	});

	it("ignores an Accept-Language pointing at a preview market", async () => {
		expect(target(await rootWith({ "Accept-Language": "de-DE,de;q=0.9" }))).toBe("/sk");
		expect(target(await rootWith({ "Accept-Language": "cs-CZ,cs;q=0.9" }))).toBe("/sk");
	});

	it("ignores a cookie pointing at a preview market", async () => {
		// One QA visit to /de must not pin that browser to it.
		expect(target(await rootWith({}, "de"))).toBe("/sk");
	});

	it("honours all three once the market is live", async () => {
		process.env[ENV] = "sk,de";
		expect(target(await rootWith({ "CF-IPCountry": "DE" }))).toBe("/de");
		expect(target(await rootWith({ "Accept-Language": "de-DE,de;q=0.9" }))).toBe("/de");
		expect(target(await rootWith({}, "de"))).toBe("/de");
	});

	it("still prefers the live market a visitor actually chose", async () => {
		process.env[ENV] = "sk,cz";
		expect(target(await rootWith({ "CF-IPCountry": "DE" }, "cz"))).toBe("/cz");
	});

	it("does not persist a preview market as a year-long cookie", async () => {
		// It is read outside the proxy too — the checkout locale fallback uses it.
		const preview = await proxy(req("/de/stresne-boxy"));
		expect(preview.cookies.get("maky-market")).toBeUndefined();

		const live = await proxy(req("/sk/stresne-boxy"));
		expect(live.cookies.get("maky-market")?.value).toBe("sk");
	});
});
