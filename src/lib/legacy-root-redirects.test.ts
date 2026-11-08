import { describe, expect, it } from "vitest";

import { isCategorySlug } from "../config/categories";
import { FRIENDLY_SLUGS, SALEOR_SLUGS } from "./channel-map";
import { LEGACY_ROOT_REDIRECTS, legacyRootRedirectTarget } from "./legacy-root-redirects";

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const KEY = new RegExp(`^${SLUG}(?:/${SLUG})*$`);
const TARGET = new RegExp(`^/sk/${SLUG}$`);

const ENTRIES = Object.entries(LEGACY_ROOT_REDIRECTS);

describe("the table", () => {
	it("is not empty", () => {
		expect(ENTRIES.length).toBeGreaterThan(0);
	});

	it.each(ENTRIES)("%s is spelled the way the lookup reads it: lowercase, no slash, no query", (from) => {
		expect(from).toMatch(KEY);
	});

	it.each(ENTRIES)("%s can never take over a market, a category or a Saleor channel", (from) => {
		const first = from.split("/")[0]!;
		expect(FRIENDLY_SLUGS.has(first), "market").toBe(false);
		expect(SALEOR_SLUGS.has(first), "Saleor channel").toBe(false);
		expect(isCategorySlug(first), "category").toBe(false);
	});

	it.each(ENTRIES)("%s goes to one current Slovak address, written as it is served", (_from, to) => {
		expect(to).toMatch(TARGET);
	});

	it("never sends anyone through two hops", () => {
		for (const [from, to] of ENTRIES) {
			expect(LEGACY_ROOT_REDIRECTS[to.replace(/^\//, "")], `${from} -> ${to}`).toBeUndefined();
			expect(to.replace(/^\/sk\//, ""), `${from} points at itself`).not.toBe(from);
		}
	});
});

describe("legacyRootRedirectTarget", () => {
	it("answers the old Thule Epos 2 with the current product", () => {
		expect(legacyRootRedirectTarget("/nosic-bicyklov-thule-epos-2-978100")).toBe(
			"/sk/nosic-bicyklov-thule-epos-2-978-th978100",
		);
	});

	it("reads a trailing slash, capitals and a percent-encoded spelling as the same address", () => {
		const want = "/sk/nosic-bicyklov-thule-epos-2-978-th978100";
		expect(legacyRootRedirectTarget("/nosic-bicyklov-thule-epos-2-978100/")).toBe(want);
		expect(legacyRootRedirectTarget("/Nosic-Bicyklov-Thule-Epos-2-978100")).toBe(want);
		expect(legacyRootRedirectTarget("/nosic-bicyklov-thule-epos-2-978%31%30%30")).toBe(want);
	});

	it("knows nothing about an address that is not in the table", () => {
		// The Spinder TX2 the old shop sold as S30005. The catalogue holds an S30011, which is another
		// code, so another product: no entry, and the root gate keeps answering 404.
		expect(legacyRootRedirectTarget("/nosic-bicyklov-na-tazne-zariadenie-spinder-tx2-s30005")).toBeNull();
		expect(legacyRootRedirectTarget("/pilcicke-nohavice-engelbert-strauss-kwf-profi")).toBeNull();
		expect(legacyRootRedirectTarget("/")).toBeNull();
		expect(legacyRootRedirectTarget("")).toBeNull();
	});

	it("is exact: a prefix, a longer path or a market-prefixed address is not an entry", () => {
		expect(legacyRootRedirectTarget("/nosic-bicyklov-thule-epos-2-978")).toBeNull();
		expect(legacyRootRedirectTarget("/nosic-bicyklov-thule-epos-2-978100/detail")).toBeNull();
		expect(legacyRootRedirectTarget("/sk/nosic-bicyklov-thule-epos-2-978100")).toBeNull();
	});

	it("does not mistake the names every object has for entries", () => {
		for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
			expect(legacyRootRedirectTarget(`/${name}`), name).toBeNull();
		}
	});

	it("treats a path that cannot be decoded as no entry instead of throwing", () => {
		expect(legacyRootRedirectTarget("/%E0%A4%A")).toBeNull();
	});
});
