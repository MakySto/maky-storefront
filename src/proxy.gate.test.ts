import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_PRODUCT_SLUG_REDIRECTS } from "./lib/product-redirects";
import { resetRouteExistenceStateForTests, routeExistenceStats } from "./lib/route-existence";
import { MARKET_ROOT_SEGMENTS } from "./lib/routing.generated";
import { proxy } from "./proxy";

/**
 * The proxy with the resource-existence gate ARMED.
 *
 * src/proxy.test.ts runs every one of its cases with the gate off, which is the
 * shipping configuration — but it meant the gate's integration into the proxy had
 * no coverage at all, and that is where the status codes are decided. The URIError
 * that made `/sk/%E0%A4%A` a 500 lived there and no unit test could have seen it.
 *
 * Two rules for everything below:
 *
 *   1. Assert the `x-maky-gate` header, not only the status. A 200 alone cannot
 *      tell "the gate said exists" from "the gate never ran".
 *   2. Assert the stub's call count. That is the only way to prove a *lookup* was
 *      skipped rather than merely producing the same answer.
 *
 * The endpoint is deliberately unroutable, so a test that forgets to stub `fetch`
 * fails instead of reaching the real Saleor.
 */

const ENDPOINT = "https://saleor.invalid/graphql/";

const ENV_KEYS = [
	"ROUTE_EXISTENCE_GATE",
	"ROUTE_EXISTENCE_MARKETS",
	"ROUTE_EXISTENCE_FAMILIES",
	"NEXT_PUBLIC_SALEOR_API_URL",
];

const req = (path: string) => new NextRequest(new URL(`https://maky.store${path}`));

/** A Saleor response shaped exactly like the real one. */
const saleor = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function arm({ markets = "sk", families = "product" } = {}) {
	process.env.ROUTE_EXISTENCE_GATE = "on";
	process.env.ROUTE_EXISTENCE_MARKETS = markets;
	process.env.ROUTE_EXISTENCE_FAMILIES = families;
}

type GraphQLBody = { query: string; variables: Record<string, string | undefined> };

const bodyOf = (init: RequestInit): GraphQLBody => JSON.parse(String(init.body)) as GraphQLBody;

/** Stub the upstream and hand back the mock, so every test can count the calls. */
function upstream(reply: (vars: Record<string, string | undefined>) => Response) {
	const mock = vi.fn(async (_url: string, init: RequestInit) => reply(bodyOf(init).variables));
	vi.stubGlobal("fetch", mock);
	return mock;
}

/** The GraphQL variables of the n-th upstream call. */
const varsOfCall = (mock: ReturnType<typeof upstream>, n = 0) => bodyOf(mock.mock.calls[n][1]).variables;

const exists = () => saleor({ data: { product: { id: "p1" } } });
const absent = () => saleor({ data: { product: null } });

beforeEach(() => {
	// The LRU, the breaker and the in-flight counter are module state. Without
	// this, one faulting test opens the breaker for every test after it.
	resetRouteExistenceStateForTests();
	process.env.NEXT_PUBLIC_SALEOR_API_URL = ENDPOINT;
	arm();
});

