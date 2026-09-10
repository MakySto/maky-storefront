import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Navigation must follow the CMS, not a static table.
 *
 * The footer's comment said `/o-nas` "follows the CMS" while the code read only
 * `route-policy.ts`, so an unpublish changed the page and left the link. These tests
 * hold the two halves apart: the static gate decides whether the route is offered at
 * all, the CMS decides whether it is published right now, and an OUTAGE is neither.
 */

vi.mock("server-only", () => ({}));

const fetchCmsPage = vi.fn();
vi.mock("@/lib/cms/client", () => ({ fetchCmsPage: (...args: unknown[]) => fetchCmsPage(...args) }));

const marketHasRoute = vi.fn();
vi.mock("@/lib/route-policy", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/route-policy")>()),
	marketHasRoute: (...args: unknown[]) => marketHasRoute(...args),
}));

async function subject() {
	return import("./availability");
}

beforeEach(() => {
	vi.resetModules();
	fetchCmsPage.mockReset();
	marketHasRoute.mockReset();
	marketHasRoute.mockReturnValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe("cmsRouteAvailable", () => {
	it("published: the link is shown", async () => {
		fetchCmsPage.mockResolvedValue({ status: "found", page: {} });
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("sk-eur", "o-nas")).toBe(true);
	});

	it("unpublished: the link disappears from navigation", async () => {
		fetchCmsPage.mockResolvedValue({ status: "not-found" });
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("sk-eur", "o-nas")).toBe(false);
	});

	it("excluded from this market: the link disappears", async () => {
		fetchCmsPage.mockResolvedValue({ status: "market-mismatch", documentId: "x", markets: ["CZ"] });
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("sk-eur", "o-nas")).toBe(false);
	});

	// The route still renders on an outage — the bootstrap, or the localised unavailable
	// state — so hiding the link would make a transient fault look like a deletion.
	it("upstream outage: the link stays", async () => {
		fetchCmsPage.mockResolvedValue({ status: "error", reason: "timeout after 3000ms" });
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("sk-eur", "o-nas")).toBe(true);
	});

	it("a market the policy does not offer never reaches the CMS at all", async () => {
		marketHasRoute.mockReturnValue(false);
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("de-eur", "o-nas")).toBe(false);
		expect(fetchCmsPage, "the static gate must short-circuit").not.toHaveBeenCalled();
	});

	it("asks the CMS with this market's own locale and market code", async () => {
		fetchCmsPage.mockResolvedValue({ status: "found", page: {} });
		const { cmsRouteAvailable } = await subject();
		await cmsRouteAvailable("ca-cad", "o-nas");
		expect(fetchCmsPage).toHaveBeenCalledWith("o-nas", "en", "CA");
	});
});

describe("isCmsRoute", () => {
	it("is true for the CMS routes and false for the static legal ones", async () => {
		const { isCmsRoute } = await subject();
		expect(isCmsRoute("o-nas")).toBe(true);
		expect(isCmsRoute("poradna")).toBe(true);
		expect(isCmsRoute("kontakt")).toBe(false);
		expect(isCmsRoute("obchodne-podmienky")).toBe(false);
		expect(isCmsRoute("not-a-route")).toBe(false);
	});
});
