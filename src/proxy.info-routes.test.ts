import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INFO_ROUTES } from "./config/info-routes";
import { CHANNEL_MAP } from "./lib/channel-map";
import { classifyRoute, resetRouteExistenceStateForTests } from "./lib/route-existence";
import * as routePolicy from "./lib/route-policy";
import { proxy } from "./proxy";

const ORIGIN = "https://maky.store";
const req = (pathname: string) => new NextRequest(new URL(`${ORIGIN}${pathname}`));
const CASES = INFO_ROUTES.flatMap((route) =>
	Object.entries(route.paths).map(([market, publicPath]) => ({
		market,
		publicPath,
		internalPath: route.internalPath,
		channel: CHANNEL_MAP[market]!.saleorSlug,
	})),
);

// An incorrect product classification receives an authoritative absence. It must not
// turn an information page into a product 404, even with every gate family armed.
const upstream = vi.fn(async () =>
	Response.json({ data: { product: null, category: null, collection: null, page: null } }),
);

beforeEach(() => {
	resetRouteExistenceStateForTests();
	upstream.mockClear();
	vi.stubGlobal("fetch", upstream);
	vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://saleor.invalid/graphql/");
	vi.stubEnv("MAKY_LIVE_MARKETS", Object.keys(CHANNEL_MAP).join(","));
	vi.stubEnv("ROUTE_EXISTENCE_GATE", "on");
	vi.stubEnv("ROUTE_EXISTENCE_MARKETS", Object.keys(CHANNEL_MAP).join(","));
	vi.stubEnv("ROUTE_EXISTENCE_FAMILIES", "product,category,collection,page");
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("public information URLs reach their existing page without a Saleor lookup", () => {
	it.each(CASES)("$market $publicPath", async ({ market, publicPath, internalPath, channel }) => {
		const canonicalPath = `/${market}${publicPath}`;
		const canonical = await proxy(req(canonicalPath));
		expect(canonical.status).toBe(200);
		expect(canonical.headers.get("location")).toBeNull();
		expect(canonical.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/${channel}${internalPath}`);
		expect(canonical.headers.get("x-channel")).toBe(channel);
		expect(canonical.headers.get("x-market")).toBe(market);
		expect(canonical.headers.get("x-locale")).toBe(CHANNEL_MAP[market]!.locale);
		expect(canonical.headers.get("x-maky-gate")).toBe("unclassified");
		expect(canonical.headers.get("x-robots-tag")).toBeNull();
		expect(classifyRoute(market, canonicalPath.split("/").filter(Boolean))).toBeNull();

		if (publicPath !== internalPath) {
			const legacy = await proxy(req(`/${market}${internalPath}`));
			expect(legacy.status).toBe(308);
			expect(legacy.headers.get("location")).toBe(`${ORIGIN}${canonicalPath}`);
			// Follow the actual Location: the migration must reach the page in one hop.
			const destination = await proxy(new NextRequest(legacy.headers.get("location")!));
			expect(destination.status).toBe(200);
			expect(destination.headers.get("location")).toBeNull();
			expect(destination.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/${channel}${internalPath}`);
		}
		expect(upstream).not.toHaveBeenCalled();
	});

	it.each([
		["/us/shipping-and-payment", "/us-usd/doprava-a-platba"],
		["/us/contact", "/us-usd/kontakt"],
		["/us/terms-and-conditions", "/us-usd/obchodne-podmienky"],
		["/us/privacy-policy", "/us-usd/ochrana-osobnych-udajov"],
		["/us/cancellations-and-returns", "/us-usd/odstupenie-od-zmluvy"],
		["/us/cancellations-and-returns/form", "/us-usd/odstupenie-od-zmluvy/vzorovy-formular"],
		["/us/returns-and-complaints", "/us-usd/reklamacie-a-vratenie"],
		["/de/agb", "/de-eur/obchodne-podmienky"],
		["/de/widerruf/musterformular", "/de-eur/odstupenie-od-zmluvy/vzorovy-formular"],
		["/at/ruecktritt/musterformular", "/at-eur/odstupenie-od-zmluvy/vzorovy-formular"],
	])("%s has a pinned public spelling", async (publicPath, internalPath) => {
		const res = await proxy(req(publicPath));
		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
		expect(res.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}${internalPath}`);
		expect(upstream).not.toHaveBeenCalled();
	});
});

describe("information-page navigation and old addresses", () => {
	it.each(["/us/kontakt/.rsc", "/us/kontakt.rsc/_segments/x.segment.rsc"])(
		"does not redirect an unsupported transport combination to itself: %s",
		async (path) => {
			const res = await proxy(req(path));
			expect(res.headers.get("location")).toBeNull();
			expect(res.status).not.toBe(308);
		},
	);
	it.each([".rsc", ".json", "/_segments/form.segment.rsc", "/segments/form.segment.rsc"])(
		"preserves %s and the query on redirects and internal rewrites",
		async (suffix) => {
			const query = "?download=1&source=email%2Breturn";
			const publicPath = `/us/cancellations-and-returns/form${suffix}${query}`;
			const legacy = await proxy(req(`/us/odstupenie-od-zmluvy/vzorovy-formular${suffix}${query}`));
			expect(legacy.status).toBe(308);
			expect(legacy.headers.get("location")).toBe(`${ORIGIN}${publicPath}`);

			const canonical = await proxy(new NextRequest(legacy.headers.get("location")!));
			expect(canonical.status).toBe(200);
			expect(canonical.headers.get("location")).toBeNull();
			expect(canonical.headers.get("x-middleware-rewrite")).toBe(
				`${ORIGIN}/us-usd/odstupenie-od-zmluvy/vzorovy-formular${suffix}${query}`,
			);
			expect(upstream).not.toHaveBeenCalled();
		},
	);

	it("redirects a raw Saleor channel directly to the localized public address", async () => {
		const res = await proxy(req("/us-usd/kontakt?source=email"));
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(`${ORIGIN}/us/contact?source=email`);
		const destination = await proxy(new NextRequest(res.headers.get("location")!));
		expect(destination.status).toBe(200);
		expect(destination.headers.get("location")).toBeNull();
		expect(destination.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/us-usd/kontakt?source=email`);
		expect(upstream).not.toHaveBeenCalled();
	});
});