afterEach(() => {
	for (const key of ENV_KEYS) delete process.env[key];
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("an absent resource becomes a real 404", () => {
	it("404s a product the authority says is not there", async () => {
		const mock = upstream(absent);
		const res = await proxy(req("/sk/seo-canary-missing-product"));

		expect(res.status).toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("product:absent");
		expect(res.headers.get("x-robots-tag")).toBe("noindex");
		expect(res.headers.get("x-middleware-rewrite")).toMatch(/\/_not-found$/);
		expect(mock).toHaveBeenCalledTimes(1);
	});

	it("leaves a product that exists exactly as it was", async () => {
		const mock = upstream(exists);
		const res = await proxy(req("/sk/stresny-box-thule-force-3-xxl-sport-645300"));

		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("product:exists");
		expect(res.headers.get("x-channel")).toBe("sk-eur");
		expect(res.headers.get("set-cookie")).toContain("maky-market=sk");
		expect(mock).toHaveBeenCalledTimes(1);
	});
});

describe("an upstream that cannot answer fails OPEN", () => {
	// The whole safety argument. A Saleor blip must not become a field of 404s on
	// live, selling products.
	const faults: Array<[string, () => void]> = [
		["a 500", () => upstream(() => saleor({ data: { product: null } }, 500))],
		["GraphQL errors", () => upstream(() => saleor({ errors: [{ message: "boom" }] }))],
		[
			"malformed JSON",
			() =>
				vi.stubGlobal(
					"fetch",
					vi.fn(async () => new Response("<html>502</html>", { status: 200 })),
				),
		],
		[
			"a thrown request",
			() =>
				vi.stubGlobal(
					"fetch",
					vi.fn(async () => {
						throw new Error("aborted");
					}),
				),
		],
	];

	for (const [name, stub] of faults) {
		it(`serves 200, not 404, on ${name}`, async () => {
			stub();
			const res = await proxy(req(`/sk/produkt-pri-vypadku-${name.replace(/\W+/g, "-")}`));

			expect(res.status).not.toBe(404);
			expect(res.headers.get("x-maky-gate")).toBe("product:unknown");
			expect(res.headers.get("x-channel")).toBe("sk-eur");
		});
	}

	it("opens the breaker after repeated faults and stops calling upstream", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const mock = upstream(() => saleor({ errors: [{ message: "down" }] }));

		for (let i = 0; i < 6; i++) await proxy(req(`/sk/vypadok-${i}`));
		expect(routeExistenceStats().breakerOpen).toBe(true);

		const before = mock.mock.calls.length;
		const res = await proxy(req("/sk/vypadok-po-otvoreni-breakera"));
		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("product:unknown");
		expect(mock.mock.calls.length).toBe(before);
	});
});

describe("the flags decide whether a lookup happens at all", () => {
	it("does not look up a family that is not armed", async () => {
		arm({ families: "category" });
		const mock = upstream(absent);
		const res = await proxy(req("/sk/nejaky-produkt"));

		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("product:not-armed");
		expect(mock).not.toHaveBeenCalled();
	});

	it("does not look up a market that is not armed", async () => {
		const mock = upstream(absent);
		const res = await proxy(req("/de/nejaky-produkt"));

		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-channel")).toBe("de-eur");
		expect(res.headers.get("x-maky-gate")).toBe("product:not-armed");
		expect(mock).not.toHaveBeenCalled();
	});

	it("attaches no header and makes no call when the gate is off entirely", async () => {
		for (const key of ENV_KEYS.slice(0, 3)) delete process.env[key];
		const mock = upstream(absent);
		const res = await proxy(req("/sk/nejaky-produkt"));

		expect(res.status).not.toBe(404);
		expect(res.headers.get("x-maky-gate")).toBeNull();
		expect(mock).not.toHaveBeenCalled();
	});
});

describe("a malformed URL must not 500", () => {
	// `decodeURIComponent` throws URIError on these. The proxy runs before every
	// page, so an uncaught throw is a site-wide 500 for anyone who can type a URL.
	const malformed = ["/sk/%E0%A4%A", "/sk/%zz", "/sk/%", "/sk/categories/%E0%A4%A", "/sk/collections/%"];

	for (const path of malformed) {
		it(`serves ${path} without throwing`, async () => {
			const mock = upstream(absent);
			const res = await proxy(req(path));

			expect(res.status).not.toBe(500);
			expect(res.status).not.toBe(404);
			expect(res.headers.get("x-channel")).toBe("sk-eur");
			expect(mock).not.toHaveBeenCalled();
		});
	}

	it("still decodes a VALID escape and asks about the decoded slug", async () => {
		const mock = upstream(exists);
		const res = await proxy(req("/sk/100%25-bavlna"));

		expect(res.headers.get("x-maky-gate")).toBe("product:exists");
		expect(varsOfCall(mock).s).toBe("100%-bavlna");
	});
});

describe("real routes are never mistaken for products", () => {
	// The stub answers `absent`, so a classification regression 404s loudly here
	// rather than silently passing.
	for (const segment of [...MARKET_ROOT_SEGMENTS]) {
		it(`never asks Saleor about /sk/${segment}`, async () => {
			const mock = upstream(absent);
			const res = await proxy(req(`/sk/${segment}`));

			expect(res.status).not.toBe(404);
			expect(res.headers.get("x-maky-gate")).toBe("unclassified");
			expect(mock).not.toHaveBeenCalled();
		});
	}

	it("leaves the market root alone", async () => {
		const mock = upstream(absent);
		const res = await proxy(req("/sk"));

		expect(res.status).not.toBe(404);
		expect(mock).not.toHaveBeenCalled();
	});
});

describe("the migrated product slugs survive the gate", () => {
	// TAZAR pilot, migrated 2026-07-28. If the gate asked only about the new slug
	// and Saleor had not yet converged, arming it would 404 ten live products at
	// once. The fallback lives in the gate itself, ahead of the verdict.
	for (const [legacy, current] of Object.entries(LEGACY_PRODUCT_SLUG_REDIRECTS)) {
		it(`308s /sk/products/${legacy.slice(0, 24)}… without consulting the gate`, async () => {
			const mock = upstream(absent);
			const res = await proxy(req(`/sk/products/${legacy}`));

			expect(res.status).toBe(308);
			expect(res.headers.get("location")).toContain(`/sk/${current}`);
			expect(mock).not.toHaveBeenCalled();
		});

		it(`does not 404 /sk/${current.slice(0, 24)}… when only the pre-migration slug resolves`, async () => {
			const mock = upstream((vars) => (vars.s === current ? absent() : exists()));
			const res = await proxy(req(`/sk/${current}`));

			expect(res.status).not.toBe(404);
			expect(res.headers.get("x-maky-gate")).toBe("product:exists");
			expect(mock).toHaveBeenCalledTimes(2);
		});
	}
});

describe("earlier rules still win over the gate", () => {
	it("redirects a Saleor slug before any lookup", async () => {
		const mock = upstream(absent);
		const res = await proxy(req("/sk-eur/categories/stresne-boxy"));

		expect(res.status).toBe(301);
		expect(mock).not.toHaveBeenCalled();
	});

	it("404s a market-scoped route from policy, without a lookup", async () => {
		const mock = upstream(exists);
		const res = await proxy(req("/de/kontakt"));

		expect(res.status).toBe(404);
		expect(mock).not.toHaveBeenCalled();
	});
});

describe("RSC and prefetch suffixes are one logical lookup", () => {
	it("normalizes .rsc, .json and .segment.rsc onto the same cache key", async () => {
		const mock = upstream(exists);

		await proxy(req("/sk/some-box"));
		await proxy(req("/sk/some-box.rsc"));
		await proxy(req("/sk/some-box.json"));
		await proxy(req("/sk/some-box/_segments/x.segment.rsc"));

		expect(mock).toHaveBeenCalledTimes(1);
		expect(varsOfCall(mock).s).toBe("some-box");
		expect(routeExistenceStats().size).toBe(1);
	});
});

describe("category and collection families", () => {
	it("404s an absent category and asks the GLOBAL, channel-less question", async () => {
		arm({ families: "category" });
		const mock = upstream(() => saleor({ data: { category: null } }));
		const res = await proxy(req("/sk/categories/neexistujuca-kategoria"));

		expect(res.status).toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("category:absent");
		// A category empty in THIS channel is a merchandising state, not a 404.
		expect(varsOfCall(mock).c).toBeUndefined();
	});

	it("404s an absent collection, channel-scoped", async () => {
		arm({ families: "collection" });
		const mock = upstream(() => saleor({ data: { collection: null } }));
		const res = await proxy(req("/sk/collections/neexistujuca-kolekcia"));

		expect(res.status).toBe(404);
		expect(res.headers.get("x-maky-gate")).toBe("collection:absent");
		expect(varsOfCall(mock).c).toBe("sk-eur");
	});
});
