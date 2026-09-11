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

/**
 * A `found` outcome carrying a real body.
 *
 * `{ page: {} }` used to be enough, because availability only looked at the status.
 * It now also asks whether the document has a body for this market, so a page stub
 * with no layout is no longer a page — which is the point of the check.
 */
const foundWithBody = () => ({
	status: "found",
	page: {
		id: "019fb008-504b-779e-ad3f-1ff353267c88",
		slug: "o-nas",
		layout: [
			{
				blockType: "richText",
				id: "b1",
				blockName: null,
				markets: null,
				content: {
					root: {
						type: "root",
						children: [
							{ type: "paragraph", children: [{ type: "text", text: "O nás", version: 1 }], version: 1 },
						],
					},
				},
			},
		],
	},
});

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
		fetchCmsPage.mockResolvedValue(foundWithBody());
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

	// Published, allowed here, and carrying no body for this market. The provider
	// contract says that is not a valid navigation, sitemap or hreflang target — so the
	// link has to go, exactly as it would for an unpublish.
	it("content-not-ready: the link disappears, like an unpublish and unlike an outage", async () => {
		// A German request against a document whose only body block is Austrian: the page
		// is allowed, and the market filter leaves nothing behind.
		const notReady = { ...foundWithBody(), page: { ...foundWithBody().page, layout: [] } };
		fetchCmsPage.mockResolvedValue(notReady);
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("de-eur", "o-nas")).toBe(false);
	});

	it("a market the policy does not offer never reaches the CMS at all", async () => {
		marketHasRoute.mockReturnValue(false);
		const { cmsRouteAvailable } = await subject();
		expect(await cmsRouteAvailable("de-eur", "o-nas")).toBe(false);
		expect(fetchCmsPage, "the static gate must short-circuit").not.toHaveBeenCalled();
	});

	it("asks the CMS with this market's own locale and market code", async () => {
		fetchCmsPage.mockResolvedValue(foundWithBody());
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

/**
 * The shared navigation rule.
 *
 * The header and footer each had their own idea of which links a market may show, and
 * they disagreed: task A taught the footer to drop a route a market does not have,
 * while the header went on linking `/poradna` in all twelve markets, eleven of which
 * answer 404 — a dead link in the primary navigation of every page.
 *
 * The trap in fixing it is the category links. `/stresne-nosice` is a root catalogue
 * URL, not an entry in `route-policy`, so asking `marketHasRoute` about it answers
 * "no" — and a naive filter empties the entire menu.
 */
describe("visibleNavLinks", () => {
	const NAV = [
		{ key: "roofRacks", href: "/stresne-nosice" },
		{ key: "bikeCarriers", href: "/nosice-bicyklov" },
		{ key: "advice", href: "/poradna" },
	] as const;

	it("keeps the category links, which are not route-policy segments", async () => {
		marketHasRoute.mockReturnValue(false);
		const { visibleNavLinks } = await subject();
		const kept = (await visibleNavLinks("de-eur", NAV)).map((l) => l.href);
		expect(kept).toContain("/stresne-nosice");
		expect(kept).toContain("/nosice-bicyklov");
		expect(fetchCmsPage, "a category link must never trigger a CMS read").not.toHaveBeenCalled();
	});

	it("drops a CMS route the market does not have", async () => {
		marketHasRoute.mockImplementation((_m: string, segment: string) => segment !== "poradna");
		const { visibleNavLinks } = await subject();
		expect((await visibleNavLinks("de-eur", NAV)).map((l) => l.href)).not.toContain("/poradna");
	});

	it("keeps a CMS route the market has and the CMS has published", async () => {
		marketHasRoute.mockReturnValue(true);
		fetchCmsPage.mockResolvedValue(foundWithBody());
		const { visibleNavLinks } = await subject();
		expect((await visibleNavLinks("sk-eur", NAV)).map((l) => l.href)).toContain("/poradna");
	});

	it("drops a CMS route whose document has been unpublished", async () => {
		marketHasRoute.mockReturnValue(true);
		fetchCmsPage.mockResolvedValue({ status: "not-found" });
		const { visibleNavLinks } = await subject();
		expect((await visibleNavLinks("sk-eur", NAV)).map((l) => l.href)).not.toContain("/poradna");
	});

	// The gate matters most for STATIC routes. For a CMS route `cmsRouteAvailable`
	// checks the market again itself, so dropping the gate here changes nothing —
	// which is exactly why a falsification run that only exercised `/poradna` stayed
	// green while the gate was removed. This is the case that actually holds it.
	it("drops a static route the market does not have", async () => {
		marketHasRoute.mockReturnValue(false);
		const { visibleNavLinks } = await subject();
		const kept = await visibleNavLinks("de-eur", [
			{ key: "aboutUs", href: "/o-nas" },
			{ key: "contact", href: "/kontakt" },
		]);
		expect(kept).toHaveLength(0);
		expect(fetchCmsPage, "the market gate must short-circuit before the CMS").not.toHaveBeenCalled();
	});

	it("keeps a static route the market has, without asking the CMS", async () => {
		marketHasRoute.mockReturnValue(true);
		const { visibleNavLinks } = await subject();
		const kept = await visibleNavLinks("de-eur", [{ key: "contact", href: "/kontakt" }]);
		expect(kept).toHaveLength(1);
		expect(fetchCmsPage).not.toHaveBeenCalled();
	});
});
