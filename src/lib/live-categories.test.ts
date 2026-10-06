import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_SLUGS, categoryUrl, isCategorySlug } from "@/config/categories";
import { categoryUrlFor } from "@/config/category-routes";
import { CHANNEL_MAP } from "@/lib/channel-map";
import {
	liveCategoriesStats,
	ensureFreshLiveCategories,
	keepLiveCategoriesFresh,
	prewarmLiveCategories,
	refreshLiveCategories,
	resetLiveCategoriesForTests,
} from "./live-categories";
import { installFakeSaleor } from "./live-categories.testkit";

/**
 * Owner, 2026-10-06: a category created in Saleor gets its root URL with no edit and no deploy.
 *
 * The live list is what makes that true, and what has to stay true around it: it never waits on a
 * request, never knows fewer than the build's floor, never takes a URL that already means
 * something else, and is not fooled by an answer it should not trust. Every test here runs
 * against `live-categories.testkit.ts`' fake Saleor — the wire is what is being tested.
 */

const NEW = "a-new-saleor-category";
const T0 = new Date("2026-10-06T12:00:00Z").getTime();

/** Wait for a load the proxy-style `keepLiveCategoriesFresh` started, without starting another one. */
const settled = () => vi.waitFor(() => expect(liveCategoriesStats().inFlight).toBe(false));

let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	// One clock for the whole test. A first load on the real one and a later `setSystemTime(T0 + …)`
	// would measure the forced-refresh interval against a start that is in the future — and this
	// file would pass on the day it was written and fail on every day after it.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(T0);
	resetLiveCategoriesForTests();
	log = vi.spyOn(console, "log").mockImplementation(() => {});
	warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	resetLiveCategoriesForTests();
});

describe("a category the build does not name", () => {
	it("gets its root URL once Saleor has been asked, in every market", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);

		expect(isCategorySlug(NEW)).toBe(false);
		expect(categoryUrl(NEW)).toBe(`/categories/${NEW}`);

		await refreshLiveCategories();

		expect(isCategorySlug(NEW)).toBe(true);
		expect(categoryUrl(NEW)).toBe(`/${NEW}`);
		for (const market of Object.keys(CHANNEL_MAP)) {
			expect(categoryUrlFor(market, NEW), market).toBe(`/${NEW}`);
		}
		expect(liveCategoriesStats().admitted).toEqual([NEW]);
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`now routing 1 new category: ${NEW}`));
	});

	it("is checked against the products of EVERY channel, in one request", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);

		await refreshLiveCategories();

		expect(world.probeCalls).toBe(1);
		const channels = [...world.probeQueries[0]!.matchAll(/channel:"([a-z-]+)"/g)].map(
			([, channel]) => channel,
		);
		expect(channels.sort()).toEqual(
			Object.values(CHANNEL_MAP)
				.map((config) => config.saleorSlug)
				.sort(),
		);
	});

	it("is never asked about when it is already in the build's floor", async () => {
		const { world } = installFakeSaleor();

		await refreshLiveCategories();

		expect(world.listCalls).toBe(1);
		expect(world.probeCalls).toBe(0);
		expect(liveCategoriesStats().admitted).toEqual([]);
		for (const slug of CATEGORY_SLUGS) expect(isCategorySlug(slug), slug).toBe(true);
	});

	it("is found on a later page of the list", async () => {
		const { world } = installFakeSaleor({ pageSize: 7 });
		world.categories.push(NEW);

		await refreshLiveCategories();

		expect(world.listCalls).toBe(Math.ceil((CATEGORY_SLUGS.size + 1) / 7));
		expect(isCategorySlug(NEW)).toBe(true);
	});
});

