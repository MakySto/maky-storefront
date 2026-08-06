import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	classifyRoute,
	describeGate,
	gateEnabledFor,
	isGateEnabled,
	lookupExistence,
	normalizePathname,
	resetRouteExistenceStateForTests,
	routeExistenceStats,
} from "./route-existence";

const ENV_KEYS = ["ROUTE_EXISTENCE_GATE", "ROUTE_EXISTENCE_MARKETS", "ROUTE_EXISTENCE_FAMILIES"];

/** A Saleor response shaped exactly like the real one. */
const saleor = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
	process.env.NEXT_PUBLIC_SALEOR_API_URL = "https://api.example/graphql/";
	resetRouteExistenceStateForTests();
});

afterEach(() => {
	for (const key of ENV_KEYS) delete process.env[key];
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("the gate ships off", () => {
	it("is off with no configuration at all", () => {
		expect(isGateEnabled()).toBe(false);
		expect(gateEnabledFor("sk", "product")).toBe(false);
	});

	it("stays off unless the kill switch is exactly `on`", () => {
		for (const value of ["true", "1", "yes", "ON", ""]) {
			process.env.ROUTE_EXISTENCE_GATE = value;
			expect(isGateEnabled(), value).toBe(false);
		}
	});

	it("treats an empty market or family list as none, never as all", () => {
		process.env.ROUTE_EXISTENCE_GATE = "on";
		expect(gateEnabledFor("sk", "product")).toBe(false);

		process.env.ROUTE_EXISTENCE_MARKETS = "sk";
		expect(gateEnabledFor("sk", "product")).toBe(false); // families still empty

		process.env.ROUTE_EXISTENCE_FAMILIES = "product";
		expect(gateEnabledFor("sk", "product")).toBe(true);
	});

	it("scopes by market and by family independently", () => {
		process.env.ROUTE_EXISTENCE_GATE = "on";
		process.env.ROUTE_EXISTENCE_MARKETS = "sk";
		process.env.ROUTE_EXISTENCE_FAMILIES = "product";

		expect(gateEnabledFor("sk", "product")).toBe(true);
		expect(gateEnabledFor("sk", "category")).toBe(false);
		expect(gateEnabledFor("de", "product")).toBe(false);
	});

	it("reports its configuration, ignoring names that are not real", () => {
		process.env.ROUTE_EXISTENCE_GATE = "on";
		process.env.ROUTE_EXISTENCE_MARKETS = "sk,gb";
		process.env.ROUTE_EXISTENCE_FAMILIES = "product,unicorn";
		expect(describeGate()).toEqual({ enabled: true, markets: ["sk"], families: ["product"] });
	});
});

describe("classification", () => {
	it("treats a bare market-relative slug as a product", () => {
		expect(classifyRoute("sk", ["sk", "stresny-box-thule"])).toEqual({
			family: "product",
			slug: "stresny-box-thule",
			channel: "sk-eur",
		});
	});

	it("NEVER classifies a real static route as a product", () => {
		// The check that stops the gate asking Saleor about "poradna" and taking a
		// live legal page off the site.
		for (const segment of ["poradna", "kontakt", "odstupenie-od-zmluvy", "cart", "search", "products"]) {
			expect(classifyRoute("sk", ["sk", segment]), segment).toBeNull();
		}
	});

	it("recognises the three prefixed families", () => {
		expect(classifyRoute("sk", ["sk", "categories", "stresne-boxy"])?.family).toBe("category");
		expect(classifyRoute("sk", ["sk", "collections", "zima"])?.family).toBe("collection");
		expect(classifyRoute("sk", ["sk", "pages", "o-firme"])?.family).toBe("saleor-page");
	});

	it("carries the Saleor channel, not the friendly market", () => {
		expect(classifyRoute("de", ["de", "some-slug"])?.channel).toBe("de-eur");
	});

	it("declines anything it does not recognise", () => {
		expect(classifyRoute("sk", ["sk"])).toBeNull();
		expect(classifyRoute("sk", ["sk", "categories"])).toBeNull();
		expect(classifyRoute("sk", ["sk", "account", "orders", "12"])).toBeNull();
		expect(classifyRoute("nope", ["nope", "x"])).toBeNull();
	});

	it("decodes a percent-encoded slug, as the page does", () => {
		expect(classifyRoute("sk", ["sk", "st%C3%B4l"])?.slug).toBe("stôl");
	});
});

describe("path normalization", () => {
	it("strips the suffixes Next appends for RSC and prefetch", () => {
		// One navigation invokes the proxy several times; keying on the raw path
		// would multiply the Saleor traffic.
		expect(normalizePathname("/sk/box.rsc")).toBe("/sk/box");
		expect(normalizePathname("/sk/box.json")).toBe("/sk/box");
		expect(normalizePathname("/sk/box/_segments/x.segment.rsc")).toBe("/sk/box");
		expect(normalizePathname("/sk/box/")).toBe("/sk/box");
		expect(normalizePathname("/sk/box")).toBe("/sk/box");
	});
});

describe("verdicts", () => {
	it("calls an explicit null absent", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => saleor({ data: { product: null } })));
		await expect(lookupExistence("product", "missing", "sk-eur")).resolves.toBe("absent");
	});

	it("calls a returned id exists", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => saleor({ data: { product: { id: "p1" } } })));
		await expect(lookupExistence("product", "real", "sk-eur")).resolves.toBe("exists");
	});

	it("never calls a fault absent", async () => {
		const faults: Array<() => Response | Promise<Response>> = [
			() => saleor({ data: { product: null } }, 500),
			() => saleor({ errors: [{ message: "boom" }] }),
			() => saleor({ data: { product: null }, errors: [{ message: "partial" }] }),
			() => saleor({ data: null }),
			() => saleor({ data: {} }),
			() => new Response("<html>nginx</html>", { status: 200 }),
			() => {
				throw new Error("ECONNRESET");
			},
		];

		for (const [i, fault] of faults.entries()) {
			resetRouteExistenceStateForTests();
			vi.stubGlobal("fetch", vi.fn(fault));
			await expect(lookupExistence("product", `slug-${i}`, "sk-eur"), `fault ${i}`).resolves.toBe("unknown");
		}
	});

	it("is unknown when the endpoint is not configured", async () => {
		delete process.env.NEXT_PUBLIC_SALEOR_API_URL;
		await expect(lookupExistence("product", "x", "sk-eur")).resolves.toBe("unknown");
	});

	it("falls back to the pre-migration slug before calling a product absent", async () => {
		// Ten products are reachable at their new canonical URL while Saleor still
		// holds the old slug. A gate that asked only about the new one would
		// hard-404 live products for the whole convergence window.
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as { variables: { s: string } };
			return body.variables.s.startsWith("598b-")
				? saleor({ data: { product: { id: "p" } } })
				: saleor({ data: { product: null } });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			lookupExistence("product", "nosic-bicykla-na-stresny-nosic-thule-proride-598-black-598b", "sk-eur"),
		).resolves.toBe("exists");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("asks the category without a channel — categories are global in Saleor", async () => {
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as { variables: Record<string, string> };
			expect(body.variables).toEqual({ s: "stresne-boxy" });
			return saleor({ data: { category: { id: "c" } } });
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(lookupExistence("category", "stresne-boxy", "sk-eur")).resolves.toBe("exists");
	});
});

