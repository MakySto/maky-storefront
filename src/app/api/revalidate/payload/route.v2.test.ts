import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route");
const { parseCmsRevalidateEvent, tagsForCmsEvent } = await import("@/lib/cms/revalidate-event");
const { revalidationTargets } = await import("@/lib/cms/revalidate-targets");

/**
 * Revalidation event v2 against the provider's own fixtures.
 *
 * The events under `provider-v3/fixtures/events/` were produced by the CMS's real
 * `buildStorefrontEvent`, and `fixtures/responses/` is what the CMS expects back. The
 * responses are compared whole, so a field this storefront forgets — or adds under a
 * different name — fails here rather than in the CMS admin as "Chyba obnovy webu".
 */

const PACK = join(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../../../lib/cms/__fixtures__/provider-v3/fixtures",
);
const SECRET = "fake-payload-revalidate-secret";
const ENDPOINT = "https://storefront.example.test/api/revalidate/payload";

function fixture(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(PACK, path), "utf8")) as Record<string, unknown>;
}

const event = (name: string) => fixture(`events/${name}.json`);
const expectedResponse = (name: string) => fixture(`responses/${name}.json`);

async function post(body: unknown) {
	const request = new Request(ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
		body: JSON.stringify(body),
	});
	return POST(request as unknown as NextRequest);
}

const invalidated = () => revalidateTag.mock.calls.map(([tag]) => tag as string);

