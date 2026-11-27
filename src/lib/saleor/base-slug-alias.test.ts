import { afterEach, describe, expect, it, vi } from "vitest";

import { baseSlugAliasTarget } from "./base-slug-alias";

/**
 * Where a foreign market's product lives when it was asked for by its Slovak slug: decided from
 * the product the page has already read, never by a question of its own. The live case of
 * 2026-11-27 is the first row.
 */

const SK = "snehove-retaze-snowdrive-pilot-pro-xl-s-celnou-montazou-n16283";
const DE = "schneeketten-snowdrive-pilot-pro-xl-mit-frontmontage-n16283";

afterEach(() => vi.unstubAllEnvs());

describe("baseSlugAliasTarget", () => {
	it("names the market's own slug when the request spelled the Slovak one", () => {
		expect(baseSlugAliasTarget(SK, { slug: DE, baseSlug: SK }, "de-DE")).toBe(DE);
	});

	it.each(["cs-CZ", "de-AT", "pl-PL", "en-US", "en-CA"])("does so in %s", (locale) => {
		expect(baseSlugAliasTarget(SK, { slug: "own-slug-n16283", baseSlug: SK }, locale)).toBe(
			"own-slug-n16283",
		);
	});

	it("says nothing for the market's own address, so the target can never redirect again", () => {
		expect(baseSlugAliasTarget(DE, { slug: DE, baseSlug: SK }, "de-DE")).toBeNull();
	});

	it("says nothing when both slugs are the same string (the five CoolZ in Czechia)", () => {
		const same = "kompresorova-autochladnicka-pro-user-coolz-19l-tk20409";
		expect(baseSlugAliasTarget(same, { slug: same, baseSlug: same }, "cs-CZ")).toBeNull();
	});

	it("never moves Slovakia, whose slug IS the base row", () => {
		expect(baseSlugAliasTarget(SK, { slug: SK, baseSlug: SK }, "sk-SK")).toBeNull();
		expect(baseSlugAliasTarget(SK, { slug: DE, baseSlug: SK }, "sk-SK")).toBeNull();
	});

	it("is not the old-slug shim: a URL that is not the product's base slug is left alone", () => {
		// The page was reached at a renamed product's new address and found it under its old slug.
		expect(
			baseSlugAliasTarget("novy-slug-n1", { slug: "neuer-slug-n1", baseSlug: "stary-slug-n1" }, "de-DE"),
		).toBeNull();
	});

	it("refuses a target that is not a clean URL segment", () => {
		expect(baseSlugAliasTarget(SK, { slug: "Schneeketten Pilot", baseSlug: SK }, "de-DE")).toBeNull();
		expect(baseSlugAliasTarget(SK, { slug: "", baseSlug: SK }, "de-DE")).toBeNull();
	});

	it("reads the segment the way the lookup does, and survives one that cannot be decoded", () => {
		expect(baseSlugAliasTarget(encodeURIComponent(SK), { slug: DE, baseSlug: SK }, "de-DE")).toBe(DE);
		expect(baseSlugAliasTarget("%E0%A4%A", { slug: DE, baseSlug: SK }, "de-DE")).toBeNull();
	});

	it("is off with MAKY_BASE_SLUG_REDIRECT=off", () => {
		vi.stubEnv("MAKY_BASE_SLUG_REDIRECT", "off");
		expect(baseSlugAliasTarget(SK, { slug: DE, baseSlug: SK }, "de-DE")).toBeNull();
	});
});