describe("localization keeps market and exact-route boundaries", () => {
	it("keeps a preview market unindexed without losing its localized page", async () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk");
		const res = await proxy(req("/us/contact"));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/us-usd/kontakt`);
		expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(res.headers.getSetCookie().some((cookie) => cookie.startsWith("maky-market="))).toBe(false);
		const legacy = await proxy(req("/us/kontakt"));
		expect(legacy.status).toBe(308);
		expect(legacy.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(legacy.headers.get("location")).toBe(`${ORIGIN}/us/contact`);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("checks route availability before serving or redirecting an information page", async () => {
		const marketHasRoute = routePolicy.marketHasRoute;
		vi.spyOn(routePolicy, "marketHasRoute").mockImplementation(
			(market, segment) => market !== "us" && marketHasRoute(market, segment),
		);
		for (const path of ["/us/contact", "/us/kontakt"]) {
			const res = await proxy(req(path));
			expect(res.status, path).toBe(404);
			expect(res.headers.get("location"), path).toBeNull();
			expect(res.headers.get("x-robots-tag"), path).toBe("noindex");
			expect(res.headers.get("x-middleware-rewrite"), path).toBe(`${ORIGIN}/_not-found`);
		}
		expect(upstream).not.toHaveBeenCalled();
	});

	it.each(["/us/contact-roof-box", "/de/contact"])(
		"does not reserve a product slug or another market's public word: %s",
		async (path) => {
			const res = await proxy(req(path));
			expect(res.status).toBe(404);
			expect(res.headers.get("x-maky-gate")).toBe("product:absent");
			expect(res.headers.get("location")).toBeNull();
			// Foreign products are checked against both the base and translated slug.
			expect(upstream).toHaveBeenCalledTimes(2);
		},
	);

	it.each(["/us/contact/unknown", "/us/cancellations-and-returns/unknown"])(
		"does not translate arbitrary descendants: %s",
		async (path) => {
			const res = await proxy(req(path));
			expect(res.headers.get("location")).toBeNull();
			expect(res.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}${path.replace("/us/", "/us-usd/")}`);
			expect(upstream).not.toHaveBeenCalled();
		},
	);

	it("retains the localized internal rewrite when an earlier rule throws", async () => {
		vi.spyOn(routePolicy, "marketHasRoute").mockImplementationOnce(() => {
			throw new Error("test policy failure");
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await proxy(req("/us/contact.rsc?source=retry"));
		expect(res.status).toBe(200);
		expect(res.headers.get("x-maky-gate")).toBe("error");
		expect(res.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/us-usd/kontakt.rsc?source=retry`);
		expect(upstream).not.toHaveBeenCalled();
	});
});
