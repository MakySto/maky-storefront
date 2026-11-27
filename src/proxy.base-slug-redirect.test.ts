import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMarketSlugRedirectsForTests } from "./lib/market-slug-redirects";
import { resetRouteExistenceStateForTests } from "./lib/route-existence";
import { proxy } from "./proxy";

vi.mock("./lib/live-categories", () => ({ keepLiveCategoriesFresh: vi.fn() }));

/**
 * A foreign market serves a product at its Slovak (base) slug too, because the page asks the base
 * row first. On 2026-11-27 `/de/snehove-retaze-snowdrive-pilot-pro-xl-s-celnou-montazou-n16283`
 * answered 200, `index, follow`, with the German page and a German canonical. The proxy now sends
 * that address to the market's own slug, once, and only on proof.
 *
 * The endpoint is unroutable on purpose, so a case that forgets to stub `fetch` fails here.
 */

const ENDPOINT = "https://saleor.invalid/graphql/";
const SK = "snehove-retaze-snowdrive-pilot-pro-xl-s-celnou-montazou-n16283";
const DE = "schneeketten-snowdrive-pilot-pro-xl-mit-frontmontage-n16283";
const OTHER_SK = "snehove-retaze-snowdrive-pilot-pro-s-celnou-montazou-n16277";

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));
const saleor = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Row {
	/** The product's own (base) slug. */
	readonly base: string;
	/** Its slug in the market's language, or null when it has none. */
	readonly translated: string | null;
}

/**
 * Saleor as the two questions see it: `product(slug:)` matches the BASE row only, and
 * `product(slug:, slugLanguageCode:)` matches the translation row only.
 */
function saleorHolding(rows: readonly Row[]) {
	const calls: { query: string; variables: Record<string, string> }[] = [];
	const mock = vi.fn(async (_url: unknown, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, string> };
		calls.push(body);
		const { s, l } = body.variables;
		const identity = (row: Row) => ({
			id: "UHJvZHVjdDox",
			slug: row.base,
			externalReference: `cfm:product:${row.base}`,
		});
		if (body.query.includes("translation(languageCode")) {
			const row = rows.find((r) => r.base === s);
			return saleor({
				data: {
					product: row
						? { ...identity(row), translation: row.translated ? { slug: row.translated } : null }
						: null,
				},
			});
		}
		if (l) {
			const row = rows.find((r) => r.translated === s);
			return saleor({ data: { product: row ? identity(row) : null } });
		}
		const row = rows.find((r) => r.base === s);
		return saleor({ data: { product: row ? identity(row) : null } });
	});
	return Object.assign(mock, { calls });
}

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

describe("the Slovak slug in a foreign market", () => {
	it("goes to the market's own slug, once, permanently, keeping the query", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: DE }]));

		const res = await proxy(req(`/de/${SK}?variant=UHJvZHVjdFZhcmlhbnQ6MQ%3D%3D`));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(
			`https://maky.store/de/${DE}?variant=UHJvZHVjdFZhcmlhbnQ6MQ%3D%3D`,
		);
	});

	it("sends an in-app .rsc navigation to the plain replacement", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: DE }]));

		const res = await proxy(req(`/de/${SK}.rsc`));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(`https://maky.store/de/${DE}`);
	});

	it.each([
		["cz", "cz-czk", "CS"],
		["at", "at-eur", "DE_AT"],
		["pl", "pl-pln", "PL"],
		["us", "us-usd", "EN"],
		["ca", "ca-cad", "EN_CA"],
	])(
		"asks %s in its own channel and language, so US and CA are not forgotten",
		async (market, channel, code) => {
			const fetchMock = saleorHolding([{ base: SK, translated: "market-own-slug-n16283" }]);
			vi.stubGlobal("fetch", fetchMock);

			const res = await proxy(req(`/${market}/${SK}`));

			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe(`https://maky.store/${market}/market-own-slug-n16283`);
			expect(fetchMock.calls.every((c) => c.variables.c === channel && c.variables.l === code)).toBe(true);
		},
	);

	it("turns the retired /products/ shape into ONE redirect, straight to the market's own slug", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: DE }]));

		const res = await proxy(req(`/de/products/${SK}`));

		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(`https://maky.store/de/${DE}`);
	});

	it("asks Saleor once per slug, not once per request", async () => {
		const fetchMock = saleorHolding([{ base: SK, translated: DE }]);
		vi.stubGlobal("fetch", fetchMock);

		await proxy(req(`/de/${SK}`));
		const asked = fetchMock.mock.calls.length;
		await proxy(req(`/de/${SK}?utm_source=mail`));

		expect(fetchMock.mock.calls.length).toBe(asked);
	});
});