describe("a slug that already means something else", () => {
	it("is not routed while a product in ANY channel holds it, and says so once", async () => {
		const { world } = installFakeSaleor();
		world.categories.push("clash");
		world.products.clash = ["de-eur"];

		await refreshLiveCategories();

		expect(isCategorySlug("clash")).toBe(false);
		expect(categoryUrl("clash")).toBe("/categories/clash");
		expect(liveCategoriesStats().refused.clash).toBe("a product holds this slug in de-eur");
		expect(warn).toHaveBeenCalledTimes(1);

		// Asked again at every load, and not repeated while the answer is the same.
		vi.setSystemTime(T0 + 10_000);
		await refreshLiveCategories({ force: true });
		vi.setSystemTime(T0 + 15_000);
		await refreshLiveCategories({ force: true });
		expect(world.probeCalls).toBe(3);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it("moves to the root by itself the day the product lets go of the slug", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor();
		world.categories.push("clash");
		world.products.clash = ["sk-eur"];
		await refreshLiveCategories();
		expect(isCategorySlug("clash")).toBe(false);

		delete world.products.clash;
		vi.setSystemTime(T0 + 61_000);
		await refreshLiveCategories();

		expect(isCategorySlug("clash")).toBe(true);
		expect(liveCategoriesStats().refused).toEqual({});
	});

	it("is not admitted on a probe that could not be answered, and is asked again", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor({ probeErrors: true });
		world.categories.push(NEW);

		await refreshLiveCategories();
		// The list was read, so the live list is loaded; the category simply is not admitted yet.
		expect(liveCategoriesStats().loaded).toBe(true);
		expect(isCategorySlug(NEW)).toBe(false);
		expect(liveCategoriesStats().refused).toEqual({});

		world.probeErrors = false;
		vi.setSystemTime(T0 + 61_000);
		await refreshLiveCategories();
		expect(isCategorySlug(NEW)).toBe(true);
	});

	it.each([
		["products", "the name of a real route"],
		["account", "the name of a real route"],
		["znacky", "the name of a real route"],
		["sk", "the name of a market"],
		["cz-czk", "the name of a market"],
		["warenkorb", "a market's cart route"],
		["dachtraeger", "a localized category segment in de"],
		["Upper_Case", "not a plain lower-case slug"],
		["has.dot", "not a plain lower-case slug"],
	])("never routes %s (%s), and does not even ask about it", async (slug, reason) => {
		const { world } = installFakeSaleor();
		world.categories.push(slug);

		await refreshLiveCategories();

		expect(isCategorySlug(slug)).toBe(false);
		expect(liveCategoriesStats().refused[slug]).toBe(reason);
		expect(world.probeCalls).toBe(0);
	});
});