describe("cache and load shedding", () => {
	it("asks once and serves the rest from memory", async () => {
		const fetchMock = vi.fn(async () => saleor({ data: { product: { id: "p" } } }));
		vi.stubGlobal("fetch", fetchMock);

		for (let i = 0; i < 5; i++) await lookupExistence("product", "same", "sk-eur");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keys per channel, so one market's answer never leaks into another", async () => {
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as { variables: { c?: string } };
			return body.variables.c === "sk-eur"
				? saleor({ data: { product: { id: "p" } } })
				: saleor({ data: { product: null } });
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(lookupExistence("product", "slug", "sk-eur")).resolves.toBe("exists");
		await expect(lookupExistence("product", "slug", "fr-eur")).resolves.toBe("absent");
	});

	it("expires a negative sooner than a positive", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => saleor({ data: { product: null } })));
		const t0 = 1_000_000;
		await lookupExistence("product", "gone", "sk-eur", t0);

		// 60 s negative TTL: still cached at 59 s, gone at 61 s.
		expect(routeExistenceStats().size).toBe(1);
		await expect(lookupExistence("product", "gone", "sk-eur", t0 + 59_000)).resolves.toBe("absent");
		await lookupExistence("product", "gone", "sk-eur", t0 + 61_000);
		// Re-asked rather than served stale — this is what lets a newly published
		// product start answering 200 without a rebuild.
		expect(routeExistenceStats().size).toBe(1);
	});

	it("collapses concurrent misses on one key into a single request", async () => {
		let resolveFetch: (r: Response) => void = () => {};
		const fetchMock = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const all = Promise.all([
			lookupExistence("product", "hot", "sk-eur"),
			lookupExistence("product", "hot", "sk-eur"),
			lookupExistence("product", "hot", "sk-eur"),
		]);
		resolveFetch(saleor({ data: { product: null } }));

		await expect(all).resolves.toEqual(["absent", "absent", "absent"]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("opens a breaker after a run of faults and stops asking", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("down");
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal("fetch", fetchMock);

		for (let i = 0; i < 5; i++) await lookupExistence("product", `s${i}`, "sk-eur");
		expect(routeExistenceStats().breakerOpen).toBe(true);

		const before = fetchMock.mock.calls.length;
		await expect(lookupExistence("product", "s99", "sk-eur")).resolves.toBe("unknown");
		expect(fetchMock.mock.calls.length, "no further upstream calls while open").toBe(before);
	});
});