beforeEach(() => {
	vi.stubEnv("PAYLOAD_REVALIDATE_SECRET", SECRET);
	// The production origin, as a string only: the canonical helper reads it, nothing fetches it.
	vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://maky.store");
	vi.stubEnv("MAKY_LIVE_MARKETS", "");
	revalidateTag.mockClear();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("POST /api/revalidate/payload — v2 responses match the contract fixtures", () => {
	it.each([
		["page-publish", "revalidate-v2-page-publish"],
		["page-update-slug-and-markets", "revalidate-v2-not-live"],
		["page-unpublish", "revalidate-v2-unpublish"],
		["media-update", "revalidate-v2-media"],
	])("%s answers exactly %s", async (eventName, responseName) => {
		const response = await post(event(eventName));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(expectedResponse(responseName));
	});

	it("invalidates the tags the response names, in that order, with stale-while-revalidate", async () => {
		const response = await post(event("page-update-slug-and-markets"));
		const body = (await response.json()) as { revalidated: string[] };
		expect(invalidated()).toEqual(body.revalidated);
		expect(revalidateTag).toHaveBeenCalledWith(expect.any(String), "max");
	});

	it("answers a v1 body exactly as before — no v2 fields", async () => {
		const v1 = event("page-publish");
		for (const key of [
			"schemaVersion",
			"eventId",
			"change",
			"revision",
			"markets",
			"locales",
			"routes",
			"dependents",
			"occurredAt",
		]) {
			delete v1[key];
		}
		const response = await post(v1);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(expectedResponse("revalidate-v1"));
	});

	it("still refuses a body whose v1 fields are wrong, v2 or not", async () => {
		expect((await post({ ...event("page-publish"), event: "trash" })).status).toBe(400);
		expect((await post({ ...event("page-publish"), source: "somebody-else" })).status).toBe(400);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("accepts an unknown `change` when the v1 `event` is valid", async () => {
		const response = await post({ ...event("page-publish"), change: "archive" });
		expect(response.status).toBe(200);
		const body = (await response.json()) as { targets: unknown[]; revalidated: string[] };
		expect(body.revalidated).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
		expect(body.targets).toHaveLength(1);
	});

	it("never invalidates a tag or path named by the body, dependents included", async () => {
		await post({
			...event("media-update"),
			tag: "cms:page:everything",
			tags: ["*"],
			dependents: [
				{ entitySlug: "pages", entityId: "x", slug: "../../etc/passwd" },
				{ entitySlug: "pages", entityId: "y", slug: "o-nas" },
				"not-a-dependent",
				{ slug: "no-entity" },
			],
		});
		expect(invalidated()).toEqual(["cms:collection:public-media", "cms:collection:pages", "cms:page:o-nas"]);
	});

	it("answers `targets: []` for a global and for a brand, so the CMS records delivery only", async () => {
		for (const name of ["global-update", "brand-publish"]) {
			const body = (await (await post(event(name))).json()) as Record<string, unknown>;
			expect(body.schemaVersion, name).toBe(2);
			expect(body.eventId, name).toBe(event(name).eventId);
			expect(body.targets, name).toEqual([]);
		}
	});
});

describe("tagsForCmsEvent — every v2 fixture", () => {
	const tags = (name: string) => {
		const parsed = parseCmsRevalidateEvent(event(name));
		if (!parsed.ok) throw new Error(`${name} must parse: ${parsed.reason}`);
		return tagsForCmsEvent(parsed.event);
	};

	it.each([
		["page-publish", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-restore", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-unpublish", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-trash", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-delete", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-all-markets-update", ["cms:collection:pages", "cms:page:o-nas"]],
		["page-update-slug-and-markets", ["cms:collection:pages", "cms:page:o-nas", "cms:page:o-firme"]],
		[
			"media-update",
			["cms:collection:public-media", "cms:collection:pages", "cms:page:poradna", "cms:collection:brands"],
		],
		["brand-publish", ["cms:collection:brands"]],
		["global-update", ["cms:global:announcement-bar"]],
	])("%s", (name, expected) => {
		expect(tags(name)).toEqual(expected);
	});

	it("reads the old slug from routes.previous when the v1 field is absent", () => {
		const body = { ...event("page-update-slug-and-markets"), previousSlug: null };
		const parsed = parseCmsRevalidateEvent(body);
		if (!parsed.ok) throw new Error("must parse");
		expect(tagsForCmsEvent(parsed.event)).toContain("cms:page:o-firme");
	});
});

describe("parseCmsRevalidateEvent — the v2 superset", () => {
	it("keeps the v1 fields and adds the v2 ones", () => {
		const parsed = parseCmsRevalidateEvent(event("page-update-slug-and-markets"));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.event).toMatchObject({
			source: "maky-cms",
			entityType: "collection",
			entitySlug: "pages",
			event: "update",
			slug: "o-nas",
			previousSlug: "o-firme",
			locale: null,
		});
		expect(parsed.event.v2).toEqual({
			schemaVersion: 2,
			eventId: "01928f3f-0000-7000-8000-000000000002",
			change: "update",
			revision: "2026-09-26T07:59:58.412Z",
			markets: ["SK", "CZ"],
			locales: ["sk", "cs"],
			routes: {
				previous: { slug: "o-firme", markets: ["SK"], locales: ["sk"] },
				current: { slug: "o-nas", markets: ["SK", "CZ"], locales: ["sk", "cs"] },
			},
			dependents: [],
		});
	});

	it("treats only an exact schemaVersion 2 as v2", () => {
		for (const schemaVersion of [undefined, 1, 3, "2"]) {
			const parsed = parseCmsRevalidateEvent({ ...event("page-publish"), schemaVersion });
			if (!parsed.ok) throw new Error("must parse");
			expect(parsed.event.v2, String(schemaVersion)).toBeUndefined();
		}
	});

	it("reads an unknown change as null, and drops malformed extras instead of refusing", () => {
		const parsed = parseCmsRevalidateEvent({
			...event("page-publish"),
			change: "purge-everything",
			eventId: "<script>",
			markets: ["SK", "XX", 7],
			locales: ["sk", "xx"],
			routes: { previous: "o-nas", current: { markets: ["SK"] } },
			dependents: "all",
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.event.v2).toMatchObject({
			change: null,
			eventId: null,
			markets: ["SK"],
			locales: ["sk"],
			routes: { previous: null, current: null },
			dependents: [],
		});
	});
});

describe("revalidationTargets", () => {
	const targets = (body: Record<string, unknown>) => {
		const parsed = parseCmsRevalidateEvent(body);
		if (!parsed.ok) throw new Error(`must parse: ${parsed.reason}`);
		return revalidationTargets(parsed.event);
	};

	it("SK is live, CZ is not, and CZ is never given a URL", () => {
		expect(targets(event("page-update-slug-and-markets"))).toEqual([
			{ market: "SK", locale: "sk", live: true, expect: "present", url: "https://maky.store/sk/o-nas" },
			{ market: "CZ", locale: "cs", live: false, expect: "present", url: null, reason: "market-not-live" },
		]);
	});

	it("a live market whose route policy does not offer the page is route-not-available", () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz");
		const cz = targets(event("page-update-slug-and-markets")).find((target) => target.market === "CZ");
		expect(cz).toEqual({
			market: "CZ",
			locale: "cs",
			live: false,
			expect: "present",
			url: null,
			reason: "route-not-available",
		});
	});

	it("answers all twelve markets for a page published everywhere, with only SK live", () => {
		const all = targets(event("page-all-markets-update"));
		expect(all.map((target) => target.market)).toEqual([
			"SK",
			"CZ",
			"PL",
			"HU",
			"RO",
			"AT",
			"DE",
			"IT",
			"FR",
			"ES",
			"US",
			"CA",
		]);
		expect(all.filter((target) => target.live).map((target) => target.url)).toEqual([
			"https://maky.store/sk/o-nas",
		]);
		expect(all.find((target) => target.market === "AT")?.locale).toBe("de");
		expect(all.find((target) => target.market === "CA")?.locale).toBe("en");
	});

	it.each(["page-unpublish", "page-trash", "page-delete"])("%s expects the page to be absent", (name) => {
		expect(targets(event(name))).toEqual([
			{ market: "SK", locale: "sk", live: true, expect: "absent", url: "https://maky.store/sk/o-nas" },
		]);
	});

	it("a restore expects the page back", () => {
		expect(targets(event("page-restore"))[0]).toMatchObject({ market: "SK", expect: "present", live: true });
	});

	it("expects absence in a market the document was just taken out of", () => {
		vi.stubEnv("MAKY_LIVE_MARKETS", "sk,cz");
		const body = event("page-update-slug-and-markets");
		body.routes = {
			previous: { slug: "o-nas", markets: ["SK", "CZ"], locales: ["sk", "cs"] },
			current: { slug: "o-nas", markets: ["SK"], locales: ["sk"] },
		};
		const byMarket = Object.fromEntries(targets(body).map((target) => [target.market, target.expect]));
		expect(byMarket).toEqual({ SK: "present", CZ: "absent" });
	});

	it("gives no URL, and so no live target, when the storefront has no https origin", () => {
		for (const origin of ["", "http://localhost:3000", "not a url"]) {
			vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", origin);
			expect(targets(event("page-publish")), origin).toEqual([
				{
					market: "SK",
					locale: "sk",
					live: false,
					expect: "present",
					url: null,
					reason: "route-not-available",
				},
			]);
		}
	});

	it("answers [] for anything that is not a page with a slug", () => {
		expect(targets(event("media-update"))).toEqual([]);
		expect(targets(event("brand-publish"))).toEqual([]);
		expect(targets(event("global-update"))).toEqual([]);
		expect(targets({ ...event("page-publish"), slug: "../o-nas", routes: {} })).toEqual([]);
	});

	it("answers [] for a v1 body — a v1 response carries no targets at all", () => {
		const v1 = event("page-publish");
		delete v1.schemaVersion;
		expect(targets(v1)).toEqual([]);
	});
});
