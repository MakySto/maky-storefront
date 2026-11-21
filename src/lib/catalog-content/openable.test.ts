import { describe, expect, it } from "vitest";
import { type CatalogContentPage } from "./contract";
import { hasOpenablePage } from "./openable";

const page = (over: Partial<CatalogContentPage> = {}): CatalogContentPage => ({
	publicId: "pg:1",
	vehicleId: "veh:md:1",
	kind: "vehicle_model",
	urlPath: "/stresne-nosice/mercedes-benz/vito",
	hasEditorialText: true,
	state: "published",
	indexable: true,
	...over,
});

describe("hasOpenablePage", () => {
	it("opens a published page", () => {
		expect(hasOpenablePage({ page: page() })).toBe(true);
	});

	it("does not open a node CFM wrote no page for in this language (Sprinter Van in DE, 2026-11-10)", () => {
		expect(hasOpenablePage({ page: null })).toBe(false);
	});

	it("does not open a held-back page", () => {
		expect(hasOpenablePage({ page: page({ state: "draft" }) })).toBe(false);
		expect(hasOpenablePage({ page: page({ state: "retired" }) })).toBe(false);
	});

	it("opens a published page that is kept out of the index: a visitor may follow it", () => {
		expect(hasOpenablePage({ page: page({ indexable: false }) })).toBe(true);
	});
});
