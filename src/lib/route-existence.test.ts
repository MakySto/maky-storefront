import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	classifyRoute,
	describeGate,
	forgetProductExistence,
	gateEnabledFor,
	isGateEnabled,
	lookupExistence,
	lookupTranslatedProduct,
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

/**
 * The Slovak rollout set: `sk` × {product, category}.
 *
 * These are the two families the 9 192-product catalogue routes to — /sk/{slug}
 * and /sk/categories/{slug} — and the pair is a deliberate unit. Arming products
 * alone leaves every mistyped category answering HTTP 200 with a full navigation
 * on it, which is the shape that got junk indexed in the first place.
 *
 * Nothing here turns the gate on. It ships inert and is armed from the
 * environment; this only pins that the configuration the runbook prescribes is
 * the configuration the code honours, and that arming Slovakia arms nobody else.
 */
describe("the sk product + category rollout set", () => {
	function arm(markets: string, families: string) {
		process.env.ROUTE_EXISTENCE_GATE = "on";
		process.env.ROUTE_EXISTENCE_MARKETS = markets;
		process.env.ROUTE_EXISTENCE_FAMILIES = families;
	}

	it("arms both Slovak families from one family list", () => {
		arm("sk", "product,category");

		expect(gateEnabledFor("sk", "product")).toBe(true);
		expect(gateEnabledFor("sk", "category")).toBe(true);
		expect(describeGate()).toEqual({ enabled: true, markets: ["sk"], families: ["product", "category"] });
	});

	it("leaves the families nobody asked for alone", () => {
		arm("sk", "product,category");

		expect(gateEnabledFor("sk", "collection")).toBe(false);
		expect(gateEnabledFor("sk", "saleor-page")).toBe(false);
	});

	it("does not leak into another market", () => {
		arm("sk", "product,category");

		for (const market of ["cz", "de", "pl", "us"]) {
			expect(gateEnabledFor(market, "product"), market).toBe(false);
			expect(gateEnabledFor(market, "category"), market).toBe(false);
		}
	});

	it("classifies both Slovak shapes to the family that was armed", () => {
		// The URLs the gate will actually see. /sk/{slug} is the canonical product
		// form — /sk/products/{slug} has 308'd to it since 62657e7.
		expect(classifyRoute("sk", ["sk", "nosic-bicyklov-thule-proride"])).toEqual({
			family: "product",
			slug: "nosic-bicyklov-thule-proride",
			channel: "sk-eur",
		});
		expect(classifyRoute("sk", ["sk", "categories", "stresne-boxy"])).toEqual({
			family: "category",
			slug: "stresne-boxy",
			channel: "sk-eur",
		});
	});

	it("404s only on positive proof of absence, for either family", async () => {
		arm("sk", "product,category");

		for (const family of ["product", "category"] as const) {
			resetRouteExistenceStateForTests();
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => saleor({ data: { [family]: null } })),
			);
			await expect(lookupExistence(family, "nie-je-tu", "sk-eur"), family).resolves.toBe("absent");

			resetRouteExistenceStateForTests();
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => saleor({ errors: [{ message: "boom" }] })),
			);
			await expect(lookupExistence(family, "nie-je-tu", "sk-eur"), family).resolves.toBe("unknown");
		}
	});
});

describe("classification", () => {
	it("asks Saleor about a localized root by its base slug, as a category", () => {
		// `product(slug: "stresni-nosice")` and `category(slug: "stresni-nosice")` both answer null,
		// so an armed gate would 404 the canonical category URL of every foreign market.
		expect(classifyRoute("cz", ["cz", "stresni-nosice"])).toEqual({
			family: "category",
			slug: "stresne-nosice",
			channel: "cz-czk",
		});
		expect(classifyRoute("us", ["us", "roof-racks"])).toEqual({
			family: "category",
			slug: "stresne-nosice",
			channel: "us-usd",
		});
		expect(classifyRoute("cz", ["cz", "categories", "nordrive-stresni-nosice"])).toEqual({
			family: "category",
			slug: "nordrive-stresne-nosice",
			channel: "cz-czk",
		});
	});

	it("does not turn another language's spelling into a category", () => {
		expect(classifyRoute("cz", ["cz", "dachtraeger"])?.family).toBe("product");
		expect(classifyRoute("sk", ["sk", "stresni-nosice"])?.family).toBe("product");
	});

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
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => saleor({ data: { product: null } })),
		);
		await expect(lookupExistence("product", "missing", "sk-eur")).resolves.toBe("absent");
	});

	it("calls a returned id exists", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => saleor({ data: { product: { id: "p1" } } })),
		);
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
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => saleor({ data: { product: null } })),
		);
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

