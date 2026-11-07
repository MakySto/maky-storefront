import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { LEGACY_ROOT_REDIRECTS } from "./lib/legacy-root-redirects";
import { proxy } from "./proxy";

vi.mock("./lib/live-categories", () => ({ keepLiveCategoriesFresh: vi.fn() }));

/**
 * Bing Webmaster Tools lists old products of the WooCommerce shop among the indexed pages
 * (2026-11-07) and the root gate answered 404 for them, with the current product one click away. The
 * table in `lib/legacy-root-redirects.ts` is the explicit exit in front of that gate; what is pinned
 * here is that the exit works, is permanent and single, and that the gate behind it is untouched.
 */

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

describe("an old root address that has a current product", () => {
	it("is answered with one permanent redirect to it", async () => {
		const res = await proxy(req("/nosic-bicyklov-thule-epos-2-978100"));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(
			"https://maky.store/sk/nosic-bicyklov-thule-epos-2-978-th978100",
		);
	});

	it("keeps the query string and accepts the trailing slash the old shop used", async () => {
		const res = await proxy(req("/nosic-bicyklov-thule-epos-2-978100/?utm_source=heureka"));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(
			"https://maky.store/sk/nosic-bicyklov-thule-epos-2-978-th978100?utm_source=heureka",
		);
	});

	it("is answered for every entry of the table, and each target is not itself redirected", async () => {
		for (const [from, to] of Object.entries(LEGACY_ROOT_REDIRECTS)) {
			const res = await proxy(req(`/${from}`));
			expect(res.status, from).toBe(301);
			expect(res.headers.get("location"), from).toBe(`https://maky.store${to}`);

			const target = await proxy(req(to));
			expect(target.headers.get("location"), to).toBeNull();
		}
	});

	it("does not touch the same slug under a market", async () => {
		const res = await proxy(req("/sk/nosic-bicyklov-thule-epos-2-978100"));

		expect(res.headers.get("location")).toBeNull();
	});
});

describe("the root gate behind it", () => {
	it.each([
		// The Spinder TX2 of the old shop was S30005; the catalogue's S30011 is another code.
		"/nosic-bicyklov-na-tazne-zariadenie-spinder-tx2-s30005",
		"/pilcicke-nohavice-engelbert-strauss-kwf-profi",
		"/nosic-bicyklov-thule-epos-2-978100/extra",
	])("still answers %s with a real 404, noindex and no redirect", async (path) => {
		const res = await proxy(req(path));

		expect(res.status).toBe(404);
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
		expect(res.headers.get("location")).toBeNull();
	});
});
