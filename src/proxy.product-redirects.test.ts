import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setProductRedirectsForTests } from "./lib/catalog-content/product-redirects";
import { resetRouteExistenceStateForTests } from "./lib/route-existence";
import { proxy } from "./proxy";

vi.mock("./lib/live-categories", () => ({ keepLiveCategoriesFresh: vi.fn() }));

/**
 * CFM renames some Kargo products and folds others into one (2026-10-30). The table that says which is
 * data (`lib/catalog-content/product-redirects.json`); what is pinned here is the sequencing rule: the
 * redirect happens only when Saleor says the old slug is gone AND the new one exists, so the table can
 * be deployed before CFM writes the change, and nothing is moved until it has.
 *
 * The endpoint is unroutable on purpose, so a case that forgets to stub `fetch` fails here.
 */

const ENDPOINT = "https://saleor.invalid/graphql/";
const OLD = "stresny-nosic-nordrive-kargo-plus-pre-opel-vivaro-van-l2-h1-2014-2019-4xn10045-n30324";
const OLD_FOLDED = "stresny-nosic-nordrive-kargo-plus-pre-opel-vivaro-van-l2-h2-2014-2019-4xn10045-n30324";
const NEW = "stresny-nosic-nordrive-kargo-plus-pre-opel-vivaro-van-l2-2014-2019-4xn10045-n30324";

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

/** Saleor knows exactly these slugs; `product(slug:)` answers null for the rest. */
function saleorKnowing(slugs: readonly string[]) {
	return vi.fn(async (_url: unknown, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as { query: string; variables: { s: string } };
		const found = slugs.includes(body.variables.s);
		return new Response(
			JSON.stringify({ data: { product: found ? { id: "UHJvZHVjdDox", slug: body.variables.s } : null } }),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	});
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", ENDPOINT);
	resetRouteExistenceStateForTests();
	setProductRedirectsForTests({ sk: { [OLD]: NEW, [OLD_FOLDED]: NEW } });
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetRouteExistenceStateForTests();
	setProductRedirectsForTests(null);
});

describe("before CFM has written the change into Saleor", () => {
	it("keeps serving the old product while it still exists, and does not ask for more", async () => {
		vi.stubGlobal("fetch", saleorKnowing([OLD]));

		const res = await proxy(req(`/sk/${OLD}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("does not move anyone to a replacement that is not there yet", async () => {
		vi.stubGlobal("fetch", saleorKnowing([]));

		const res = await proxy(req(`/sk/${OLD}`));

		expect(res.headers.get("location")).toBeNull();
	});

	it("leaves the request alone when Saleor does not answer", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("down", { status: 503 })),
		);

		const res = await proxy(req(`/sk/${OLD}`));

		expect(res.headers.get("location")).toBeNull();
	});
});

describe("after CFM has renamed or folded the product", () => {
	it("sends the old address to the new one, once, permanently, keeping the query", async () => {
		vi.stubGlobal("fetch", saleorKnowing([NEW]));

		const res = await proxy(req(`/sk/${OLD}?utm_source=mail`));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(`https://maky.store/sk/${NEW}?utm_source=mail`);
	});

	it("sends every folded product to the one that remains", async () => {
		vi.stubGlobal("fetch", saleorKnowing([NEW]));

		for (const old of [OLD, OLD_FOLDED]) {
			const res = await proxy(req(`/sk/${old}`));
			expect(res.status, old).toBe(301);
			expect(res.headers.get("location"), old).toBe(`https://maky.store/sk/${NEW}`);
		}
	});

	it("sends an in-app .rsc navigation to the plain replacement", async () => {
		vi.stubGlobal("fetch", saleorKnowing([NEW]));

		const res = await proxy(req(`/sk/${OLD}.rsc`));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(`https://maky.store/sk/${NEW}`);
	});

	it("never redirects the replacement itself", async () => {
		vi.stubGlobal("fetch", saleorKnowing([NEW]));

		const res = await proxy(req(`/sk/${NEW}`));

		expect(res.headers.get("location")).toBeNull();
	});

	it("does not touch another market's address with the same slug", async () => {
		vi.stubGlobal("fetch", saleorKnowing([NEW]));

		const res = await proxy(req(`/cz/${OLD}`));

		expect(res.headers.get("location")).toBeNull();
	});
});
