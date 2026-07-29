import { describe, expect, it } from "vitest";

import { parseCmsRevalidateEvent, tagsForCmsEvent, type CmsRevalidateEvent } from "./revalidate-event";

/** The body Payload actually posts, captured from the CMS hook. */
const realBody = {
	source: "maky-cms",
	entityType: "collection",
	entitySlug: "pages",
	entityId: "019fb008-504b-779e-ad3f-1ff353267c88",
	event: "publish",
	locale: "sk",
	slug: "o-nas",
	previousSlug: null,
};

function parsed(overrides: Record<string, unknown> = {}): CmsRevalidateEvent {
	const result = parseCmsRevalidateEvent({ ...realBody, ...overrides });
	if (!result.ok) throw new Error(`expected a valid event, got: ${result.reason}`);
	return result.event;
}

describe("parseCmsRevalidateEvent", () => {
	it("accepts the exact body the CMS hook sends", () => {
		const result = parseCmsRevalidateEvent(realBody);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.event).toEqual({
			source: "maky-cms",
			entityType: "collection",
			entitySlug: "pages",
			entityId: "019fb008-504b-779e-ad3f-1ff353267c88",
			event: "publish",
			locale: "sk",
			slug: "o-nas",
			previousSlug: null,
		});
	});

	it.each(["publish", "update", "unpublish", "delete"])("accepts the %s event", (event) => {
		expect(parseCmsRevalidateEvent({ ...realBody, event }).ok).toBe(true);
	});

	it("rejects an unknown source, so a misrouted webhook cannot invalidate anything", () => {
		const result = parseCmsRevalidateEvent({ ...realBody, source: "saleor" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain("source");
	});

	it("rejects an unknown event name", () => {
		expect(parseCmsRevalidateEvent({ ...realBody, event: "purge" }).ok).toBe(false);
		expect(parseCmsRevalidateEvent({ ...realBody, event: undefined }).ok).toBe(false);
	});

	it("rejects an unknown entityType", () => {
		expect(parseCmsRevalidateEvent({ ...realBody, entityType: "widget" }).ok).toBe(false);
	});

	it("rejects a missing entitySlug", () => {
		expect(parseCmsRevalidateEvent({ ...realBody, entitySlug: "" }).ok).toBe(false);
		expect(parseCmsRevalidateEvent({ ...realBody, entitySlug: undefined }).ok).toBe(false);
	});

	it("rejects non-objects", () => {
		expect(parseCmsRevalidateEvent(null).ok).toBe(false);
		expect(parseCmsRevalidateEvent("publish").ok).toBe(false);
		expect(parseCmsRevalidateEvent([realBody]).ok).toBe(false);
	});

	it("normalises absent optional fields to null", () => {
		const event = parsed({ locale: undefined, slug: undefined, entityId: undefined });
		expect(event.locale).toBeNull();
		expect(event.slug).toBeNull();
		expect(event.entityId).toBeNull();
	});
});

describe("tagsForCmsEvent", () => {
	it("invalidates the page tag and the collection tag for a page publish", () => {
		expect(tagsForCmsEvent(parsed())).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
	});

	it("invalidates BOTH slugs on a rename, so the old URL stops serving from cache", () => {
		const tags = tagsForCmsEvent(parsed({ slug: "o-nas-2", previousSlug: "o-nas" }));
		expect(tags).toContain("cms:page:o-nas-2");
		expect(tags).toContain("cms:page:o-nas");
	});

	it("still invalidates on unpublish and delete", () => {
		expect(tagsForCmsEvent(parsed({ event: "unpublish" }))).toContain("cms:page:o-nas");
		expect(tagsForCmsEvent(parsed({ event: "delete" }))).toContain("cms:page:o-nas");
	});

	it("uses the global namespace for a global", () => {
		expect(tagsForCmsEvent(parsed({ entityType: "global", entitySlug: "site-settings" }))).toEqual([
			"cms:global:site-settings",
		]);
	});

	it("falls back to the coarse collection tag for a collection with no per-slug reader", () => {
		expect(tagsForCmsEvent(parsed({ entitySlug: "posts", slug: "clanok" }))).toEqual([
			"cms:collection:posts",
		]);
	});

	it("deduplicates when the slug did not actually change", () => {
		const tags = tagsForCmsEvent(parsed({ slug: "o-nas", previousSlug: "o-nas" }));
		expect(tags).toEqual(["cms:collection:pages", "cms:page:o-nas"]);
	});

	it("drops a slug that is not slug-shaped rather than minting a junk tag", () => {
		expect(tagsForCmsEvent(parsed({ slug: "../../etc/passwd" }))).toEqual(["cms:collection:pages"]);
		expect(tagsForCmsEvent(parsed({ slug: "a b" }))).toEqual(["cms:collection:pages"]);
	});

	it("emits only cms:-namespaced tags, never a Saleor tag", () => {
		// The Saleor endpoint owns product:/category:/collection: — this must not reach them.
		for (const tag of tagsForCmsEvent(parsed())) {
			expect(tag.startsWith("cms:")).toBe(true);
		}
	});
});