describe("abroad, a product URL is the TRANSLATED slug", () => {
	/**
	 * Answers the base and the translated query differently, and records what was asked.
	 *
	 * The two are told apart by `slugLanguageCode` in the document, which is the only thing
	 * that distinguishes them on the wire — and the distinction is the whole subject here:
	 * `product(slug:)` reads the base row ONLY, so a foreign market's own URL never matches it.
	 */
	const upstream = (answers: { base?: unknown; translated?: unknown }) => {
		const asked: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: unknown, init: { body: string }) => {
				const sent = JSON.parse(init.body) as { query: string; variables: Record<string, unknown> };
				const translated = sent.query.includes("slugLanguageCode");
				asked.push(
					translated ? `translated:${String(sent.variables.l)}` : `base:${String(sent.variables.s)}`,
				);
				return saleor(translated ? answers.translated : answers.base);
			}),
		);
		return asked;
	};

	it("is not absent merely because the base row does not match", async () => {
		// The regression this exists to prevent: arming the gate with a base-only query
		// hard-404s every foreign product page on the site, the canary URLs included.
		const asked = upstream({
			base: { data: { product: null } },
			translated: { data: { product: { id: "p1", externalReference: "cfm:product:CFMP-X" } } },
		});
		await expect(lookupExistence("product", "dachtrager-nordrive-helio", "at-eur")).resolves.toBe("exists");
		expect(asked).toEqual(["base:dachtrager-nordrive-helio", "translated:DE_AT"]);
	});

	it("asks in the order the page resolves — base first, translated only on a miss", async () => {
		const asked = upstream({ base: { data: { product: { id: "p1" } } } });
		await expect(lookupExistence("product", "stresny-nosic", "at-eur")).resolves.toBe("exists");
		expect(asked).toEqual(["base:stresny-nosic"]);
	});

	it("is absent only when neither row matches", async () => {
		const asked = upstream({
			base: { data: { product: null } },
			translated: { data: { product: null } },
		});
		await expect(lookupExistence("product", "nothing-anywhere-xyz", "at-eur")).resolves.toBe("absent");
		expect(asked).toEqual(["base:nothing-anywhere-xyz", "translated:DE_AT"]);
	});

	it("asks Slovakia for the base row alone", async () => {
		// Slovakia has no translated row by definition — its URL slug IS the base slug.
		const asked = upstream({ base: { data: { product: null } } });
		await expect(lookupExistence("product", "nothing-anywhere-xyz", "sk-eur")).resolves.toBe("absent");
		expect(asked).toEqual(["base:nothing-anywhere-xyz"]);
	});

	it("uses each market's own language, not its language family", async () => {
		// DE_AT and EN_CA are separate rows. Asking Austria in DE, or Canada in EN, would
		// read Germany's and the United States' slugs and 404 the ones that differ.
		for (const [channel, code] of [
			["at-eur", "DE_AT"],
			["de-eur", "DE"],
			["ca-cad", "EN_CA"],
			["us-usd", "EN"],
			["cz-czk", "CS"],
		] as const) {
			resetRouteExistenceStateForTests();
			const asked = upstream({ base: { data: { product: null } }, translated: { data: { product: null } } });
			await lookupExistence("product", "nothing-anywhere-xyz", channel);
			expect(asked, channel).toEqual(["base:nothing-anywhere-xyz", `translated:${code}`]);
		}
	});

	it("never turns a fault on the translated row into a 404, even for a product event", async () => {
		upstream({ base: { data: { product: null } }, translated: { errors: [{ message: "boom" }] } });
		await expect(lookupExistence("product", "slug-y", "at-eur")).resolves.toBe("unknown");
		expect(forgetProductExistence({ channels: ["at-eur"], slugs: ["slug-y"] })).toEqual({
			dropped: 0,
			remaining: 0,
		});
	});

	it("never turns a fault on the translated row into a 404", async () => {
		// Fail open all the way down: an upstream that cannot answer must not remove a page.
		for (const fault of [{ errors: [{ message: "boom" }] }, { data: null }, { data: {} }]) {
			resetRouteExistenceStateForTests();
			upstream({ base: { data: { product: null } }, translated: fault });
			await expect(lookupExistence("product", "slug-x", "at-eur")).resolves.toBe("unknown");
		}
	});
});

/**
 * A product event reaches this cache: `/api/revalidate` calls `forgetProductExistence`.
 *
 * Without it, a product published in a market answered 404 at its new URL for up to 60 s
 * after the event, and an unpublished one kept its 200 soft-404 for up to 300 s — measured on
 * a production build. The Saleor stub answers by (channel, slug) from a table the tests edit,
 * which is how a publication is simulated here.
 */
