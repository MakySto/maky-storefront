import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMS_PAGE_CACHE_LIFE } from "./cache-life";

/**
 * A CMS page route reads its page through a cache entry, never with a bare `fetch`.
 *
 * The page component reads the CMS outside any `<Suspense>`, and Next answers a plain `fetch`
 * there only while it is not regenerating a shell on demand. A shell older than its `expire`, or
 * one whose tag `/api/revalidate` has just expired, is regenerated on demand: the read went to
 * the network twice, the second time too late, and the first visitor got a 500
 * (`NEXT_STATIC_GEN_BAILOUT`). `"use cache"` entries are read from the resume cache first,
 * on-demand or not.
 *
 * Under vitest the directive does nothing, so these tests hold what they can see: what the cached
 * function declares about itself, and what it hands back. `availability.test.ts` has the same
 * shape for the footer's question.
 */

vi.mock("server-only", () => ({}));

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({
	cacheLife: (...args: unknown[]) => cacheLife(...args),
	cacheTag: (...args: unknown[]) => cacheTag(...args),
}));

const fetchCmsPage = vi.fn();
vi.mock("@/lib/cms/client", () => ({ fetchCmsPage: (...args: unknown[]) => fetchCmsPage(...args) }));

async function subject() {
	return import("./published-page");
}

beforeEach(() => {
	vi.resetModules();
	cacheLife.mockReset();
	cacheTag.mockReset();
	fetchCmsPage.mockReset();
});

describe("readPublishedCmsPage", () => {
	it("hands back what the CMS answered, for this slug, locale and market", async () => {
		const outcome = { status: "found", page: { id: "p1", slug: "o-nas" } };
		fetchCmsPage.mockResolvedValue(outcome);
		const { readPublishedCmsPage } = await subject();

		await expect(readPublishedCmsPage("o-nas", "sk", "SK")).resolves.toBe(outcome);
		expect(fetchCmsPage).toHaveBeenCalledWith("o-nas", "sk", "SK");
	});

	it("declares the page's lifetime and its webhook tags before it reaches the CMS", async () => {
		fetchCmsPage.mockResolvedValue({ status: "not-found" });
		const { readPublishedCmsPage } = await subject();
		await readPublishedCmsPage("poradna", "sk", "SK");

		expect(cacheLife).toHaveBeenCalledTimes(1);
		expect(cacheLife).toHaveBeenCalledWith(CMS_PAGE_CACHE_LIFE);
		expect(cacheTag).toHaveBeenCalledWith("cms:page:poradna");
		expect(cacheTag).toHaveBeenCalledWith("cms:collection:pages");
		expect(
			cacheLife.mock.invocationCallOrder[0],
			"the lifetime is declared before the CMS is asked",
		).toBeLessThan(fetchCmsPage.mock.invocationCallOrder[0]!);
	});

	// The route has a floor for an outage (the bootstrap, or the localised "temporarily
	// unavailable"). A thrown error would never reach it: Next runs a cached function again while it
	// decides the shell, and the second throw fails the whole page.
	it("an outage is handed back as the error outcome and kept for minutes only", async () => {
		const outcome = { status: "error", reason: "timeout after 3000ms" };
		fetchCmsPage.mockResolvedValue(outcome);
		const { readPublishedCmsPage } = await subject();

		await expect(readPublishedCmsPage("o-nas", "sk", "SK")).resolves.toBe(outcome);
		expect(cacheLife).toHaveBeenLastCalledWith("minutes");
	});

	it.each([
		["found", { status: "found", page: { id: "p1", slug: "o-nas" } }],
		["not-found", { status: "not-found" }],
		["market-mismatch", { status: "market-mismatch", documentId: "x", markets: ["CZ"] }],
	])("an authoritative answer (%s) keeps the page's own lifetime", async (_name, outcome) => {
		fetchCmsPage.mockResolvedValue(outcome);
		const { readPublishedCmsPage } = await subject();
		await readPublishedCmsPage("o-nas", "sk", "SK");
		expect(cacheLife).not.toHaveBeenCalledWith("minutes");
	});
});