describe("an answer that cannot be trusted", () => {
	it("leaves the floor exactly as it was when Saleor cannot be reached", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW);
		world.down = true;

		await refreshLiveCategories();

		const stats = liveCategoriesStats();
		expect(stats.loaded).toBe(false);
		expect(stats.failures).toBe(1);
		expect(isCategorySlug(NEW)).toBe(false);
		for (const slug of CATEGORY_SLUGS) expect(isCategorySlug(slug), slug).toBe(true);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("could not read the category list"));
	});

	it("does not take a list that carries GraphQL errors, partial data and all", async () => {
		const { world } = installFakeSaleor({ listErrors: true });
		world.categories.push(NEW);

		await refreshLiveCategories();

		expect(liveCategoriesStats().loaded).toBe(false);
		expect(isCategorySlug(NEW)).toBe(false);
	});

	it("does not take a malformed list", async () => {
		vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "https://saleor.test/graphql/");
		for (const data of [
			{ categories: null },
			{ categories: { edges: "no", pageInfo: { hasNextPage: false } } },
			{ categories: { edges: [{ node: { slug: 42 } }], pageInfo: { hasNextPage: false } } },
			{ categories: { edges: [], pageInfo: { hasNextPage: true } } },
		]) {
			resetLiveCategoriesForTests();
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })),
			);
			await refreshLiveCategories();
			expect(liveCategoriesStats().loaded, JSON.stringify(data)).toBe(false);
		}
	});

	it("backs off after a failure, doubling, instead of asking an unwell Saleor every request", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { fetchMock } = installFakeSaleor({ down: true });

		await refreshLiveCategories();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.setSystemTime(T0 + 5_000);
		keepLiveCategoriesFresh();
		expect(fetchMock, "inside the first 15 s").toHaveBeenCalledTimes(1);

		vi.setSystemTime(T0 + 16_000);
		keepLiveCategoriesFresh();
		await settled();
		expect(fetchMock, "after 15 s").toHaveBeenCalledTimes(2);

		vi.setSystemTime(T0 + 16_000 + 29_000);
		keepLiveCategoriesFresh();
		expect(fetchMock, "inside the second back-off, which is 30 s").toHaveBeenCalledTimes(2);

		vi.setSystemTime(T0 + 16_000 + 31_000);
		keepLiveCategoriesFresh();
		await settled();
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(warn, "a run of failures is one line, not one per attempt").not.toHaveBeenCalled();
		expect(
			log.mock.calls.filter((call: unknown[]) => String(call[0]).includes("could not read")),
		).toHaveLength(1);
	});

	it("is back to normal, and says so, once Saleor answers again", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor({ down: true });
		world.categories.push(NEW);
		await refreshLiveCategories();

		world.down = false;
		vi.setSystemTime(T0 + 16_000);
		await refreshLiveCategories();

		expect(liveCategoriesStats()).toMatchObject({ loaded: true, failures: 0 });
		expect(isCategorySlug(NEW)).toBe(true);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("answered again after 1 failed load"));
	});

	it("never removes a category on a failed or partial answer, only on a complete one", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor({ pageSize: 10 });
		world.categories.push(NEW);
		await refreshLiveCategories();
		expect(isCategorySlug(NEW)).toBe(true);

		// Saleor down: nothing changes.
		world.down = true;
		vi.setSystemTime(T0 + 61_000);
		await refreshLiveCategories();
		expect(isCategorySlug(NEW)).toBe(true);
		world.down = false;

		// The list stops after its first page, and the new category is on a later one.
		world.failAfterFirstPage = true;
		vi.setSystemTime(T0 + 200_000);
		await refreshLiveCategories();
		expect(isCategorySlug(NEW), "a partial list cannot retire anything").toBe(true);

		// A complete list that no longer holds it: the category was deleted.
		world.failAfterFirstPage = false;
		world.categories = world.categories.filter((slug) => slug !== NEW);
		vi.setSystemTime(T0 + 260_000);
		await refreshLiveCategories();
		expect(isCategorySlug(NEW)).toBe(false);
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`no longer routing 1: ${NEW}`));
	});

	it("never knows fewer than the floor, whatever Saleor lists", async () => {
		installFakeSaleor({ categories: ["something-else"] });

		await refreshLiveCategories();

		for (const slug of CATEGORY_SLUGS) expect(isCategorySlug(slug), slug).toBe(true);
	});
});

