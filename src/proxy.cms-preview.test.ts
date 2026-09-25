import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { CHANNEL_MAP } from "./lib/channel-map";
import { proxy } from "./proxy";

/**
 * The proxy's one concession to a CMS draft preview (`preview-v1.md`, „Budúce trhy“): with
 * BOTH Next's Draft Mode cookie and `maky-cms-preview`, a CMS route renders in every one of
 * the twelve markets — live or not, in the route policy or not — as `noindex, nofollow` and
 * `private, no-store`. Without both, nothing differs from before; and nothing is ever opened.
 */

const CMS_SLUGS = ["o-nas", "poradna"] as const;
const MARKETS = Object.keys(CHANNEL_MAP);

const BOTH = "__prerender_bypass=fake-draft-id; maky-cms-preview=fake-preview-token.FAKE-SIGNATURE";

const request = (path: string, cookie?: string) =>
	new NextRequest(new URL(`https://maky.store${path}`), cookie ? { headers: { cookie } } : undefined);

const ENV = "MAKY_LIVE_MARKETS";
afterEach(() => delete process.env[ENV]);

describe("proxy — CMS routes inside a preview session", () => {
	it("covers the twelve markets", () => {
		expect(MARKETS).toHaveLength(12);
	});

	for (const market of MARKETS) {
		for (const slug of CMS_SLUGS) {
			it(`/${market}/${slug} renders, uncached and unindexed`, async () => {
				const res = await proxy(request(`/${market}/${slug}`, BOTH));
				expect(res.status).not.toBe(404);
				expect(res.headers.get("x-middleware-rewrite")).toContain(
					`/${CHANNEL_MAP[market]!.saleorSlug}/${slug}`,
				);
				expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
				expect(res.headers.get("cache-control")).toBe("private, no-store");
			});
		}
	}

	it("keeps Next's client-navigation form working", async () => {
		const res = await proxy(request("/cz/o-nas.rsc", BOTH));
		expect(res.headers.get("x-middleware-rewrite")).toContain("/cz-czk/o-nas.rsc");
		expect(res.headers.get("cache-control")).toBe("private, no-store");
	});

	it("opens nothing: a market that is not live stays unremembered", async () => {
		for (const market of MARKETS.filter((m) => m !== "sk")) {
			const res = await proxy(request(`/${market}/o-nas`, BOTH));
			expect(
				res.headers.getSetCookie().some((c) => c.startsWith("maky-market=")),
				market,
			).toBe(false);
		}
	});
});

describe("proxy — without both cookies nothing changes", () => {
	const ONE_OR_NONE = [
		["no cookies", undefined],
		["only Draft Mode", "__prerender_bypass=fake-draft-id"],
		["only the preview token", "maky-cms-preview=fake-preview-token.FAKE-SIGNATURE"],
		["an empty preview token", "__prerender_bypass=fake-draft-id; maky-cms-preview="],
	] as const;

	for (const [label, cookie] of ONE_OR_NONE) {
		it(`${label}: sk serves them, the other eleven 404`, async () => {
			for (const slug of CMS_SLUGS) {
				const sk = await proxy(request(`/sk/${slug}`, cookie));
				expect(sk.status, `/sk/${slug}`).not.toBe(404);
				expect(sk.headers.get("x-robots-tag"), `/sk/${slug}`).toBeNull();
				expect(sk.headers.get("cache-control"), `/sk/${slug}`).toBeNull();

				for (const market of MARKETS.filter((m) => m !== "sk")) {
					const res = await proxy(request(`/${market}/${slug}`, cookie));
					expect(res.status, `/${market}/${slug}`).toBe(404);
					expect(res.headers.get("x-robots-tag"), `/${market}/${slug}`).toBe("noindex");
				}
			}
		});
	}

	it("a market going live changes the public answer, not the preview rule", async () => {
		process.env[ENV] = "sk,cz";
		// Live, but the route policy still offers o-nas in sk only.
		expect((await proxy(request("/cz/o-nas"))).status).toBe(404);
		expect((await proxy(request("/cz/o-nas", BOTH))).status).not.toBe(404);
	});
});

describe("proxy — the preview door is exactly the CMS routes", () => {
	it("leaves every other route of a market as it was", async () => {
		for (const path of ["/cz/kontakt", "/cz/stresne-boxy", "/cz/some-product", "/cz/kosik", "/de/search"]) {
			const plain = await proxy(request(path));
			const inPreview = await proxy(request(path, BOTH));
			expect(inPreview.status, path).toBe(plain.status);
			expect(inPreview.headers.get("x-robots-tag"), path).toBe(plain.headers.get("x-robots-tag"));
			expect(inPreview.headers.get("cache-control"), path).toBeNull();
		}
	});

	it("does not open anything below a CMS route", async () => {
		expect((await proxy(request("/cz/o-nas/anything", BOTH))).status).toBe(404);
	});

	it("does not reach the checkout", async () => {
		const res = await proxy(request("/checkout", BOTH));
		expect(res.headers.get("cache-control")).toBeNull();
		expect(res.headers.get("x-middleware-rewrite")).toBeNull();
	});
});