describe("what must stay as it is", () => {
	it("serves the market's own slug without redirecting, and cannot loop", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: DE }]));

		const res = await proxy(req(`/de/${DE}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("leaves a slug alone when translated and base are the same string (the five CoolZ in cz)", async () => {
		const same = "kompresorova-autochladnicka-pro-user-coolz-19l-tk20409";
		vi.stubGlobal("fetch", saleorHolding([{ base: same, translated: same }]));

		const res = await proxy(req(`/cz/${same}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("leaves a product alone that has no translated slug in this market", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: null }]));

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("does not touch Slovakia, whose slug IS the base row", async () => {
		const fetchMock = saleorHolding([{ base: SK, translated: DE }]);
		vi.stubGlobal("fetch", fetchMock);

		const res = await proxy(req(`/sk/${SK}`));

		expect(res.status).toBe(200);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a target that Saleor does not serve in this market", async () => {
		// The translation row names a slug the market's own lookup cannot find.
		const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, string> };
			if (body.query.includes("translation(languageCode")) {
				return saleor({
					data: {
						product: { id: "UHJvZHVjdDox", slug: SK, externalReference: "x", translation: { slug: DE } },
					},
				});
			}
			return saleor({ data: { product: null } });
		});
		vi.stubGlobal("fetch", fetchMock);

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("refuses a target that belongs to a different product", async () => {
		const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, string> };
			if (body.query.includes("translation(languageCode")) {
				return saleor({
					data: {
						product: { id: "UHJvZHVjdDox", slug: SK, externalReference: "x", translation: { slug: DE } },
					},
				});
			}
			return saleor({ data: { product: { id: "UHJvZHVjdDoy", slug: OTHER_SK, externalReference: "y" } } });
		});
		vi.stubGlobal("fetch", fetchMock);

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("refuses a translated slug that is not a clean URL segment", async () => {
		vi.stubGlobal("fetch", saleorHolding([{ base: SK, translated: "Schneeketten Pilot Pro" }]));

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("asks once in five minutes about a slug that is the market's own, which is every normal visit", async () => {
		const fetchMock = saleorHolding([{ base: SK, translated: DE }]);
		vi.stubGlobal("fetch", fetchMock);

		await proxy(req(`/de/${DE}`));
		await proxy(req(`/de/${DE}?variant=1`));

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not ask about a category root, the cart or the search page", async () => {
		const fetchMock = saleorHolding([]);
		vi.stubGlobal("fetch", fetchMock);

		for (const path of ["/de/warenkorb", "/de/dachtraeger", "/de/search", "/de/products"]) {
			expect((await proxy(req(path))).status, path).not.toBe(301);
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("leaves the request alone when Saleor does not answer", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("down", { status: 503 })),
		);

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});

	it("is off with MAKY_BASE_SLUG_REDIRECT=off", async () => {
		vi.stubEnv("MAKY_BASE_SLUG_REDIRECT", "off");
		const fetchMock = saleorHolding([{ base: SK, translated: DE }]);
		vi.stubGlobal("fetch", fetchMock);

		const res = await proxy(req(`/de/${SK}`));

		expect(res.status).toBe(200);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