describe("how it is refreshed", () => {
	it("shares one load between concurrent callers", async () => {
		const { world } = installFakeSaleor({ delayMs: 5 });

		await Promise.all([refreshLiveCategories(), refreshLiveCategories(), refreshLiveCategories()]);

		expect(world.listCalls).toBe(1);
	});

	it("starts a refresh from the request path without waiting for it, and only when the set is a minute old", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor({ delayMs: 5 });
		world.categories.push(NEW);

		// A request arrives: the call returns at once, and the answer is still the floor's.
		expect(keepLiveCategoriesFresh()).toBeUndefined();
		expect(isCategorySlug(NEW)).toBe(false);
		await settled();
		expect(isCategorySlug(NEW)).toBe(true);
		expect(world.listCalls).toBe(1);

		vi.setSystemTime(T0 + 30_000);
		keepLiveCategoriesFresh();
		await settled();
		expect(world.listCalls, "still fresh").toBe(1);

		vi.setSystemTime(T0 + 61_000);
		keepLiveCategoriesFresh();
		await settled();
		expect(world.listCalls, "a minute old").toBe(2);
	});

	it("gives up WAITING after waitMs and lets the load finish in the background", async () => {
		const { world } = installFakeSaleor({ delayMs: 60 });
		world.categories.push(NEW);

		await refreshLiveCategories({ waitMs: 5 });
		expect(liveCategoriesStats().loaded).toBe(false);
		expect(liveCategoriesStats().inFlight).toBe(true);

		await vi.waitFor(() => expect(isCategorySlug(NEW)).toBe(true), { timeout: 2_000 });
	});

	it("forces a reload on a category event, ignoring the back-off but not a load that has just started", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world, fetchMock } = installFakeSaleor({ down: true });
		await refreshLiveCategories();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		world.down = false;
		world.categories.push(NEW);

		vi.setSystemTime(T0 + 1_000);
		await refreshLiveCategories({ force: true });
		expect(fetchMock, "one started a second ago").toHaveBeenCalledTimes(1);

		vi.setSystemTime(T0 + 3_000);
		await refreshLiveCategories({ force: true });
		expect(isCategorySlug(NEW), "inside the back-off, and loaded anyway").toBe(true);
	});

	it("reads the list once more when a category event arrives while a load is already running", async () => {
		// The load has read the list when the category is created and its event comes in: it cannot
		// know the category, and answering the event with its result would leave the set one behind.
		const created: { event?: Promise<void> } = {};
		const { world } = installFakeSaleor({
			// A real fetch never answers inside the call that made it.
			delayMs: 1,
			afterList: () => {
				if (created.event) return;
				world.categories.push(NEW);
				created.event = refreshLiveCategories({ force: true });
			},
		});

		await refreshLiveCategories();
		await created.event;

		expect(isCategorySlug(NEW)).toBe(true);
		expect(world.listCalls).toBe(2);
		expect(liveCategoriesStats().inFlight, "one extra pass, not a loop").toBe(false);
	});

	it("refreshes for the sitemap only when the set is stale", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(T0);
		const { world } = installFakeSaleor();

		await ensureFreshLiveCategories({ waitMs: 1_000 });
		await ensureFreshLiveCategories({ waitMs: 1_000 });
		expect(world.listCalls).toBe(1);

		vi.setSystemTime(T0 + 61_000);
		await ensureFreshLiveCategories({ waitMs: 1_000 });
		expect(world.listCalls).toBe(2);
	});

	it("does nothing, and throws nothing, without a Saleor endpoint", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		vi.stubEnv("NEXT_PUBLIC_SALEOR_API_URL", "");

		keepLiveCategoriesFresh();
		await refreshLiveCategories({ force: true });
		await ensureFreshLiveCategories({ waitMs: 10 });
		await prewarmLiveCategories();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(isCategorySlug("stresne-boxy")).toBe(true);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("no Saleor endpoint configured"));
	});

	it("holds boot only for waitMs, and says so on the boot line when the load has not finished", async () => {
		const { world } = installFakeSaleor({ delayMs: 60 });
		world.categories.push(NEW);

		await prewarmLiveCategories({ waitMs: 5 });

		expect(log).toHaveBeenCalledWith(
			`[live-categories] floor=${CATEGORY_SLUGS.size} live=0 refused=0 loaded=no`,
		);
		// ...and the load is not abandoned: the floor answers until it lands.
		await vi.waitFor(() => expect(isCategorySlug(NEW)).toBe(true), { timeout: 2_000 });
	});

	it("prints one boot line saying what the process will route", async () => {
		const { world } = installFakeSaleor();
		world.categories.push(NEW, "clash");
		world.products.clash = ["pl-pln"];

		await prewarmLiveCategories();

		expect(log).toHaveBeenCalledWith(
			`[live-categories] floor=${CATEGORY_SLUGS.size} live=1 refused=1 loaded=yes`,
		);
	});
});
