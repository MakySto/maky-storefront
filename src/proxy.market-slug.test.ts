import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMarketSlugRedirectsForTests } from "./lib/market-slug-redirects";
import { resetRouteExistenceStateForTests } from "./lib/route-existence";
import { proxy } from "./proxy";

/**
 * PUBLIC_MARKET_URL_V2 — the old market URL, after CFM has replaced it.
 *
 * The rule under test is a sequencing rule, not a routing one: this support ships BEFORE CFM
 * swaps the slug in Saleor, and must do nothing until the swap has happened. So every case
 * asserts BOTH the response and how many times Saleor was asked — "no redirect" has to mean
 * "the old URL still serves", never "we redirected and the target 404s".
 *
 * The endpoint is unroutable on purpose: a case that forgets to stub `fetch` fails here
 * instead of reaching the real Saleor.
 */

const ENDPOINT = "https://saleor.invalid/graphql/";
const OLD =
	"dachtrager-nordrive-helio-silver-audi-80-avant-19911995-offene-dachreling-cfmp-b-nor-a51bec20924e7e-000000";
const NEW = "dachtrager-nordrive-helio-silver-audi-80-avant-1991-1995-offene-dachreling";
const CFM_ID = "CFMP-B-NOR-a51bec20924e7e-000000";

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const saleor = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** What Saleor answers for `product(slug:$s, channel:$c, slugLanguageCode:$l)`. */
function answerWith(product: { externalReference: string } | null) {
	return vi.fn(async (_url: unknown, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, string> };
		expect(body.query).toContain("slugLanguageCode");
		return saleor({ data: { product: product ? { id: "UHJvZHVjdDox", ...product } : null } });
	});
}

function deliverMap(entries: unknown[]) {
	const dir = mkdtempSync(join(tmpdir(), "maky-proxy-redirects-"));
	const path = join(dir, "MARKET_SLUG_REDIRECTS_apply.json");
	writeFileSync(path, JSON.stringify({ schema: "cfm.commerce2.market-slug-redirects/1", entries }));
	vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_PATH", path);
	resetMarketSlugRedirectsForTests();
}

const AT_ENTRY = { cfm_product_id: CFM_ID, language_code: "DE_AT", old_slug: OLD, new_slug: NEW };

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", ENDPOINT);
	resetRouteExistenceStateForTests();
	resetMarketSlugRedirectsForTests();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetRouteExistenceStateForTests();
	resetMarketSlugRedirectsForTests();
});

describe("before CFM swaps the slug in Saleor", () => {
	it("keeps serving the old URL — the target does not exist yet", async () => {
		deliverMap([AT_ENTRY]);
		const fetchMock = answerWith(null);
		vi.stubGlobal("fetch", fetchMock);

		const response = await proxy(req(`/at/${OLD}`));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("x-market")).toBe("at");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("asks about the NEW slug once per market, not once per request", async () => {
		deliverMap([AT_ENTRY]);
		const fetchMock = answerWith(null);
		vi.stubGlobal("fetch", fetchMock);

		await proxy(req(`/at/${OLD}`));
		await proxy(req(`/at/${OLD}?utm_source=mail`));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("after the swap", () => {
	it("sends the old URL to the new one, once, permanently, keeping the query", async () => {
		deliverMap([AT_ENTRY]);
		vi.stubGlobal("fetch", answerWith({ externalReference: `cfm:product:${CFM_ID}` }));

		const response = await proxy(req(`/at/${OLD}?utm_source=mail`));

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(`https://maky.store/at/${NEW}?utm_source=mail`);
	});

	it("sends an in-app .rsc navigation to the plain replacement", async () => {
		deliverMap([AT_ENTRY]);
		vi.stubGlobal("fetch", answerWith({ externalReference: `cfm:product:${CFM_ID}` }));

		const response = await proxy(req(`/at/${OLD}.rsc`));

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(`https://maky.store/at/${NEW}`);
	});

	it("never lands on the new URL twice: the replacement itself is not a source", async () => {
		deliverMap([AT_ENTRY]);
		const fetchMock = answerWith({ externalReference: `cfm:product:${CFM_ID}` });
		vi.stubGlobal("fetch", fetchMock);

		const response = await proxy(req(`/at/${NEW}`));

		expect(response.status).toBe(200);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("turns the retired /products/ URL into ONE redirect, straight to the new slug", async () => {
		deliverMap([AT_ENTRY]);
		vi.stubGlobal("fetch", answerWith({ externalReference: `cfm:product:${CFM_ID}` }));

		const response = await proxy(req(`/at/products/${OLD}`));

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(`https://maky.store/at/${NEW}`);
	});

	it("still answers the retired /products/ URL with 308 to the root form when nothing moved", async () => {
		deliverMap([AT_ENTRY]);
		vi.stubGlobal("fetch", answerWith(null));

		const response = await proxy(req(`/sk/products/stresny-nosic-nordrive-helio-silver`));

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe(
			"https://maky.store/sk/stresny-nosic-nordrive-helio-silver",
		);
	});
});

describe("what must never happen", () => {
	it("refuses to move anyone when the new slug belongs to a different product", async () => {
		deliverMap([AT_ENTRY]);
		const fetchMock = answerWith({ externalReference: "cfm:product:CFMP-B-NOR-999999999999-000000" });
		vi.stubGlobal("fetch", fetchMock);

		const response = await proxy(req(`/at/${OLD}`));

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("refuses to move anyone when the target carries no CFM identity at all", async () => {
		// Conservative on purpose: without an identity the redirect cannot be shown to lead to
		// the same product. Every cohort product carries one (500/500 sampled on 2026-09-20),
		// so this is a guard, not a behaviour anyone should meet.
		deliverMap([AT_ENTRY]);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => saleor({ data: { product: { id: "UHJvZHVjdDox", externalReference: null } } })),
		);

		expect((await proxy(req(`/at/${OLD}`))).status).toBe(200);
	});

	it("leaves the request alone when Saleor cannot answer", async () => {
		deliverMap([AT_ENTRY]);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => saleor({ errors: [{ message: "boom" }] }, 500)),
		);

		expect((await proxy(req(`/at/${OLD}`))).status).toBe(200);
	});

	it("touches nothing in Slovakia, and nothing when no map is delivered", async () => {
		const fetchMock = answerWith({ externalReference: `cfm:product:${CFM_ID}` });
		vi.stubGlobal("fetch", fetchMock);

		deliverMap([{ ...AT_ENTRY, language_code: "SK" }]);
		expect((await proxy(req(`/sk/${OLD}`))).status).toBe(200);

		resetMarketSlugRedirectsForTests();
		vi.stubEnv("MAKY_MARKET_SLUG_REDIRECTS_PATH", "");
		expect((await proxy(req(`/at/${OLD}`))).status).toBe(200);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not treat a market's own routes as products, whatever the map says", async () => {
		deliverMap([
			{ ...AT_ENTRY, old_slug: "warenkorb", new_slug: "warenkorb-neu" },
			{ ...AT_ENTRY, old_slug: "dachtraeger", new_slug: "dachtraeger-neu" },
			{ ...AT_ENTRY, old_slug: "search", new_slug: "suche" },
			{ ...AT_ENTRY, old_slug: "products", new_slug: "produkte" },
		]);
		const fetchMock = answerWith({ externalReference: `cfm:product:${CFM_ID}` });
		vi.stubGlobal("fetch", fetchMock);

		for (const path of ["/at/warenkorb", "/at/dachtraeger", "/at/search", "/at/products"]) {
			const response = await proxy(req(path));
			expect(response.status, path).not.toBe(301);
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