describe("a product event reaches the existence cache", () => {
	const BASE = "stresny-nosic-nordrive-helio-black";
	const DE = "dachtrager-nordrive-helio-black";
	let published: Record<string, { base: string; translated?: string } | undefined>;
	let calls: number;

	beforeEach(() => {
		calls = 0;
		published = {};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: unknown, init: { body: string }) => {
				calls++;
				const { query, variables } = JSON.parse(init.body) as {
					query: string;
					variables: { s: string; c: string };
				};
				if (query.includes("category(")) return saleor({ data: { category: { id: "c" } } });
				const row = published[variables.c];
				const translated = query.includes("slugLanguageCode");
				const match = row && (translated ? row.translated === variables.s : row.base === variables.s);
				return saleor({
					data: {
						product: match ? { id: "p", slug: row.base, externalReference: "cfm:product:CFMP-1" } : null,
					},
				});
			}),
		);
	});

	it("publish: the cached absence of the new translated URL is dropped, so it answers at once", async () => {
		await expect(lookupExistence("product", DE, "de-eur")).resolves.toBe("absent");
		published["de-eur"] = { base: BASE, translated: DE };
		await expect(
			lookupExistence("product", DE, "de-eur"),
			"still the cached absence before the event",
		).resolves.toBe("absent");

		// The event names the BASE slug; the absence was cached under the translated one.
		expect(forgetProductExistence({ channels: ["de-eur"], slugs: [BASE] }).dropped).toBe(1);
		await expect(lookupExistence("product", DE, "de-eur")).resolves.toBe("exists");
	});

	it("unpublish: an exists cached under the translated URL is found by the base slug and dropped", async () => {
		published["de-eur"] = { base: BASE, translated: DE };
		await expect(lookupExistence("product", DE, "de-eur")).resolves.toBe("exists");
		published["de-eur"] = undefined;

		forgetProductExistence({ channels: ["de-eur"], slugs: [BASE] });
		await expect(lookupExistence("product", DE, "de-eur")).resolves.toBe("absent");
	});

	it("leaves other products, other channels and other families alone", async () => {
		published["de-eur"] = { base: "another-product" };
		published["sk-eur"] = { base: BASE };
		await lookupExistence("product", "another-product", "de-eur");
		await lookupExistence("product", BASE, "sk-eur");
		await lookupExistence("category", "stresne-nosice", "de-eur");
		const before = calls;

		expect(forgetProductExistence({ channels: ["de-eur"], slugs: [BASE] })).toEqual({
			dropped: 0,
			remaining: 3,
		});
		await lookupExistence("product", "another-product", "de-eur");
		await lookupExistence("product", BASE, "sk-eur");
		expect(calls, "answered from memory, not re-asked").toBe(before);
	});

	it("drops the translated-slug identity the redirects use, the same way", async () => {
		published["de-eur"] = { base: BASE, translated: DE };
		await expect(lookupTranslatedProduct(DE, "de-eur", "DE")).resolves.toMatchObject({
			verdict: "exists",
			baseSlug: BASE,
		});
		published["de-eur"] = undefined;
		forgetProductExistence({ channels: ["de-eur"], slugs: [BASE] });
		await expect(lookupTranslatedProduct(DE, "de-eur", "DE")).resolves.toMatchObject({ verdict: "absent" });
	});

	it("does not store an answer that was asked for before the event landed", async () => {
		let release: () => void = () => {};
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				await new Promise<void>((resolve) => (release = resolve));
				return saleor({ data: { product: null } });
			}),
		);
		const pending = lookupExistence("product", "stresny-nosic-x", "sk-eur");
		forgetProductExistence({ channels: ["sk-eur"], slugs: ["stresny-nosic-x"] });
		release();
		await expect(pending).resolves.toBe("absent");
		expect(routeExistenceStats().size, "the pre-event absence was not cached").toBe(0);
	});

	it("is one cache per process, not per bundle: another copy of this module sees and drops the same entries", async () => {
		// The proxy and the route handlers are separate bundles, each with its own copy of this
		// module. `vi.resetModules()` gives this test a second copy, the way `/api/revalidate` has one.
		await expect(lookupExistence("product", DE, "de-eur")).resolves.toBe("absent");
		vi.resetModules();
		const otherCopy = await import("./route-existence");
		expect(otherCopy.forgetProductExistence).not.toBe(forgetProductExistence);

		expect(otherCopy.forgetProductExistence({ channels: ["de-eur"], slugs: [BASE] })).toEqual({
			dropped: 1,
			remaining: 0,
		});
		expect(routeExistenceStats().size).toBe(0);
	});
});
