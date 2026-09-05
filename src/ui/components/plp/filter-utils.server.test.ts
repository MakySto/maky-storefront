import { describe, expect, it, vi, beforeEach } from "vitest";

const { executePublicGraphQL } = vi.hoisted(() => ({ executePublicGraphQL: vi.fn() }));
vi.mock("@/lib/graphql", () => ({ executePublicGraphQL }));

import { resolveCategorySlugsToIds } from "./filter-utils.server";

/** A category whose Slovak base slug and German translation disagree. */
const translated = {
	id: "Q2F0ZWdvcnk6NA==",
	slug: "nosice-bicyklov",
	name: "Nosiče bicyklov",
	translation: { name: "Fahrradträger", slug: "fahrradtraeger" },
};

/** The live shape today: a base row with no translation at all. */
const untranslated = { ...translated, translation: null };

const serve = (nodes: unknown[]) =>
	executePublicGraphQL.mockResolvedValue({
		ok: true,
		data: { categories: { edges: nodes.map((node) => ({ node })) } },
	});

beforeEach(() => executePublicGraphQL.mockReset());

describe("resolveCategorySlugsToIds", () => {
	it("keys by the slug that was asked for, not the translated one", async () => {
		// `CategoryFilterInput` has `slugs` and no `slugLanguageCode`, so the query
		// can only match BASE slugs. Keying the result by the translated slug meant
		// the caller's get(slug) missed whenever the two differed.
		serve([translated]);

		const map = await resolveCategorySlugsToIds(["nosice-bicyklov"], "de-DE");

		expect([...map.keys()]).toEqual(["nosice-bicyklov"]);
		expect(map.get("nosice-bicyklov")?.id).toBe("Q2F0ZWdvcnk6NA==");
	});

	it("keeps the id when this locale has no name, so the filter still applies", async () => {
		// The dangerous half: categoryIds is built from the map's VALUES, so
		// dropping the entry made ?categories=… quietly return the UNFILTERED
		// listing — the wrong products under a URL that asked for a subset.
		serve([untranslated]);

		const map = await resolveCategorySlugsToIds(["nosice-bicyklov"], "de-DE");

		expect(map.get("nosice-bicyklov")?.id).toBe("Q2F0ZWdvcnk6NA==");
	});

	it("withholds the name rather than putting source copy on a translated route", async () => {
		serve([untranslated]);

		const map = await resolveCategorySlugsToIds(["nosice-bicyklov"], "de-DE");

		expect(map.get("nosice-bicyklov")?.name).toBeNull();
	});

	it("uses the translated name for the chip when there is one", async () => {
		serve([translated]);

		const map = await resolveCategorySlugsToIds(["nosice-bicyklov"], "de-DE");

		expect(map.get("nosice-bicyklov")?.name).toBe("Fahrradträger");
	});

	it("serves the source locale from the base row", async () => {
		serve([untranslated]);

		const map = await resolveCategorySlugsToIds(["nosice-bicyklov"], "sk-SK");

		expect(map.get("nosice-bicyklov")).toEqual({
			id: "Q2F0ZWdvcnk6NA==",
			name: "Nosiče bicyklov",
		});
	});

	it("asks Saleor nothing when there are no slugs", async () => {
		const map = await resolveCategorySlugsToIds([], "sk-SK");

		expect(map.size).toBe(0);
		expect(executePublicGraphQL).not.toHaveBeenCalled();
	});
});
