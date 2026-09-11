import { describe, expect, it } from "vitest";
import { type CatalogContentPage } from "./contract";
import { indexabilityOf, isIndexable, isPubliclyVisible, visibilityOf } from "./publication";

const page = (over: Partial<CatalogContentPage> = {}): CatalogContentPage => ({
	publicId: "pg:1",
	vehicleId: "veh:gn:1",
	kind: "vehicle_generation",
	urlPath: "/stresne-nosice/volkswagen/t-roc/a1",
	hasEditorialText: true,
	state: "published",
	indexable: true,
	...over,
});

describe("visibility", () => {
	it("shows a published page", () => {
		expect(visibilityOf(page())).toEqual({ visible: true });
	});

	it("hides draft and retired", () => {
		expect(isPubliclyVisible(page({ state: "draft" }))).toBe(false);
		expect(isPubliclyVisible(page({ state: "retired" }))).toBe(false);
	});

	it("REFUSES when state is absent — a page must not publish itself by omission", () => {
		// state is not in the schema's `required` list, so this validates and says nothing.
		const decision = visibilityOf(page({ state: undefined }));
		expect(decision.visible).toBe(false);
		expect(decision.visible === false && decision.reason).toContain("absent");
	});

	it("keeps a page with no editorial text REACHABLE", () => {
		// Two such pages exist and both are linked from other articles' bodies.
		// Hiding them would manufacture 404s inside published copy.
		expect(isPubliclyVisible(page({ hasEditorialText: false }))).toBe(true);
	});
});

describe("indexability is a separate decision", () => {
	it("indexes a published, indexable page that has text", () => {
		expect(indexabilityOf(page())).toEqual({ indexable: true });
	});

	it("published + indexable:false is a legitimate visible page, kept out of the index", () => {
		const p = page({ indexable: false });
		expect(isPubliclyVisible(p)).toBe(true);
		expect(isIndexable(p)).toBe(false);
	});

	it("REFUSES when indexable is absent — absence is not consent", () => {
		const decision = indexabilityOf(page({ indexable: undefined }));
		expect(decision.indexable).toBe(false);
		expect(decision.indexable === false && decision.reason).toContain("absent");
	});

	it("never indexes what is not visible, whatever indexable says", () => {
		expect(isIndexable(page({ state: "draft", indexable: true }))).toBe(false);
		expect(isIndexable(page({ state: undefined, indexable: true }))).toBe(false);
	});

	it("keeps a thin page out of the index even when it is published and indexable", () => {
		expect(isIndexable(page({ hasEditorialText: false }))).toBe(false);
	});
});

describe("the shipped export, as measured on 2026-09-11", () => {
	it("publishes nothing: every page is draft, so nothing is visible yet", () => {
		// All 1475 pages are state=draft and indexable=true. The consumer must show
		// none of them and must not read indexable:true as permission.
		const shipped = page({ state: "draft", indexable: true });
		expect(isPubliclyVisible(shipped)).toBe(false);
		expect(isIndexable(shipped)).toBe(false);
	});
});
